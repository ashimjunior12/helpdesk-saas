import request from 'supertest';
import type { Application } from 'express';

const PASSWORD = 'sup3rsecret';

interface Bootstrapped {
  adminToken: string;
  adminUserId: string;
  organizationId: string;
}

// Registers a user, creates their organization (they become ADMIN), and returns
// the org-scoped admin token.
export async function bootstrapOrg(
  app: Application,
  email = 'admin@example.com',
  orgName = 'Acme Inc',
): Promise<Bootstrapped> {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email, password: PASSWORD, name: 'Admin User' });

  const created = await request(app)
    .post('/api/organizations')
    .set('Authorization', `Bearer ${reg.body.data.accessToken}`)
    .send({ name: orgName });

  return {
    adminToken: created.body.data.accessToken,
    adminUserId: reg.body.data.user.id,
    organizationId: created.body.data.organization.id,
  };
}

// Creates an org member with the given role (as the admin) and logs in as that
// member, returning both the member's id and an org-scoped token for them.
export async function createMemberAndLogin(
  app: Application,
  adminToken: string,
  email: string,
  role: 'ADMIN' | 'MANAGER' | 'AGENT',
): Promise<{ token: string; userId: string }> {
  const created = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email, name: `${role} User`, password: PASSWORD, role });

  const login = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });

  return { token: login.body.data.accessToken, userId: created.body.data.user.id };
}
