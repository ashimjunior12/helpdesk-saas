import { z } from 'zod';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getOverview } from './analytics.service.js';

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const overview = asyncHandler(async (req: Request, res: Response) => {
  const { days } = querySchema.parse(req.query);
  const data = await getOverview(req.user!.organizationId!, days);
  res.status(200).json({ success: true, data });
});
