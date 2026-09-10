import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg } from './helpers/auth.js';

describe('Analytics', () => {
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

  async function customer(token: string, email: string) {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'C', email });
    return res.body.data.customer.id as string;
  }

  function ticket(token: string, customerId: string, priority: string) {
    return request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'T', customerId, priority });
  }

  it('summarizes tickets by status and priority with totals', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const c = await customer(adminToken, 'c@buyer.com');
    const t1 = await ticket(adminToken, c, 'HIGH');
    await ticket(adminToken, c, 'LOW');

    // Resolve one ticket (records resolvedAt).
    await request(app)
      .post(`/api/tickets/${t1.body.data.ticket.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESOLVED' });

    const res = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totals.tickets).toBe(2);
    expect(res.body.data.totals.open).toBe(1);
    expect(res.body.data.byStatus.OPEN).toBe(1);
    expect(res.body.data.byStatus.RESOLVED).toBe(1);
    expect(res.body.data.byPriority.HIGH).toBe(1);
    expect(res.body.data.byPriority.LOW).toBe(1);
    expect(res.body.data.avgResolutionMs).toEqual(expect.any(Number));
    expect(Array.isArray(res.body.data.createdSeries)).toBe(true);
    expect(res.body.data.createdSeries[0].count).toBe(2);
  });

  it('scopes analytics to the caller organization', async () => {
    const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
    const c = await customer(orgA.adminToken, 'a-c@buyer.com');
    await ticket(orgA.adminToken, c, 'MEDIUM');

    const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');
    const res = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', `Bearer ${orgB.adminToken}`);
    expect(res.body.data.totals.tickets).toBe(0);
  });
});
