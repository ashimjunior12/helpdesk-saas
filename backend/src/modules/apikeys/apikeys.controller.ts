import { z } from 'zod';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createApiKey, listApiKeys, revokeApiKey } from './apikeys.service.js';

const createSchema = z.object({ name: z.string().trim().min(1).max(120) });

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { name } = createSchema.parse(req.body);
  const { apiKey, key } = await createApiKey(req.user!.organizationId!, req.user!.id, name);
  // `key` is returned only here, once.
  res.status(201).json({ success: true, data: { apiKey, key } });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const apiKeys = await listApiKeys(req.user!.organizationId!);
  res.status(200).json({ success: true, data: { apiKeys } });
});

export const revoke = asyncHandler(async (req: Request, res: Response) => {
  const apiKey = await revokeApiKey(req.user!.organizationId!, req.params.id);
  res.status(200).json({ success: true, data: { apiKey } });
});
