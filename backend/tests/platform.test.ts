import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { ensureSuperAdmin } from '../src/modules/platform/seedSuperAdmin.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg } from './helpers/auth.js';

const SUPER_EMAIL = 'bhattaraiashim789@gmail.com';
const SUPER_PASSWORD = 'Random123';

describe('Platform (super admin)', () => {
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

  async function superAdminToken(): Promise<string> {
    await ensureSuperAdmin();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SUPER_EMAIL, password: SUPER_PASSWORD });
    return res.body.data.accessToken as string;
  }

  it('seeds a super admin who can log in (idempotent)', async () => {
    await ensureSuperAdmin();
    await ensureSuperAdmin(); // second call must not create a duplicate or throw
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SUPER_EMAIL, password: SUPER_PASSWORD });
    expect(res.status).toBe(200);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`);
    expect(me.body.data.user.role).toBe('SUPER_ADMIN');
    expect(me.body.data.user.organizationId).toBeNull();
  });

  it('lets the super admin create an organization and provision its admin', async () => {
    const token = await superAdminToken();

    const org = await request(app)
      .post('/api/platform/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Acme Inc' });
    expect(org.status).toBe(201);
    const orgId = org.body.data.organization.id as string;

    const list = await request(app)
      .get('/api/platform/organizations')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.data.organizations).toHaveLength(1);
    expect(list.body.data.organizations[0].memberCount).toBe(0);

    const created = await request(app)
      .post(`/api/platform/organizations/${orgId}/users`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'admin@acme.com', name: 'Acme Admin', password: 'sup3rsecret', role: 'ADMIN' });
    expect(created.status).toBe(201);
    expect(created.body.data.user.role).toBe('ADMIN');

    // The provisioned admin can log in and is scoped to that organization.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@acme.com', password: 'sup3rsecret' });
    expect(login.status).toBe(200);
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(String(me.body.data.user.organizationId)).toBe(orgId);
    expect(me.body.data.user.role).toBe('ADMIN');
  });

  it('forbids a normal org admin from using the platform API', async () => {
    const { adminToken } = await bootstrapOrg(app, 'owner@example.com', 'Owner Co');
    const res = await request(app)
      .get('/api/platform/organizations')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('gives the super admin full access to an organization data via X-Organization-Id', async () => {
    const token = await superAdminToken();
    const org = await request(app)
      .post('/api/platform/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Acme Inc' });
    const orgId = org.body.data.organization.id as string;

    // Without selecting an org, org-scoped access is refused.
    const noCtx = await request(app).get('/api/tickets').set('Authorization', `Bearer ${token}`);
    expect(noCtx.status).toBe(400);
    expect(noCtx.body.error.code).toBe('ORG_CONTEXT_REQUIRED');

    // With the header, the super admin acts inside that org (create + read),
    // bypassing org-role checks.
    const customer = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({ name: 'Cust', email: 'cust@buyer.com' });
    expect(customer.status).toBe(201);

    const ticket = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({ subject: 'Super admin ticket', customerId: customer.body.data.customer.id });
    expect(ticket.status).toBe(201);

    const list = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId);
    expect(list.status).toBe(200);
    expect(list.body.data.tickets).toHaveLength(1);
  });

  it('rejects creating a user in a non-existent organization', async () => {
    const token = await superAdminToken();
    const res = await request(app)
      .post('/api/platform/organizations/000000000000000000000000/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'x@y.com', name: 'X', password: 'sup3rsecret', role: 'ADMIN' });
    expect(res.status).toBe(404);
  });
});
