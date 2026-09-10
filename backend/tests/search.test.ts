import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg } from './helpers/auth.js';

describe('Search', () => {
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

  async function seed(token: string) {
    const customer = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice Login', email: 'alice@buyer.com' });
    const ticket = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Login broken', customerId: customer.body.data.customer.id });
    return { customerId: customer.body.data.customer.id, ticketNumber: ticket.body.data.ticket.number };
  }

  const doSearch = (token: string, q: string) =>
    request(app).get(`/api/search?q=${encodeURIComponent(q)}`).set('Authorization', `Bearer ${token}`);

  it('finds tickets and customers by term', async () => {
    const { adminToken } = await bootstrapOrg(app);
    await seed(adminToken);

    const res = await doSearch(adminToken, 'login');
    expect(res.status).toBe(200);
    expect(res.body.data.tickets).toHaveLength(1);
    expect(res.body.data.customers).toHaveLength(1);
  });

  it('matches a ticket by its number', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const { ticketNumber } = await seed(adminToken);

    const res = await doSearch(adminToken, String(ticketNumber));
    expect(res.body.data.tickets).toHaveLength(1);
  });

  it('requires a query', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const res = await doSearch(adminToken, '');
    expect(res.status).toBe(400);
  });

  it('scopes results to the caller organization', async () => {
    const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
    await seed(orgA.adminToken);
    const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');

    const res = await doSearch(orgB.adminToken, 'login');
    expect(res.body.data.tickets).toHaveLength(0);
    expect(res.body.data.customers).toHaveLength(0);
  });
});
