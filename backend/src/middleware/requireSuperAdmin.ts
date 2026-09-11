import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';

// Platform-level guard: only the SUPER_ADMIN (who has no organization) may pass.
// Used for the /api/platform endpoints that manage organizations and provision
// their admins/managers.
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }
  if (req.user.role !== 'SUPER_ADMIN') {
    throw AppError.forbidden();
  }
  next();
}
