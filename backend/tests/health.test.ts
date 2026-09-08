import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';

/**
 * Integration tests for the Phase 0 foundation.
 *
 * These run against the fully wired Express app but without a live MongoDB
 * connection, so the health probe deterministically reports the database as
 * "down" and returns 503 — verifying the readiness logic and the standard
 * response envelopes end to end.
 */
describe('Foundation', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /api/health', () => {
    it('returns a structured health payload', async () => {
      const res = await request(app).get('/api/health');

      // No DB connected in the test process => degraded/503.
      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.data.status).toBe('degraded');
      expect(res.body.data.dependencies.database).toBe('down');
      expect(typeof res.body.data.uptimeSeconds).toBe('number');
      expect(typeof res.body.data.timestamp).toBe('string');
    });

    it('echoes a correlation id header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('unmatched routes', () => {
    it('returns the standard 404 error envelope', async () => {
      const res = await request(app).get('/api/does-not-exist');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.requestId).toBeDefined();
    });
  });
});
