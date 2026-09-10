import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../../src/app.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from '../helpers/db.js';
import { bootstrapOrg, createMemberAndLogin } from '../helpers/auth.js';

// End-to-end journey across modules, exercising the realistic support flow that
// the per-module suites cover in isolation.
describe('E2E: ticket lifecycle', () => {
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

  it('runs a full support journey and reflects it in notifications, analytics, and search', async () => {
    // 1. Admin + org, and an agent who will own the ticket.
    const { adminToken } = await bootstrapOrg(app, 'admin@acme.com', 'Acme');
    const agent = await createMemberAndLogin(app, adminToken, 'agent@acme.com', 'AGENT');
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

    // 2. A customer.
    const customer = await request(app)
      .post('/api/customers')
      .set(auth(adminToken))
      .send({ name: 'Dana Buyer', email: 'dana@buyer.com' });
    const customerId = customer.body.data.customer.id as string;

    // 3. A ticket assigned to the agent -> agent is notified.
    const ticketRes = await request(app)
      .post('/api/tickets')
      .set(auth(adminToken))
      .send({ subject: 'Cannot reset password', customerId, assignedAgentId: agent.userId, priority: 'HIGH' });
    expect(ticketRes.status).toBe(201);
    const ticketId = ticketRes.body.data.ticket.id as string;

    // 4. Agent replies (public message) and adds an internal note.
    await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set(auth(agent.token))
      .send({ body: 'Looking into it now.', authorType: 'AGENT' });
    await request(app)
      .post(`/api/tickets/${ticketId}/notes`)
      .set(auth(agent.token))
      .send({ body: 'Reset email was in spam - internal.' });

    // Internal note must not appear in the public conversation.
    const messages = await request(app).get(`/api/tickets/${ticketId}/messages`).set(auth(agent.token));
    expect(messages.body.data.messages).toHaveLength(1);

    // 5. Admin resolves the ticket -> agent notified again.
    const resolved = await request(app)
      .post(`/api/tickets/${ticketId}/status`)
      .set(auth(adminToken))
      .send({ status: 'RESOLVED' });
    expect(resolved.body.data.ticket.status).toBe('RESOLVED');
    expect(resolved.body.data.ticket.resolvedAt).toEqual(expect.any(String));

    // 6. The agent has notifications (assignment + message-was-theirs excluded + status).
    const notifs = await request(app).get('/api/notifications').set(auth(agent.token));
    expect(notifs.body.data.notifications.length).toBeGreaterThanOrEqual(2);
    const readAll = await request(app).post('/api/notifications/read-all').set(auth(agent.token));
    expect(readAll.body.data.updated).toBeGreaterThanOrEqual(2);
    expect((await request(app).get('/api/notifications/unread-count').set(auth(agent.token))).body.data.count).toBe(0);

    // 7. Analytics reflect the resolved ticket.
    const overview = await request(app).get('/api/analytics/overview').set(auth(adminToken));
    expect(overview.body.data.totals.tickets).toBe(1);
    expect(overview.body.data.byStatus.RESOLVED).toBe(1);
    expect(overview.body.data.byPriority.HIGH).toBe(1);

    // 8. Search finds the ticket and the customer.
    const found = await request(app).get('/api/search?q=password').set(auth(agent.token));
    expect(found.body.data.tickets).toHaveLength(1);
    const foundCustomer = await request(app).get('/api/search?q=dana').set(auth(agent.token));
    expect(foundCustomer.body.data.customers).toHaveLength(1);
  });
});
