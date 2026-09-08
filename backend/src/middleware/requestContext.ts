import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from '../utils/logger.js';

/**
 * Assigns every request a correlation id (honoring an inbound
 * `x-request-id` if the caller supplies one) and echoes it back on the
 * response. Downstream logs and error responses reference this id so a single
 * request can be traced end to end.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  req.id = incoming && incoming.length <= 200 ? incoming : randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}

/**
 * Structured HTTP request logging. Each log line carries the requestId and the
 * request duration, and we drop the default noisy Express fields. Auth headers
 * and cookies are already redacted by the logger config.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as Request).id,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
