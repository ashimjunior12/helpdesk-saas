import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app.js';

describe('Observability', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  it('exposes Prometheus metrics after handling a request', async () => {
    await request(app).get('/api/health/live');

    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_request_duration_seconds');
    // Default process metrics are registered too.
    expect(res.text).toContain('process_cpu_user_seconds_total');
  });

  it('serves a liveness probe that does not depend on the database', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('alive');
  });
});
