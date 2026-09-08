import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

type TokenType = 'access' | 'refresh';

interface TokenPayload {
  sub: string;
  type: TokenType;
  email?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

const accessTtl = env.JWT_ACCESS_TTL as SignOptions['expiresIn'];
const refreshTtl = env.JWT_REFRESH_TTL as SignOptions['expiresIn'];

export function signAccessToken(user: AuthenticatedUser): string {
  const payload: TokenPayload = { sub: user.id, email: user.email, type: 'access' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: accessTtl });
}

export function signRefreshToken(userId: string): string {
  const payload: TokenPayload = { sub: userId, type: 'refresh' };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: refreshTtl });
}

export function issueTokenPair(user: AuthenticatedUser): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user.id),
  };
}

export function verifyAccessToken(token: string): AuthenticatedUser {
  const payload = verify(token, env.JWT_ACCESS_SECRET);
  if (payload.type !== 'access' || !payload.email) {
    throw AppError.unauthorized('Invalid access token');
  }
  return { id: payload.sub, email: payload.email };
}

export function verifyRefreshToken(token: string): { userId: string } {
  const payload = verify(token, env.JWT_REFRESH_SECRET);
  if (payload.type !== 'refresh') {
    throw AppError.unauthorized('Invalid refresh token');
  }
  return { userId: payload.sub };
}

function verify(token: string, secret: string): TokenPayload {
  try {
    return jwt.verify(token, secret) as unknown as TokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Token has expired');
    }
    throw AppError.unauthorized('Invalid or malformed token');
  }
}
