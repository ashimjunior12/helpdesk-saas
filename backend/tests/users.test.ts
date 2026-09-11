import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg, createMemberAndLogin } from './helpers/auth.js';

describe('Users', () => {
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

  describe('POST /api/users', () => {
    it('lets an ADMIN create a member who can then log in', async () => {
      const { adminToken } = await bootstrapOrg(app);

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'agent@example.com', name: 'Agent', password: 'sup3rsecret', role: 'AGENT' });

      expect(res.status).toBe(201);
      expect(res.body.data.user).toMatchObject({ email: 'agent@example.com', role: 'AGENT' });
      expect(res.body.data.user).not.toHaveProperty('passwordHash');

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'agent@example.com', password: 'sup3rsecret' });
      expect(login.status).toBe(200);
    });

    it('forbids a non-admin from creating users', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${agent.token}`)
        .send({ email: 'new@example.com', name: 'New', password: 'sup3rsecret', role: 'AGENT' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects a duplicate email with 409', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const body = { email: 'dup@example.com', name: 'Dup', password: 'sup3rsecret', role: 'AGENT' };
      await request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`).send(body);
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });
  });

  describe('GET /api/users', () => {
    it('requires an organization', async () => {
      const reg = await request(app)
        .post('/api/auth/register')
        .send({ email: 'solo@example.com', password: 'sup3rsecret', name: 'Solo' });
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${reg.body.data.accessToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ORG_REQUIRED');
    });

    it('lists members of the caller organization (any role can read)', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${agent.token}`);

      expect(res.status).toBe(200);
      const emails = res.body.data.users.map((u: { email: string }) => u.email).sort();
      expect(emails).toEqual(['admin@example.com', 'agent@example.com']);
    });
  });

  describe('tenant isolation', () => {
    it('returns 404 when fetching a user from another organization', async () => {
      const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
      const memberA = await createMemberAndLogin(app, orgA.adminToken, 'member-a@example.com', 'AGENT');

      const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');

      const res = await request(app)
        .get(`/api/users/${memberA.userId}`)
        .set('Authorization', `Bearer ${orgB.adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('lets an ADMIN change a member role', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');

      const res = await request(app)
        .patch(`/api/users/${agent.userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'MANAGER' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('MANAGER');
    });

    it('rejects modifying yourself', async () => {
      const { adminToken, adminUserId } = await bootstrapOrg(app);
      const res = await request(app)
        .patch(`/api/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'AGENT' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_MODIFY_SELF');
    });

    it('deletes a member and detaches their ticket assignments', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');

      const customer = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'C', email: 'c@buyer.com' });
      const ticket = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subject: 'T', customerId: customer.body.data.customer.id, assignedAgentId: agent.userId });

      const del = await request(app)
        .delete(`/api/users/${agent.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(del.status).toBe(204);

      // The deleted member is gone and their ticket is unassigned.
      const list = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
      expect(list.body.data.users.map((u: { email: string }) => u.email)).not.toContain('agent@example.com');
      const fetched = await request(app)
        .get(`/api/tickets/${ticket.body.data.ticket.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(fetched.body.data.ticket.assignedAgentId).toBeNull();
    });

    it('rejects deleting yourself and forbids a non-admin', async () => {
      const { adminToken, adminUserId } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');

      const self = await request(app)
        .delete(`/api/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(self.status).toBe(400);
      expect(self.body.error.code).toBe('CANNOT_DELETE_SELF');

      const forbidden = await request(app)
        .delete(`/api/users/${adminUserId}`)
        .set('Authorization', `Bearer ${agent.token}`);
      expect(forbidden.status).toBe(403);
    });

    it('deactivates a member so they can no longer log in', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');

      const patch = await request(app)
        .patch(`/api/users/${agent.userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });
      expect(patch.status).toBe(200);
      expect(patch.body.data.user.isActive).toBe(false);

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'agent@example.com', password: 'sup3rsecret' });
      expect(login.status).toBe(403);
      expect(login.body.error.code).toBe('ACCOUNT_DISABLED');
    });
  });
});
