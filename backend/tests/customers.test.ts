import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg, createMemberAndLogin } from './helpers/auth.js';

describe('Customers', () => {
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

  function createCustomer(token: string, body: Record<string, unknown>) {
    return request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send(body);
  }

  describe('POST /api/customers', () => {
    it('lets any org member (incl. AGENT) create a customer', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');

      const res = await createCustomer(agent.token, {
        name: 'Jane Buyer',
        email: 'jane@buyer.com',
        phone: '+1 555 0100',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.customer).toMatchObject({ name: 'Jane Buyer', email: 'jane@buyer.com' });
      expect(res.body.data.customer.organizationId).toEqual(expect.any(String));
    });

    it('rejects a duplicate email within the org', async () => {
      const { adminToken } = await bootstrapOrg(app);
      await createCustomer(adminToken, { name: 'A', email: 'dup@buyer.com' });
      const res = await createCustomer(adminToken, { name: 'B', email: 'dup@buyer.com' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CUSTOMER_EMAIL_TAKEN');
    });

    it('allows the same customer email in a different org', async () => {
      const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
      await createCustomer(orgA.adminToken, { name: 'Shared', email: 'shared@buyer.com' });

      const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');
      const res = await createCustomer(orgB.adminToken, { name: 'Shared', email: 'shared@buyer.com' });
      expect(res.status).toBe(201);
    });

    it('rejects invalid input with 400', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const res = await createCustomer(adminToken, { name: '', email: 'not-an-email' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/customers', () => {
    it('paginates and searches within the org', async () => {
      const { adminToken } = await bootstrapOrg(app);
      await createCustomer(adminToken, { name: 'Alice Anderson', email: 'alice@buyer.com' });
      await createCustomer(adminToken, { name: 'Bob Brown', email: 'bob@buyer.com' });
      await createCustomer(adminToken, { name: 'Carol Clark', email: 'carol@shop.com' });

      const all = await request(app)
        .get('/api/customers?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(all.status).toBe(200);
      expect(all.body.data.customers).toHaveLength(2);
      expect(all.body.data.pagination).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });

      const search = await request(app)
        .get('/api/customers?search=buyer.com')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(search.body.data.customers).toHaveLength(2);

      const byName = await request(app)
        .get('/api/customers?search=carol')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(byName.body.data.customers).toHaveLength(1);
      expect(byName.body.data.customers[0].name).toBe('Carol Clark');
    });

    it('only lists customers from the caller org', async () => {
      const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
      await createCustomer(orgA.adminToken, { name: 'A Cust', email: 'a-cust@buyer.com' });
      const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');

      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${orgB.adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.customers).toHaveLength(0);
    });
  });

  describe('tenant isolation and lifecycle', () => {
    it('returns 404 fetching a customer from another org', async () => {
      const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
      const created = await createCustomer(orgA.adminToken, { name: 'A', email: 'a@buyer.com' });
      const id = created.body.data.customer.id as string;

      const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');
      const res = await request(app)
        .get(`/api/customers/${id}`)
        .set('Authorization', `Bearer ${orgB.adminToken}`);
      expect(res.status).toBe(404);
    });

    it('updates a customer', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const created = await createCustomer(adminToken, { name: 'Old', email: 'old@buyer.com' });
      const id = created.body.data.customer.id as string;

      const res = await request(app)
        .patch(`/api/customers/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New', notes: 'VIP' });
      expect(res.status).toBe(200);
      expect(res.body.data.customer).toMatchObject({ name: 'New', notes: 'VIP' });
    });
  });

  describe('DELETE /api/customers/:id', () => {
    it('forbids an AGENT from deleting', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');
      const created = await createCustomer(adminToken, { name: 'X', email: 'x@buyer.com' });
      const id = created.body.data.customer.id as string;

      const res = await request(app)
        .delete(`/api/customers/${id}`)
        .set('Authorization', `Bearer ${agent.token}`);
      expect(res.status).toBe(403);
    });

    it('lets a MANAGER delete', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const manager = await createMemberAndLogin(app, adminToken, 'manager@example.com', 'MANAGER');
      const created = await createCustomer(adminToken, { name: 'X', email: 'x@buyer.com' });
      const id = created.body.data.customer.id as string;

      const res = await request(app)
        .delete(`/api/customers/${id}`)
        .set('Authorization', `Bearer ${manager.token}`);
      expect(res.status).toBe(204);
    });
  });
});
