import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { UserModel } from '../auth/user.model.js';
import { TeamModel, type TeamDocument } from './team.model.js';

const MONGO_DUPLICATE_KEY = 11000;

export async function createTeam(organizationId: string, name: string): Promise<TeamDocument> {
  try {
    const team = await TeamModel.create({ organizationId, name, memberIds: [] });
    logger.info({ operation: 'teams.create', organizationId, teamId: team.id }, 'Team created');
    return team;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(409, 'TEAM_NAME_TAKEN', 'A team with this name already exists');
    }
    throw err;
  }
}

export function listTeams(organizationId: string): Promise<TeamDocument[]> {
  return TeamModel.find({ organizationId }).sort({ createdAt: 1 });
}

export async function getTeam(organizationId: string, teamId: string): Promise<TeamDocument> {
  const team = await TeamModel.findOne({ _id: teamId, organizationId });
  if (!team) {
    throw AppError.notFound('Team not found');
  }
  return team;
}

export async function updateTeam(
  organizationId: string,
  teamId: string,
  name: string,
): Promise<TeamDocument> {
  try {
    const team = await TeamModel.findOneAndUpdate(
      { _id: teamId, organizationId },
      { name },
      { new: true, runValidators: true },
    );
    if (!team) {
      throw AppError.notFound('Team not found');
    }
    return team;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(409, 'TEAM_NAME_TAKEN', 'A team with this name already exists');
    }
    throw err;
  }
}

export async function deleteTeam(organizationId: string, teamId: string): Promise<void> {
  const result = await TeamModel.deleteOne({ _id: teamId, organizationId });
  if (result.deletedCount === 0) {
    throw AppError.notFound('Team not found');
  }
  logger.info({ operation: 'teams.delete', organizationId, teamId }, 'Team deleted');
}

// Adds a member, but only a user who belongs to the same organization, so a team
// can never reference a user from another tenant. $addToSet keeps it idempotent.
export async function addMember(
  organizationId: string,
  teamId: string,
  userId: string,
): Promise<TeamDocument> {
  const team = await getTeam(organizationId, teamId);

  const isMemberOfOrg = await UserModel.exists({ _id: userId, organizationId });
  if (!isMemberOfOrg) {
    throw AppError.notFound('User not found');
  }

  await team.updateOne({ $addToSet: { memberIds: userId } });
  return getTeam(organizationId, teamId);
}

export async function removeMember(
  organizationId: string,
  teamId: string,
  userId: string,
): Promise<TeamDocument> {
  const team = await getTeam(organizationId, teamId);
  await team.updateOne({ $pull: { memberIds: userId } });
  return getTeam(organizationId, teamId);
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: number }).code === MONGO_DUPLICATE_KEY
  );
}
