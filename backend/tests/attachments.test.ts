import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/db.js';
import { bootstrapOrg, createMemberAndLogin } from './helpers/auth.js';

describe('Attachments', () => {
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

  async function seedTicket(token: string, email = 'cust@buyer.com') {
    const customer = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cust', email });
    const ticket = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Help', customerId: customer.body.data.customer.id });
    return ticket.body.data.ticket.id as string;
  }

  function attach(token: string, ticketId: string, contentType = 'text/plain') {
    return request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello world'), { filename: 'note.txt', contentType });
  }

  it('uploads a file and returns metadata without the stored name', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const ticketId = await seedTicket(adminToken);

    const res = await attach(adminToken, ticketId);
    expect(res.status).toBe(201);
    expect(res.body.data.attachment).toMatchObject({
      filename: 'note.txt',
      mimeType: 'text/plain',
      size: 11,
    });
    expect(res.body.data.attachment).not.toHaveProperty('storedName');
  });

  it('rejects a disallowed file type with 400', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const ticketId = await seedTicket(adminToken);
    const res = await attach(adminToken, ticketId, 'application/octet-stream');
    expect(res.status).toBe(400);
  });

  it('lists and downloads an attachment', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const ticketId = await seedTicket(adminToken);
    const created = await attach(adminToken, ticketId);
    const id = created.body.data.attachment.id as string;

    const listed = await request(app)
      .get(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listed.body.data.attachments).toHaveLength(1);

    const dl = await request(app)
      .get(`/api/tickets/${ticketId}/attachments/${id}/download`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toContain('note.txt');
    expect(dl.text).toBe('hello world');
  });

  it('isolates attachments across organizations', async () => {
    const orgA = await bootstrapOrg(app, 'a@example.com', 'Org A');
    const ticketId = await seedTicket(orgA.adminToken, 'a-cust@buyer.com');
    await attach(orgA.adminToken, ticketId);

    const orgB = await bootstrapOrg(app, 'b@example.com', 'Org B');
    const res = await request(app)
      .get(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${orgB.adminToken}`);
    expect(res.status).toBe(404);
  });

  it('forbids an AGENT from deleting and allows a MANAGER', async () => {
    const { adminToken } = await bootstrapOrg(app);
    const agent = await createMemberAndLogin(app, adminToken, 'agent@example.com', 'AGENT');
    const manager = await createMemberAndLogin(app, adminToken, 'manager@example.com', 'MANAGER');
    const ticketId = await seedTicket(adminToken);
    const created = await attach(adminToken, ticketId);
    const id = created.body.data.attachment.id as string;

    const forbidden = await request(app)
      .delete(`/api/tickets/${ticketId}/attachments/${id}`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(forbidden.status).toBe(403);

    const ok = await request(app)
      .delete(`/api/tickets/${ticketId}/attachments/${id}`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(ok.status).toBe(204);
  });
});
