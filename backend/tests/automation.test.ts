import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg, createMemberAndLogin } from './helpers/auth.js';

describe('Automation', () => {
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

  async function customer(token: string, email = 'cust@buyer.com') {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'C', email });
    return res.body.data.customer.id as string;
  }

  const createRule = (token: string, body: Record<string, unknown>) =>
    request(app).post('/api/automation-rules').set('Authorization', `Bearer ${token}`).send(body);

  it('applies a matching rule on ticket creation (set priority + category)', async () => {
    const { adminToken } = await bootstrapOrg(app);
    await createRule(adminToken, {
      name: 'Urgent refunds',
      conditions: [{ field: 'subject', operator: 'contains', value: ['refund'] }],
      actions: [
        { type: 'SET_PRIORITY', value: 'URGENT' },
        { type: 'SET_CATEGORY', value: 'billing' },
      ],
    });

    const c = await customer(adminToken);
    const ticket = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'Please process my refund', customerId: c, priority: 'LOW' });

    expect(ticket.body.data.ticket.priority).toBe('URGENT');
    expect(ticket.body.data.ticket.category).toBe('billing');
  });

  it('assigns a team when the rule matches', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const team = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Billing' });
    const teamId = team.body.data.team.id as string;

    await createRule(adminToken, {
      name: 'Route billing',
      conditions: [{ field: 'category', operator: 'eq', value: ['billing'] }],
      actions: [{ type: 'ASSIGN_TEAM', value: teamId }],
    });

    const c = await customer(adminToken);
    const ticket = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'x', customerId: c, category: 'billing' });

    expect(ticket.body.data.ticket.teamId).toBe(teamId);
  });

  it('does not apply a rule when conditions do not match', async () => {
    const { adminToken } = await bootstrapOrg(app);
    await createRule(adminToken, {
      name: 'Urgent refunds',
      conditions: [{ field: 'subject', operator: 'contains', value: ['refund'] }],
      actions: [{ type: 'SET_PRIORITY', value: 'URGENT' }],
    });

    const c = await customer(adminToken);
    const ticket = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'password reset', customerId: c, priority: 'LOW' });

    expect(ticket.body.data.ticket.priority).toBe('LOW');
  });

  it('rejects a rule whose assign target is outside the org, and non-admins cannot manage', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');

    const badTeam = await createRule(adminToken, {
      name: 'bad',
      conditions: [],
      actions: [{ type: 'ASSIGN_TEAM', value: '000000000000000000000000' }],
    });
    expect(badTeam.status).toBe(400);

    const forbidden = await createRule(agent.token, {
      name: 'nope',
      conditions: [],
      actions: [{ type: 'SET_PRIORITY', value: 'HIGH' }],
    });
    expect(forbidden.status).toBe(403);
  });
});
