import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { UserModel } from '../src/modules/auth/user.model.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';

describe('Auth', () => {
  let app: Application;

  const validUser = { email: 'agent@example.com', password: 'sup3rsecret', name: 'Agent Smith' };

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

  describe('POST /api/auth/register', () => {
    it('creates a user and returns tokens without leaking the password hash', async () => {
      const res = await request(app).post('/api/auth/register').send(validUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toMatchObject({ email: validUser.email, name: validUser.name });
      expect(res.body.data.user.id).toEqual(expect.any(String));
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.refreshToken).toEqual(expect.any(String));
      // Never expose secrets in the response.
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(res.body.data.user).not.toHaveProperty('password');
    });

    it('stores the password only as a bcrypt hash, never in plaintext', async () => {
      await request(app).post('/api/auth/register').send(validUser);

      const stored = await UserModel.findOne({ email: validUser.email }).select('+passwordHash');
      expect(stored).not.toBeNull();
      expect(stored?.passwordHash).toBeDefined();
      expect(stored?.passwordHash).not.toEqual(validUser.password);
      expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('normalizes the email to lowercase', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validUser, email: 'Agent@Example.COM' });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe('agent@example.com');
    });

    it('rejects a duplicate email with 409', async () => {
      await request(app).post('/api/auth/register').send(validUser);
      const res = await request(app).post('/api/auth/register').send(validUser);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('rejects invalid input with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'short', name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(validUser);
    });

    it('logs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: validUser.password });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.refreshToken).toEqual(expect.any(String));
    });

    it('rejects a wrong password with 401 and a generic message', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects an unknown email with the same 401 (no user enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: validUser.password });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 with a malformed token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not-a-jwt');
      expect(res.status).toBe(401);
    });

    it('returns the authenticated user with a valid access token', async () => {
      const reg = await request(app).post('/api/auth/register').send(validUser);
      const token = reg.body.data.accessToken as string;

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user).toMatchObject({ email: validUser.email });
      expect(res.body.data.user.id).toEqual(expect.any(String));
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('issues a new token pair for a valid refresh token', async () => {
      const reg = await request(app).post('/api/auth/register').send(validUser);
      const refreshToken = reg.body.data.refreshToken as string;

      const res = await request(app).post('/api/auth/refresh').send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.refreshToken).toEqual(expect.any(String));
    });

    it('rejects an invalid refresh token with 401', async () => {
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'garbage' });
      expect(res.status).toBe(401);
    });

    it('rejects an access token used at the refresh endpoint', async () => {
      const reg = await request(app).post('/api/auth/register').send(validUser);
      const accessToken = reg.body.data.accessToken as string;

      const res = await request(app).post('/api/auth/refresh').send({ refreshToken: accessToken });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns 200 (stateless client-side logout)', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
