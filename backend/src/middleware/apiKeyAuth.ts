import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyApiKey } from '../modules/apikeys/apikeys.service.js';

// Authenticates a request by its `x-api-key` header and attaches the key's
// organization context to req.apiKey. Public API routes scope everything by it.
export const apiKeyAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const raw = req.header('x-api-key');
    if (!raw) {
      throw AppError.unauthorized('API key required');
    }
    const apiKey = await verifyApiKey(raw);
    if (!apiKey) {
      throw AppError.unauthorized('Invalid API key');
    }
    req.apiKey = { id: apiKey.id, organizationId: String(apiKey.organizationId) };
    next();
  },
);
