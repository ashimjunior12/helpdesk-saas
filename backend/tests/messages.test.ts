import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg, createMemberAndLogin } from './helpers/auth.js';

describe('Messages', () => {
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

  async function seedTicket(token: string, customerEmail = 'cust@buyer.com') {
    const customer = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cust', email: customerEmail });
    const ticket = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Help', customerId: customer.body.data.customer.id });
    return {
      ticketId: ticket.body.data.ticket.id as string,
      customerId: customer.body.data.customer.id as string,
    };
  }

  function postMessage(token: string, ticketId: string, body: Record<string, unknown>) {
    return request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  describe('POST /api/tickets/:ticketId/messages', () => {
    it('records an AGENT message attributed to the acting user', async () => {
      const { adminToken, adminUserId } = await bootstrapOrg(app);
      const { ticketId } = await seedTicket(adminToken);

      const res = await postMessage(adminToken, ticketId, { body: 'On it', authorType: 'AGENT' });
      expect(res.status).toBe(201);
      expect(res.body.data.message).toMatchObject({ authorType: 'AGENT', authorId: adminUserId, body: 'On it' });
    });

    it('records a CUSTOMER message attributed to the ticket customer', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const { ticketId, customerId } = await seedTicket(adminToken);

      const res = await postMessage(adminToken, ticketId, {
        body: 'It still fails',
        authorType: 'CUSTOMER',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.message).toMatchObject({ authorType: 'CUSTOMER', authorId: customerId });
    });

    it('rejects an empty body or bad author type with 400', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const { ticketId } = await seedTicket(adminToken);
      expect((await postMessage(adminToken, ticketId, { body: '', authorType: 'AGENT' })).status).toBe(400);
      expect((await postMessage(adminToken, ticketId, { body: 'x', authorType: 'BOT' })).status).toBe(400);
    });

    it('returns 404 for a ticket in another organization', async () => {
      const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
      const { ticketId } = await seedTicket(orgA.adminToken, 'a-cust@buyer.com');
      const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');

      const res = await postMessage(orgB.adminToken, ticketId, { body: 'hi', authorType: 'AGENT' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/tickets/:ticketId/messages', () => {
    it('lists messages chronologically with pagination', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const { ticketId } = await seedTicket(adminToken);
      await postMessage(adminToken, ticketId, { body: 'first', authorType: 'CUSTOMER' });
      await postMessage(adminToken, ticketId, { body: 'second', authorType: 'AGENT' });
      await postMessage(adminToken, ticketId, { body: 'third', authorType: 'AGENT' });

      const res = await request(app)
        .get(`/api/tickets/${ticketId}/messages`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.messages.map((m: { body: string }) => m.body)).toEqual([
        'first',
        'second',
        'third',
      ]);
      expect(res.body.data.pagination.total).toBe(3);
    });

    it('returns 404 for a ticket in another organization', async () => {
      const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
      const { ticketId } = await seedTicket(orgA.adminToken, 'a-cust@buyer.com');
      const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');

      const res = await request(app)
        .get(`/api/tickets/${ticketId}/messages`)
        .set('Authorization', `Bearer ${orgB.adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/tickets/:ticketId/messages/:id', () => {
    it('forbids an AGENT and allows a MANAGER', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');
      const manager = await createMemberAndLogin(app, adminToken, 'manager@example.com', 'MANAGER');
      const { ticketId } = await seedTicket(adminToken);
      const msg = await postMessage(adminToken, ticketId, { body: 'x', authorType: 'AGENT' });
      const id = msg.body.data.message.id as string;

      const forbidden = await request(app)
        .delete(`/api/tickets/${ticketId}/messages/${id}`)
        .set('Authorization', `Bearer ${agent.token}`);
      expect(forbidden.status).toBe(403);

      const ok = await request(app)
        .delete(`/api/tickets/${ticketId}/messages/${id}`)
        .set('Authorization', `Bearer ${manager.token}`);
      expect(ok.status).toBe(204);
    });
  });
});
