import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg, createMemberAndLogin } from './helpers/auth.js';

describe('Notifications', () => {
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

  async function seedAssignedTicket() {
    const { adminToken, adminUserId } = await bootstrapOrg(app);
    const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');
    const customer = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Cust', email: 'cust@buyer.com' });
    const ticket = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'Help', customerId: customer.body.data.customer.id, assignedAgentId: agent.userId });
    return { adminToken, adminUserId, agent, ticketId: ticket.body.data.ticket.id as string };
  }

  const list = (token: string, qs = '') =>
    request(app).get(`/api/notifications${qs}`).set('Authorization', `Bearer ${token}`);
  const unread = (token: string) =>
    request(app).get('/api/notifications/unread-count').set('Authorization', `Bearer ${token}`);

  it('notifies the assignee on assignment, new message, and status change (not the actor)', async () => {
    const { adminToken, agent, ticketId } = await seedAssignedTicket();

    // Assignment at creation already notified the agent.
    let agentList = await list(agent.token);
    expect(agentList.body.data.notifications).toHaveLength(1);
    expect(agentList.body.data.notifications[0]).toMatchObject({
      type: 'TICKET_ASSIGNED',
      isRead: false,
    });

    // The admin acts; the agent (assignee) is notified.
    await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'update', authorType: 'AGENT' });
    await request(app)
      .post(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PENDING' });

    expect((await unread(agent.token)).body.data.count).toBe(3);

    // The actor (admin) receives nothing for their own actions.
    expect((await list(adminToken)).body.data.notifications).toHaveLength(0);
  });

  it('does not notify an assignee about their own action', async () => {
    const { agent, ticketId } = await seedAssignedTicket();
    expect((await unread(agent.token)).body.data.count).toBe(1); // the assignment

    // Agent posts a message on their own ticket -> no self-notification.
    await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ body: 'mine', authorType: 'AGENT' });

    expect((await unread(agent.token)).body.data.count).toBe(1);
  });

  it('filters unread and marks one/all read', async () => {
    const { adminToken, agent, ticketId } = await seedAssignedTicket();
    await request(app)
      .post(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PENDING' });

    const unreadList = await list(agent.token, '?unread=true');
    expect(unreadList.body.data.notifications.length).toBe(2);

    const firstId = unreadList.body.data.notifications[0].id as string;
    const readOne = await request(app)
      .post(`/api/notifications/${firstId}/read`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(readOne.status).toBe(200);
    expect(readOne.body.data.notification.isRead).toBe(true);
    expect((await unread(agent.token)).body.data.count).toBe(1);

    const readAll = await request(app)
      .post('/api/notifications/read-all')
      .set('Authorization', `Bearer ${agent.token}`);
    expect(readAll.body.data.updated).toBe(1);
    expect((await unread(agent.token)).body.data.count).toBe(0);
  });

  it('scopes notifications to the owner (cannot read another user notification)', async () => {
    const { adminToken, agent } = await seedAssignedTicket();
    const agentNotif = (await list(agent.token)).body.data.notifications[0].id as string;

    const res = await request(app)
      .post(`/api/notifications/${agentNotif}/read`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
