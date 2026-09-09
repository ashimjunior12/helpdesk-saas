import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { UserModel } from '../auth/user.model.js';
import { issueTokenPair, type AuthenticatedUser } from '../auth/token.service.js';
import { OrganizationModel, type OrganizationDocument } from './organization.model.js';

interface CreateOrganizationResult {
  organization: OrganizationDocument;
  accessToken: string;
  refreshToken: string;
}

// Creates an organization and makes the caller its first member (ADMIN). The
// caller's tokens are reissued so their new organization/role context takes
// effect immediately without waiting for the old access token to expire.
export async function createOrganization(
  userId: string,
  name: string,
): Promise<CreateOrganizationResult> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw AppError.unauthorized();
  }
  if (user.organizationId) {
    throw new AppError(409, 'ALREADY_IN_ORGANIZATION', 'You already belong to an organization');
  }

  const organization = await OrganizationModel.create({ name });

  try {
    user.organizationId = organization._id;
    user.role = 'ADMIN';
    await user.save();
  } catch (err) {
    // No multi-document transaction here, so undo the org if linking the user
    // fails, rather than leaving an orphaned organization behind.
    await OrganizationModel.deleteOne({ _id: organization._id });
    throw err;
  }

  logger.info(
    { operation: 'organization.create', userId, organizationId: organization.id },
    'Organization created',
  );

  const identity: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    organizationId: organization.id,
    role: user.role,
  };
  return { organization, ...issueTokenPair(identity) };
}

// Looks up an organization by id but only within the caller's tenant. A
// mismatch returns "not found" rather than "forbidden" so we never confirm the
// existence of another tenant's organization.
export async function getOrganizationForUser(
  organizationId: string,
  requestedId: string,
): Promise<OrganizationDocument> {
  if (organizationId !== requestedId) {
    throw AppError.notFound('Organization not found');
  }
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw AppError.notFound('Organization not found');
  }
  return organization;
}

export async function updateOrganization(
  organizationId: string,
  name: string,
): Promise<OrganizationDocument> {
  const organization = await OrganizationModel.findByIdAndUpdate(
    organizationId,
    { name },
    { new: true, runValidators: true },
  );
  if (!organization) {
    throw AppError.notFound('Organization not found');
  }
  return organization;
}
