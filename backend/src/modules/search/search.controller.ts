import { z } from 'zod';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { search } from './search.service.js';

const querySchema = z.object({
  q: z.string().trim().min(1, 'A search query (q) is required').max(200),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export const searchAll = asyncHandler(async (req: Request, res: Response) => {
  const { q, limit } = querySchema.parse(req.query);
  const { tickets, customers } = await search(req.user!.organizationId!, q, limit);
  res.status(200).json({ success: true, data: { query: q, tickets, customers } });
});
