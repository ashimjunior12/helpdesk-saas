import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { UserModel, type UserDocument } from '../auth/user.model.js';
import { hashPassword } from '../auth/password.js';
import { TicketModel } from '../tickets/ticket.model.js';
import { TeamModel } from '../teams/team.model.js';
import type { CreateUserInput, UpdateUserInput } from './users.validation.js';

const MONGO_DUPLICATE_KEY = 11000;

// Creates a member inside the acting admin's organization. The new user logs in
// with the provided credentials via /auth/login (no tokens are issued here).
export async function createUser(
  organizationId: string,
  input: CreateUserInput,
): Promise<UserDocument> {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await UserModel.create({
      email: input.email,
      name: input.name,
      passwordHash,
      role: input.role,
      organizationId,
      isActive: true,
    });
    logger.info(
      { operation: 'users.create', organizationId, userId: user.id, role: input.role },
      'User created',
    );
    return user;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw err;
  }
}

export function listUsers(organizationId: string): Promise<UserDocument[]> {
  return UserModel.find({ organizationId }).sort({ createdAt: 1 });
}

export async function getUser(organizationId: string, userId: string): Promise<UserDocument> {
  const user = await UserModel.findOne({ _id: userId, organizationId });
  if (!user) {
    throw AppError.notFound('User not found');
  }
  return user;
}

// Updates another member's role and/or active status. Modifying yourself is
// rejected, which also guarantees the organization always keeps at least one
// active admin (the acting admin), so no separate last-admin check is needed.
export async function updateUser(
  organizationId: string,
  actorUserId: string,
  targetUserId: string,
  input: UpdateUserInput,
): Promise<UserDocument> {
  if (actorUserId === targetUserId) {
    throw new AppError(400, 'CANNOT_MODIFY_SELF', 'You cannot modify your own role or status');
  }

  const user = await UserModel.findOne({ _id: targetUserId, organizationId });
  if (!user) {
    throw AppError.notFound('User not found');
  }

  if (input.role !== undefined) {
    user.role = input.role;
  }
  if (input.isActive !== undefined) {
    user.isActive = input.isActive;
  }
  await user.save();

  logger.info(
    { operation: 'users.update', organizationId, actorUserId, userId: user.id },
    'User updated',
  );
  return user;
}

// Deletes a member from an organization. Deleting yourself is rejected. Their
// references are detached first: assigned tickets are unassigned and they are
// removed from any teams (message/note authorship is left as historical record).
export async function deleteUser(
  organizationId: string,
  actorUserId: string,
  targetUserId: string,
): Promise<void> {
  if (actorUserId === targetUserId) {
    throw new AppError(400, 'CANNOT_DELETE_SELF', 'You cannot delete your own account');
  }

  const user = await UserModel.findOne({ _id: targetUserId, organizationId });
  if (!user) {
    throw AppError.notFound('User not found');
  }

  await TicketModel.updateMany(
    { organizationId, assignedAgentId: targetUserId },
    { assignedAgentId: null },
  );
  await TeamModel.updateMany({ organizationId, memberIds: targetUserId }, {
    $pull: { memberIds: targetUserId },
  });
  await user.deleteOne();

  logger.info(
    { operation: 'users.delete', organizationId, actorUserId, userId: targetUserId },
    'User deleted',
  );
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: number }).code === MONGO_DUPLICATE_KEY
  );
}
