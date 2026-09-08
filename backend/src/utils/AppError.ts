/**
 * Application-level error carrying a stable machine-readable `code`, an
 * HTTP `statusCode`, and a human `message` that is safe to send to clients.
 *
 * Throw this anywhere in the request lifecycle; the centralized error
 * middleware turns it into the standard error response envelope.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  /** True for errors we raise deliberately (safe to expose to the client). */
  public readonly isOperational: boolean;
  /** Optional structured detail (e.g. Zod validation issues). */
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string) {
    return new AppError(409, 'CONFLICT', message);
  }

  static internal(message = 'Internal server error') {
    return new AppError(500, 'INTERNAL_ERROR', message);
  }
}
