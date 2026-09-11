import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createOrganization,
  createOrganizationUser,
  deleteOrganizationUser,
  listOrganizations,
  listOrganizationUsers,
} from './platform.service.js';
import type { CreateOrganizationInput } from './platform.validation.js';
import type { CreateUserInput } from '../users/users.validation.js';

export const listOrgs = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await listOrganizations();
  const organizations = rows.map((r) => ({ ...r.organization.toJSON(), memberCount: r.memberCount }));
  res.status(200).json({ success: true, data: { organizations } });
});

export const createOrg = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body as CreateOrganizationInput;
  const organization = await createOrganization(name);
  res.status(201).json({ success: true, data: { organization } });
});

export const listOrgUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await listOrganizationUsers(req.params.orgId);
  res.status(200).json({ success: true, data: { users } });
});

export const createOrgUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await createOrganizationUser(req.params.orgId, req.body as CreateUserInput);
  res.status(201).json({ success: true, data: { user } });
});

export const deleteOrgUser = asyncHandler(async (req: Request, res: Response) => {
  await deleteOrganizationUser(req.params.orgId, req.user!.id, req.params.userId);
  res.status(204).send();
});
