import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';
import type { UserRole } from '../modules/auth/user.model.js';

// Authorization guard. Runs after requireAuth (and usually requireOrg) and
// allows the request only if the caller's role is one of the listed roles.
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required');
    }
    // The platform super admin bypasses org-role checks (full access).
    if (req.user.role === 'SUPER_ADMIN') {
      next();
      return;
    }
    if (!req.user.role || !roles.includes(req.user.role)) {
      throw AppError.forbidden();
    }
    next();
  };
}
