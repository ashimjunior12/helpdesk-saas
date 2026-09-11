import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { OrganizationModel, type OrganizationDocument } from '../organizations/organization.model.js';
import { UserModel, type UserDocument } from '../auth/user.model.js';
import { createUser, deleteUser } from '../users/users.service.js';
import type { CreateUserInput } from '../users/users.validation.js';

export interface OrganizationWithCount {
  organization: OrganizationDocument;
  memberCount: number;
}

export async function listOrganizations(): Promise<OrganizationWithCount[]> {
  const organizations = await OrganizationModel.find().sort({ createdAt: -1 });
  return Promise.all(
    organizations.map(async (organization) => ({
      organization,
      memberCount: await UserModel.countDocuments({ organizationId: organization.id }),
    })),
  );
}

export async function createOrganization(name: string): Promise<OrganizationDocument> {
  const organization = await OrganizationModel.create({ name });
  logger.info({ operation: 'platform.org.create', organizationId: organization.id }, 'Organization created by super admin');
  return organization;
}

async function assertOrganization(organizationId: string): Promise<void> {
  if (!(await OrganizationModel.exists({ _id: organizationId }))) {
    throw AppError.notFound('Organization not found');
  }
}

export async function listOrganizationUsers(organizationId: string): Promise<UserDocument[]> {
  await assertOrganization(organizationId);
  return UserModel.find({ organizationId }).sort({ createdAt: 1 });
}

// Provisions a member (ADMIN / MANAGER / AGENT) in any organization. Reuses the
// same creation logic as an org admin, but the super admin chooses the org.
export async function createOrganizationUser(
  organizationId: string,
  input: CreateUserInput,
): Promise<UserDocument> {
  await assertOrganization(organizationId);
  return createUser(organizationId, input);
}

// Deletes any member (admin/manager/agent) of an organization on behalf of the
// super admin.
export async function deleteOrganizationUser(
  organizationId: string,
  actorUserId: string,
  targetUserId: string,
): Promise<void> {
  await assertOrganization(organizationId);
  await deleteUser(organizationId, actorUserId, targetUserId);
}
