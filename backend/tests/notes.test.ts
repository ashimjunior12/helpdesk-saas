import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg, createMemberAndLogin } from './helpers/auth.js';

describe('Internal notes', () => {
  let app: Application;

  beforeAll(async () => {
    await connectTestDatabase();
    app = createApp();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
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

  function postNote(token: string, ticketId: string, body: Record<string, unknown>) {
    return request(app)
      .post(`/api/tickets/${ticketId}/notes`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  it('creates a note attributed to the acting staff user', async () => {
    const { adminToken, adminUserId } = await bootstrapOrg(app);
    const ticketId = await seedTicket(adminToken);

    const res = await postNote(adminToken, ticketId, { body: 'Called billing, waiting.' });
    expect(res.status).toBe(201);
    expect(res.body.data.note).toMatchObject({ authorId: adminUserId, body: 'Called billing, waiting.' });
  });

  it('lets any staff role create and list notes', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');
    const ticketId = await seedTicket(adminToken);

    await postNote(agent.token, ticketId, { body: 'first' });
    await postNote(adminToken, ticketId, { body: 'second' });

    const res = await request(app)
      .get(`/api/tickets/${ticketId}/notes`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.notes.map((n: { body: string }) => n.body)).toEqual(['first', 'second']);
  });

  it('never exposes notes through the public messages endpoint', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const ticketId = await seedTicket(adminToken);
    await postNote(adminToken, ticketId, { body: 'internal only' });
    await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'public reply', authorType: 'AGENT' });

    const messages = await request(app)
      .get(`/api/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${adminToken}`);
    const bodies = messages.body.data.messages.map((m: { body: string }) => m.body);
    expect(bodies).toEqual(['public reply']);
    expect(bodies).not.toContain('internal only');
  });

  it('returns 404 for a ticket in another organization', async () => {
    const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
    const ticketId = await seedTicket(orgA.adminToken, 'a-cust@buyer.com');
    const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');

    expect((await postNote(orgB.adminToken, ticketId, { body: 'x' })).status).toBe(404);
    const list = await request(app)
      .get(`/api/tickets/${ticketId}/notes`)
      .set('Authorization', `Bearer ${orgB.adminToken}`);
    expect(list.status).toBe(404);
  });

  it('forbids an AGENT from deleting and allows a MANAGER', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');
    const manager = await createMemberAndLogin(app, adminToken, 'manager@example.com', 'MANAGER');
    const ticketId = await seedTicket(adminToken);
    const note = await postNote(adminToken, ticketId, { body: 'x' });
    const id = note.body.data.note.id as string;

    const forbidden = await request(app)
      .delete(`/api/tickets/${ticketId}/notes/${id}`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(forbidden.status).toBe(403);

    const ok = await request(app)
      .delete(`/api/tickets/${ticketId}/notes/${id}`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(ok.status).toBe(204);
  });
});
