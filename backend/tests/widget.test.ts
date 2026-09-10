import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg, createMemberAndLogin } from './helpers/auth.js';

describe('Support widget', () => {
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

  const getConfig = (token: string) =>
    request(app).get('/api/widget-config').set('Authorization', `Bearer ${token}`);

  it('provisions a config with a public key and lets ADMIN update it', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const res = await getConfig(adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data.config.publicKey).toMatch(/^wgt_/);

    const updated = await request(app)
      .put('/api/widget-config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Talk to us', primaryColor: '#111827' });
    expect(updated.body.data.config.title).toBe('Talk to us');
  });

  it('forbids a non-admin from configuring the widget', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');
    const res = await request(app)
      .put('/api/widget-config')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ title: 'x' });
    expect(res.status).toBe(403);
  });

  it('serves public display config and accepts a public submission', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const publicKey = (await getConfig(adminToken)).body.data.config.publicKey as string;

    const cfg = await request(app).get(`/api/public/widget/${publicKey}/config`);
    expect(cfg.status).toBe(200);
    expect(cfg.body.data.config).toHaveProperty('title');
    expect(cfg.body.data.config).not.toHaveProperty('publicKey');

    const submit = await request(app)
      .post(`/api/public/widget/${publicKey}/tickets`)
      .send({ name: 'Sam', email: 'sam@buyer.com', subject: 'Broken link', message: 'The docs link 404s.' });
    expect(submit.status).toBe(201);
    expect(submit.body.data.ticketNumber).toBe(1);

    // The ticket exists in the org.
    const tickets = await request(app).get('/api/tickets').set('Authorization', `Bearer ${adminToken}`);
    expect(tickets.body.data.tickets).toHaveLength(1);
  });

  it('rejects an unknown public key and disabled widgets', async () => {
    const unknown = await request(app).get('/api/public/widget/wgt_nope/config');
    expect(unknown.status).toBe(404);

    const { adminToken } = await bootstrapOrg(app);
    const publicKey = (await getConfig(adminToken)).body.data.config.publicKey as string;
    await request(app)
      .put('/api/widget-config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: false });

    const disabled = await request(app).get(`/api/public/widget/${publicKey}/config`);
    expect(disabled.status).toBe(404);
  });

  it('rotating the key invalidates the old one', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const oldKey = (await getConfig(adminToken)).body.data.config.publicKey as string;
    const rotated = await request(app)
      .post('/api/widget-config/rotate-key')
      .set('Authorization', `Bearer ${adminToken}`);
    const newKey = rotated.body.data.config.publicKey as string;
    expect(newKey).not.toBe(oldKey);

    expect((await request(app).get(`/api/public/widget/${oldKey}/config`)).status).toBe(404);
    expect((await request(app).get(`/api/public/widget/${newKey}/config`)).status).toBe(200);
  });
});
