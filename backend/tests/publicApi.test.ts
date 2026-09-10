import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg, createMemberAndLogin } from './helpers/auth.js';

describe('Public API + API keys', () => {
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

  async function createKey(adminToken: string) {
    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Website' });
    return res;
  }

  it('lets an ADMIN mint a key (raw returned once, hash never exposed)', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const res = await createKey(adminToken);
    expect(res.status).toBe(201);
    expect(res.body.data.key).toMatch(/^hlpk_/);
    expect(res.body.data.apiKey).not.toHaveProperty('keyHash');
    expect(res.body.data.apiKey.prefix).toMatch(/^hlpk_/);
  });

  it('forbids a non-admin from managing keys', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');
    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ name: 'x' });
    expect(res.status).toBe(403);
  });

  it('creates a ticket via the public API using the key (create-or-get customer)', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const key = (await createKey(adminToken)).body.data.key as string;

    const res = await request(app)
      .post('/api/public/v1/tickets')
      .set('x-api-key', key)
      .send({
        customer: { email: 'buyer@example.com', name: 'Buyer' },
        subject: 'API created ticket',
        priority: 'HIGH',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.ticket).toMatchObject({ subject: 'API created ticket', priority: 'HIGH' });

    // Visible through the authenticated API in the same org.
    const listed = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listed.body.data.tickets).toHaveLength(1);
  });

  it('rejects requests without/with an invalid API key', async () => {
    const none = await request(app).get('/api/public/v1/tickets');
    expect(none.status).toBe(401);
    const bad = await request(app).get('/api/public/v1/tickets').set('x-api-key', 'hlpk_nope');
    expect(bad.status).toBe(401);
  });

  it('stops working after the key is revoked', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const created = await createKey(adminToken);
    const key = created.body.data.key as string;
    const id = created.body.data.apiKey.id as string;

    await request(app).delete(`/api/api-keys/${id}`).set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app).get('/api/public/v1/tickets').set('x-api-key', key);
    expect(res.status).toBe(401);
  });
});
