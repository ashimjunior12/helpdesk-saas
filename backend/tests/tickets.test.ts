import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg, createMemberAndLogin } from './helpers/auth.js';

describe('Tickets', () => {
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

  async function createCustomer(token: string, email = 'cust@buyer.com') {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cust', email });
    return res.body.data.customer.id as string;
  }

  function createTicket(token: string, body: Record<string, unknown>) {
    return request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`).send(body);
  }

  describe('POST /api/tickets', () => {
    it('creates a ticket with a per-org sequential number, defaulting to OPEN/MEDIUM', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const customerId = await createCustomer(adminToken);

      const first = await createTicket(adminToken, { subject: 'Cannot log in', customerId });
      expect(first.status).toBe(201);
      expect(first.body.data.ticket).toMatchObject({
        number: 1,
        status: 'OPEN',
        priority: 'MEDIUM',
        subject: 'Cannot log in',
      });

      const second = await createTicket(adminToken, { subject: 'Billing question', customerId });
      expect(second.body.data.ticket.number).toBe(2);
    });

    it('rejects a customer from another organization', async () => {
      const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
      const customerA = await createCustomer(orgA.adminToken, 'a-cust@buyer.com');
      const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');

      const res = await createTicket(orgB.adminToken, { subject: 'X', customerId: customerA });
      expect(res.status).toBe(404);
    });

    it('rejects an assignee from another organization', async () => {
      const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
      const customerA = await createCustomer(orgA.adminToken, 'a-cust@buyer.com');
      const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');
      const agentB = await createMemberAndLogin(app, orgB.adminToken, 'agent-b@example.com', 'AGENT');

      const res = await createTicket(orgA.adminToken, {
        subject: 'X',
        customerId: customerA,
        assignedAgentId: agentB.userId,
      });
      expect(res.status).toBe(404);
    });

    it('lets an AGENT create a ticket', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');
      const customerId = await createCustomer(adminToken);

      const res = await createTicket(agent.token, { subject: 'Help', customerId, priority: 'HIGH' });
      expect(res.status).toBe(201);
      expect(res.body.data.ticket.priority).toBe('HIGH');
    });
  });

  describe('GET /api/tickets', () => {
    it('filters, searches, and paginates within the org', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const customerId = await createCustomer(adminToken);
      await createTicket(adminToken, { subject: 'Login broken', customerId, priority: 'URGENT' });
      await createTicket(adminToken, { subject: 'Refund request', customerId, priority: 'LOW' });
      await createTicket(adminToken, { subject: 'Login slow', customerId, priority: 'LOW' });

      const byPriority = await request(app)
        .get('/api/tickets?priority=LOW')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(byPriority.body.data.tickets).toHaveLength(2);

      const search = await request(app)
        .get('/api/tickets?search=login')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(search.body.data.tickets).toHaveLength(2);

      const paged = await request(app)
        .get('/api/tickets?limit=2&page=1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(paged.body.data.pagination).toMatchObject({ total: 3, totalPages: 2 });
    });

    it('returns 404 for a ticket in another org', async () => {
      const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
      const customerId = await createCustomer(orgA.adminToken, 'a-cust@buyer.com');
      const created = await createTicket(orgA.adminToken, { subject: 'X', customerId });
      const id = created.body.data.ticket.id as string;

      const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');
      const res = await request(app)
        .get(`/api/tickets/${id}`)
        .set('Authorization', `Bearer ${orgB.adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('status transitions', () => {
    it('allows valid transitions and rejects invalid ones', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const customerId = await createCustomer(adminToken);
      const created = await createTicket(adminToken, { subject: 'X', customerId });
      const id = created.body.data.ticket.id as string;

      const setStatus = (status: string) =>
        request(app)
          .post(`/api/tickets/${id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status });

      expect((await setStatus('PENDING')).status).toBe(200);
      expect((await setStatus('RESOLVED')).status).toBe(200);

      const invalid = await setStatus('PENDING'); // RESOLVED -> PENDING not allowed
      expect(invalid.status).toBe(409);
      expect(invalid.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      expect((await setStatus('CLOSED')).status).toBe(200);
      expect((await setStatus('OPEN')).status).toBe(200); // reopen allowed
    });
  });

  describe('assignment', () => {
    it('assigns and unassigns an agent within the org', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');
      const customerId = await createCustomer(adminToken);
      const created = await createTicket(adminToken, { subject: 'X', customerId });
      const id = created.body.data.ticket.id as string;

      const assign = await request(app)
        .post(`/api/tickets/${id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedAgentId: agent.userId });
      expect(assign.status).toBe(200);
      expect(assign.body.data.ticket.assignedAgentId).toBe(agent.userId);

      const unassign = await request(app)
        .post(`/api/tickets/${id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedAgentId: null });
      expect(unassign.body.data.ticket.assignedAgentId).toBeNull();
    });

    it('rejects assigning an agent from another org', async () => {
      const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
      const customerId = await createCustomer(orgA.adminToken, 'a-cust@buyer.com');
      const created = await createTicket(orgA.adminToken, { subject: 'X', customerId });
      const id = created.body.data.ticket.id as string;

      const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');
      const agentB = await createMemberAndLogin(app, orgB.adminToken, 'agent-b@example.com', 'AGENT');

      const res = await request(app)
        .post(`/api/tickets/${id}/assign`)
        .set('Authorization', `Bearer ${orgA.adminToken}`)
        .send({ assignedAgentId: agentB.userId });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/tickets/:id', () => {
    it('forbids an AGENT and allows a MANAGER', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');
      const manager = await createMemberAndLogin(app, adminToken, 'manager@example.com', 'MANAGER');
      const customerId = await createCustomer(adminToken);
      const created = await createTicket(adminToken, { subject: 'X', customerId });
      const id = created.body.data.ticket.id as string;

      const forbidden = await request(app)
        .delete(`/api/tickets/${id}`)
        .set('Authorization', `Bearer ${agent.token}`);
      expect(forbidden.status).toBe(403);

      const ok = await request(app)
        .delete(`/api/tickets/${id}`)
        .set('Authorization', `Bearer ${manager.token}`);
      expect(ok.status).toBe(204);
    });
  });
});
