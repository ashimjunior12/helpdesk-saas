import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { loginUser, refreshTokens, registerUser } from './auth.service.js';
import type { LoginInput, RefreshInput, RegisterInput } from './auth.validation.js';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await registerUser(req.body as RegisterInput);
  res.status(201).json({ success: true, data: result });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await loginUser(req.body as LoginInput);
  res.status(200).json({ success: true, data: result });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as RefreshInput;
  const result = await refreshTokens(refreshToken);
  res.status(200).json({ success: true, data: result });
});

// Stateless: tokens are not stored, so there is nothing to revoke server-side.
export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: { message: 'Logged out. Discard your tokens on the client.' },
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw AppError.unauthorized();
  }
  res.status(200).json({ success: true, data: { user: req.user } });
});
