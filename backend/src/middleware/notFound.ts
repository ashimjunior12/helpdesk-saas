import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';

/** Any request that matches no route becomes a standard 404 AppError. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}
