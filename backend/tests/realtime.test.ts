import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server as IOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initRealtime } from '../src/sockets/index.js';
import { setIO } from '../src/sockets/registry.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg } from './helpers/auth.js';

function waitFor<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function connect(port: number, token?: string): ClientSocket {
  return ioClient(`http://localhost:${port}`, {
    transports: ['websocket'],
    auth: token ? { token } : {},
    reconnection: false,
  });
}

describe('Realtime (Socket.IO)', () => {
  let httpServer: http.Server;
  let io: IOServer;
  let port: number;
  const clients: ClientSocket[] = [];

  const app = createApp();

  beforeAll(async () => {
    await connectTestDatabase();
    httpServer = http.createServer(app);
    io = initRealtime(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    clients.forEach((c) => c.close());
    clients.length = 0;
    await clearTestDatabase();
  });

  afterAll(async () => {
    io.close();
    setIO(undefined);
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await disconnectTestDatabase();
  });

  async function seedTicket(token: string, email = 'cust@buyer.com') {
    const customer = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cust', email });
    const ticket = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Help', customerId: customer.body.data.customer.id });
    return ticket.body.data.ticket.id as string;
  }

  it('refuses a connection without a valid token', async () => {
    const socket = connect(port);
    clients.push(socket);
    const err = await waitFor<Error>(socket, 'connect_error');
    expect(err.message).toBe('Unauthorized');
  });

  it('delivers message:created to a subscribed client', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const ticketId = await seedTicket(adminToken);

    const socket = connect(port, adminToken);
    clients.push(socket);
    await waitFor(socket, 'connect');

    const ack = await socket.emitWithAck('ticket:subscribe', { ticketId });
    expect(ack).toEqual({ ok: true });

    const received = waitFor<{ body: string }>(socket, 'message:created');
    await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'live reply', authorType: 'AGENT' });

    expect((await received).body).toBe('live reply');
  });

  it('refuses subscribing to a ticket from another organization', async () => {
    const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
    const ticketId = await seedTicket(orgA.adminToken, 'a-cust@buyer.com');
    const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');

    const socket = connect(port, orgB.adminToken);
    clients.push(socket);
    await waitFor(socket, 'connect');

    const ack = await socket.emitWithAck('ticket:subscribe', { ticketId });
    expect(ack).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('delivers ticket:created to the org room', async () => {
    const { adminToken } = await bootstrapOrg(app);

    const socket = connect(port, adminToken);
    clients.push(socket);
    await waitFor(socket, 'connect');

    const received = waitFor<{ subject: string }>(socket, 'ticket:created');
    await seedTicket(adminToken);

    expect((await received).subject).toBe('Help');
  });
});
