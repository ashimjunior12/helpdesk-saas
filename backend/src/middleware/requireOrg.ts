import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';

// Guards routes that operate on organization-scoped data. Runs after
// requireAuth; downstream handlers can rely on req.user.organizationId being set
// and must scope every query by it for tenant isolation.
export function requireOrg(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }
  if (!req.user.organizationId) {
    throw new AppError(403, 'ORG_REQUIRED', 'You must belong to an organization to do this');
  }
  next();
}
