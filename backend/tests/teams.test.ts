import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg, createMemberAndLogin } from './helpers/auth.js';

describe('Teams', () => {
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

  async function createTeam(token: string, name: string) {
    return request(app).post('/api/teams').set('Authorization', `Bearer ${token}`).send({ name });
  }

  describe('authorization', () => {
    it('lets a MANAGER create a team', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const manager = await createMemberAndLogin(app, adminToken, 'manager@example.com', 'MANAGER');

      const res = await createTeam(manager.token, 'Billing');
      expect(res.status).toBe(201);
      expect(res.body.data.team).toMatchObject({ name: 'Billing', memberIds: [] });
    });

    it('forbids an AGENT from creating a team', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');

      const res = await createTeam(agent.token, 'Billing');
      expect(res.status).toBe(403);
    });

    it('lets any role list teams', async () => {
      const { adminToken } = await bootstrapOrg(app);
      await createTeam(adminToken, 'Support');
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');

      const res = await request(app).get('/api/teams').set('Authorization', `Bearer ${agent.token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.teams).toHaveLength(1);
    });
  });

  describe('constraints and lifecycle', () => {
    it('rejects a duplicate team name within the org', async () => {
      const { adminToken } = await bootstrapOrg(app);
      await createTeam(adminToken, 'Support');
      const res = await createTeam(adminToken, 'Support');
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TEAM_NAME_TAKEN');
    });

    it('renames and deletes a team', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const team = await createTeam(adminToken, 'Old');
      const id = team.body.data.team.id as string;

      const patch = await request(app)
        .patch(`/api/teams/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New' });
      expect(patch.status).toBe(200);
      expect(patch.body.data.team.name).toBe('New');

      const del = await request(app)
        .delete(`/api/teams/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(del.status).toBe(204);
    });
  });

  describe('membership', () => {
    it('adds and removes a member from the same org', async () => {
      const { adminToken } = await bootstrapOrg(app);
      const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');
      const team = await createTeam(adminToken, 'Support');
      const teamId = team.body.data.team.id as string;

      const add = await request(app)
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: agent.userId });
      expect(add.status).toBe(200);
      expect(add.body.data.team.memberIds).toContain(agent.userId);

      const remove = await request(app)
        .delete(`/api/teams/${teamId}/members/${agent.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(remove.status).toBe(200);
      expect(remove.body.data.team.memberIds).not.toContain(agent.userId);
    });

    it('cannot add a user from another organization', async () => {
      const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
      const team = await createTeam(orgA.adminToken, 'Support');
      const teamId = team.body.data.team.id as string;

      const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');
      const memberB = await createMemberAndLogin(app, orgB.adminToken, 'member-b@example.com', 'AGENT');

      const res = await request(app)
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${orgA.adminToken}`)
        .send({ userId: memberB.userId });
      expect(res.status).toBe(404);
    });
  });

  describe('tenant isolation', () => {
    it('returns 404 when accessing a team from another organization', async () => {
      const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
      const team = await createTeam(orgA.adminToken, 'Support');
      const teamId = team.body.data.team.id as string;

      const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');

      const res = await request(app)
        .get(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${orgB.adminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
