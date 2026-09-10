import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { TicketModel } from '../src/modules/tickets/ticket.model.js';
import { evaluateSlaBreaches } from '../src/modules/sla/sla.service.js';
import { NotificationModel } from '../src/modules/notifications/notification.model.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg, createMemberAndLogin } from './helpers/auth.js';

describe('SLA', () => {
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

  async function seedTicket(token: string, priority = 'MEDIUM') {
    const customer = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cust', email: 'cust@buyer.com' });
    const ticket = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Help', customerId: customer.body.data.customer.id, priority });
    return ticket.body.data.ticket;
  }

  describe('policy', () => {
    it('returns a default policy and lets an ADMIN update it', async () => {
      const { adminToken } = await bootstrapOrg(app);

      const def = await request(app).get('/api/sla-policy').set('Authorization', `Bearer ${adminToken}`);
      expect(def.status).toBe(200);
      expect(def.body.data.policy.targets.URGENT.firstResponseMins).toBe(15);

      const updated = await request(app)
        .put('/api/sla-policy')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targets: {
            URGENT: { firstResponseMins: 5, resolutionMins: 60 },
            HIGH: { firstResponseMins: 30, resolutionMins: 240 },
            MEDIUM: { firstResponseMins: 120, resolutionMins: 720 },
            LOW: { firstResponseMins: 240, resolutionMins: 1440 },
          },
        });
      expect(updated.status).toBe(200);
      expect(updated.body.data.policy.targets.URGENT.firstResponseMins).toBe(5);
    });

    it('forbids a non-admin from updating the policy', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');
      const res = await request(app)
        .put('/api/sla-policy')
        .set('Authorization', `Bearer ${agent.token}`)
        .send({
          targets: {
            URGENT: { firstResponseMins: 5, resolutionMins: 60 },
            HIGH: { firstResponseMins: 30, resolutionMins: 240 },
            MEDIUM: { firstResponseMins: 120, resolutionMins: 720 },
            LOW: { firstResponseMins: 240, resolutionMins: 1440 },
          },
        });
      expect(res.status).toBe(403);
    });
  });

  describe('due dates and lifecycle', () => {
    it('sets due timestamps at creation based on priority', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const ticket = await seedTicket(adminToken, 'URGENT');
      expect(ticket.firstResponseDueAt).toEqual(expect.any(String));
      expect(ticket.resolutionDueAt).toEqual(expect.any(String));

      // URGENT default first-response target is 15 minutes.
      const created = new Date(ticket.createdAt).getTime();
      const due = new Date(ticket.firstResponseDueAt).getTime();
      expect(Math.round((due - created) / 60000)).toBe(15);
    });

    it('records first agent response and resolution time', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const ticket = await seedTicket(adminToken);

      await request(app)
        .post(`/api/tickets/${ticket.id}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'on it', authorType: 'AGENT' });
      await request(app)
        .post(`/api/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED' });

      const stored = await TicketModel.findById(ticket.id);
      expect(stored?.firstRespondedAt).toBeInstanceOf(Date);
      expect(stored?.resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe('breach evaluation', () => {
    it('flags first-response and resolution breaches and notifies the assignee', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');
      const customer = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Cust', email: 'cust@buyer.com' });
      const ticket = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subject: 'Help',
          customerId: customer.body.data.customer.id,
          assignedAgentId: agent.userId,
        });

      // Force the due dates into the past.
      await TicketModel.findByIdAndUpdate(ticket.body.data.ticket.id, {
        firstResponseDueAt: new Date(Date.now() - 60_000),
        resolutionDueAt: new Date(Date.now() - 60_000),
      });

      const result = await evaluateSlaBreaches();
      expect(result.firstResponse).toBe(1);
      expect(result.resolution).toBe(1);

      const stored = await TicketModel.findById(ticket.body.data.ticket.id);
      expect(stored?.firstResponseBreached).toBe(true);
      expect(stored?.resolutionBreached).toBe(true);

      // Re-running is idempotent (already flagged).
      const again = await evaluateSlaBreaches();
      expect(again.firstResponse).toBe(0);
      expect(again.resolution).toBe(0);

      const breachNotifs = await NotificationModel.countDocuments({
        userId: agent.userId,
        type: 'SLA_BREACH',
      });
      expect(breachNotifs).toBe(2);
    });

    it('does not flag a ticket that responded and resolved in time', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const ticket = await seedTicket(adminToken);
      await request(app)
        .post(`/api/tickets/${ticket.id}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'on it', authorType: 'AGENT' });
      await request(app)
        .post(`/api/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED' });

      await TicketModel.findByIdAndUpdate(ticket.id, {
        firstResponseDueAt: new Date(Date.now() - 60_000),
        resolutionDueAt: new Date(Date.now() - 60_000),
      });

      const result = await evaluateSlaBreaches();
      expect(result.firstResponse).toBe(0);
      expect(result.resolution).toBe(0);
    });
  });
});
