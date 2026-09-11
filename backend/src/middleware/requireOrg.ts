import { Types } from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { OrganizationModel } from '../modules/organizations/organization.model.js';

// Guards routes that operate on organization-scoped data. Runs after requireAuth.
//
// For a normal user, the organization comes from their token. The platform
// SUPER_ADMIN has no organization of their own, so they select one per request
// via the `X-Organization-Id` header (or `organizationId` query param); the
// header is validated and set as the effective org context, giving the super
// admin full access to any organization's data through the same handlers.
export const requireOrg = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required');
    }

    if (req.user.role === 'SUPER_ADMIN') {
      const requested =
        req.header('x-organization-id') ?? (req.query.organizationId as string | undefined);
      if (!requested) {
        throw new AppError(
          400,
          'ORG_CONTEXT_REQUIRED',
          'Select an organization (X-Organization-Id header) to access its data',
        );
      }
      if (!Types.ObjectId.isValid(requested) || !(await OrganizationModel.exists({ _id: requested }))) {
        throw AppError.notFound('Organization not found');
      }
      req.user.organizationId = requested;
      next();
      return;
    }

    if (!req.user.organizationId) {
      throw new AppError(403, 'ORG_REQUIRED', 'You must belong to an organization to do this');
    }
    next();
  },
);
