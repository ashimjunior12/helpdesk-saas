import type { Request, Response } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { env } from '../config/env.js';

// IP-based rate limiting. Skipped in the test environment so integration tests
// (which hammer login/create) stay deterministic. Uses the in-memory store,
// which is fine for a single instance; back it with Redis for multi-instance.
function makeLimiter(limit: number, windowMs = 60_000): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.isTest,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down', requestId: req.id },
      });
    },
  });
}

// Auth is brute-force sensitive; the public surfaces are unauthenticated.
export const authLimiter = makeLimiter(20);
export const publicApiLimiter = makeLimiter(100);
export const widgetLimiter = makeLimiter(20);
