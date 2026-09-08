import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../utils/AppError.js';
import { verifyAccessToken } from './token.service.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw AppError.unauthorized('Authentication required');
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw AppError.unauthorized('Authentication required');
  }

  req.user = verifyAccessToken(token);
  next();
}
