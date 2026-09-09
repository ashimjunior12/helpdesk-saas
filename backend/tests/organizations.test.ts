import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { UserModel } from '../src/modules/auth/user.model.js';
import { verifyAccessToken } from '../src/modules/auth/token.service.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';

describe('Organizations', () => {
  let app: Application;

  async function registerUser(email: string) {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'sup3rsecret', name: 'Test User' });
    return {
      accessToken: res.body.data.accessToken as string,
      refreshToken: res.body.data.refreshToken as string,
      userId: res.body.data.user.id as string,
    };
  }

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

  describe('POST /api/organizations', () => {
    it('requires authentication', async () => {
      const res = await request(app).post('/api/organizations').send({ name: 'Acme' });
      expect(res.status).toBe(401);
    });

    it('creates an organization, makes the caller ADMIN, and reissues tokens', async () => {
      const { accessToken, userId } = await registerUser('owner@example.com');

      const res = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Acme Inc' });

      expect(res.status).toBe(201);
      expect(res.body.data.organization).toMatchObject({ name: 'Acme Inc' });
      expect(res.body.data.organization.id).toEqual(expect.any(String));
      expect(res.body.data.accessToken).toEqual(expect.any(String));

      const stored = await UserModel.findById(userId);
      expect(String(stored?.organizationId)).toBe(res.body.data.organization.id);
      expect(stored?.role).toBe('ADMIN');

      // The reissued access token now carries org context.
      const identity = verifyAccessToken(res.body.data.accessToken);
      expect(identity.organizationId).toBe(res.body.data.organization.id);
      expect(identity.role).toBe('ADMIN');
    });

    it('rejects a second organization for a user who already has one', async () => {
      const { accessToken } = await registerUser('owner@example.com');
      await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'First Org' });

      // The original token still works for auth but the user is now linked.
      const res = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Second Org' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_IN_ORGANIZATION');
    });

    it('rejects an invalid name with 400', async () => {
      const { accessToken } = await registerUser('owner@example.com');
      const res = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/organizations/me', () => {
    it('returns 403 for an authenticated user without an organization', async () => {
      const { accessToken } = await registerUser('solo@example.com');
      const res = await request(app)
        .get('/api/organizations/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ORG_REQUIRED');
    });

    it('returns the caller organization', async () => {
      const { accessToken } = await registerUser('owner@example.com');
      const created = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Acme Inc' });
      const orgToken = created.body.data.accessToken as string;

      const res = await request(app)
        .get('/api/organizations/me')
        .set('Authorization', `Bearer ${orgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.organization).toMatchObject({ name: 'Acme Inc' });
    });
  });

  describe('tenant isolation: GET /api/organizations/:id', () => {
    it('returns 200 for the caller own organization', async () => {
      const { accessToken } = await registerUser('a@example.com');
      const created = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Org A' });
      const orgId = created.body.data.organization.id as string;
      const orgToken = created.body.data.accessToken as string;

      const res = await request(app)
        .get(`/api/organizations/${orgId}`)
        .set('Authorization', `Bearer ${orgToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.organization.id).toBe(orgId);
    });

    it("returns 404 (not 403) when requesting another tenant organization", async () => {
      // Org A
      const a = await registerUser('a@example.com');
      const orgA = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ name: 'Org A' });
      const orgAId = orgA.body.data.organization.id as string;

      // Org B (different tenant)
      const b = await registerUser('b@example.com');
      const orgB = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${b.accessToken}`)
        .send({ name: 'Org B' });
      const orgBToken = orgB.body.data.accessToken as string;

      const res = await request(app)
        .get(`/api/organizations/${orgAId}`)
        .set('Authorization', `Bearer ${orgBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/organizations/me', () => {
    it('updates the organization name within the tenant', async () => {
      const { accessToken } = await registerUser('owner@example.com');
      const created = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Old Name' });
      const orgToken = created.body.data.accessToken as string;

      const res = await request(app)
        .patch('/api/organizations/me')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.organization.name).toBe('New Name');
    });
  });
});
