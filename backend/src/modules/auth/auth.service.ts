import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { UserModel, type UserDocument } from './user.model.js';
import { hashPassword, verifyPassword } from './password.js';
import { issueTokenPair, verifyRefreshToken, type AuthenticatedUser } from './token.service.js';
import type { LoginInput, RegisterInput } from './auth.validation.js';

const MONGO_DUPLICATE_KEY = 11000;

interface AuthResult {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

function toPublicUser(user: UserDocument): AuthResult['user'] {
  return { id: user.id, email: user.email, name: user.name };
}

function toAuthResult(user: UserDocument): AuthResult {
  const identity: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    organizationId: user.organizationId ? String(user.organizationId) : null,
    role: user.role ?? null,
  };
  return { user: toPublicUser(user), ...issueTokenPair(identity) };
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await UserModel.create({
      email: input.email,
      passwordHash,
      name: input.name,
    });
    logger.info({ operation: 'auth.register', userId: user.id }, 'User registered');
    return toAuthResult(user);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw err;
  }
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');

  // Compare even when the user is missing so response timing does not reveal
  // whether an email exists.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const passwordMatches = await verifyPassword(input.password, hash);

  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  if (!user.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  }

  logger.info({ operation: 'auth.login', userId: user.id }, 'User logged in');
  return toAuthResult(user);
}

export async function refreshTokens(refreshToken: string): Promise<AuthResult> {
  const { userId } = verifyRefreshToken(refreshToken);

  const user = await UserModel.findById(userId);
  if (!user) {
    throw AppError.unauthorized('Invalid refresh token');
  }
  if (!user.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  }

  return toAuthResult(user);
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: number }).code === MONGO_DUPLICATE_KEY
  );
}

// Valid bcrypt hash of a throwaway string; keeps login timing constant when the
// email does not exist. Never matches a real password.
const DUMMY_HASH = '$2b$12$asVLXdlzhG3PrukZSVX7GuilSsVzZUzrvkvdlNtMYr9Lw1oaUW1dy';
