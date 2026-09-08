// Provide the minimum environment the app needs before any module (which
// validates env at import time) is loaded. Runs via jest `setupFiles`.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/helpdesk_test';
process.env.LOG_LEVEL = 'fatal';
