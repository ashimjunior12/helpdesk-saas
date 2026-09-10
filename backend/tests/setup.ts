// Provide the minimum environment the app needs before any module (which
// validates env at import time) is loaded. Runs via jest `setupFiles`.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/helpdesk_test';
process.env.LOG_LEVEL = 'fatal';

// Auth secrets required by config/env.ts. Fixed test values (never real secrets).
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-at-least-32-characters-different';

// Isolate uploaded files to a throwaway directory during tests.
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR ?? `${require('node:os').tmpdir()}/helpdesk-test-uploads`;
