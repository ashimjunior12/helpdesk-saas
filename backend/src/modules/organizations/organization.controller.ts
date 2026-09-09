import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createOrganization,
  getOrganizationForUser,
  updateOrganization,
} from './organization.service.js';
import type { CreateOrganizationInput, UpdateOrganizationInput } from './organization.validation.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body as CreateOrganizationInput;
  const result = await createOrganization(req.user!.id, name);
  res.status(201).json({
    success: true,
    data: {
      organization: result.organization.toJSON(),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  });
});

export const getMine = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId!;
  const organization = await getOrganizationForUser(orgId, orgId);
  res.status(200).json({ success: true, data: { organization } });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const organization = await getOrganizationForUser(req.user!.organizationId!, req.params.id);
  res.status(200).json({ success: true, data: { organization } });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body as UpdateOrganizationInput;
  const organization = await updateOrganization(req.user!.organizationId!, name);
  res.status(200).json({ success: true, data: { organization } });
});
