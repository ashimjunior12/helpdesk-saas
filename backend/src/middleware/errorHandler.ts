import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Standard error response envelope:
 *   { success: false, error: { code, message, details?, requestId } }
 *
 * Centralizing this here means controllers never format errors themselves and
 * we never leak stack traces or internal messages to clients in production.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // Express identifies error middleware by its four-arg signature, so `next`
  // must stay even though it is unused.
  _next: NextFunction,
): void {
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof ZodError) {
    appError = AppError.badRequest('Validation failed', err.flatten());
  } else {
    // Unknown/unexpected error: log the full detail, but expose a generic
    // message so internals never reach the client.
    appError = AppError.internal();
  }

  const logPayload = {
    requestId: req.id,
    operation: `${req.method} ${req.originalUrl}`,
    statusCode: appError.statusCode,
    code: appError.code,
    err,
  };

  if (appError.statusCode >= 500) {
    logger.error(logPayload, 'Request failed');
  } else {
    logger.warn(logPayload, 'Request rejected');
  }

  res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
      requestId: req.id,
      // Stack only in non-production to aid local debugging.
      ...(!env.isProduction && appError.statusCode >= 500 && err instanceof Error
        ? { stack: err.stack }
        : {}),
    },
  });
}
