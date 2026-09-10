import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getPolicy, updatePolicy } from './sla.service.js';
import type { UpdateSlaPolicyInput } from './sla.validation.js';
import type { SlaTargets } from './slaPolicy.model.js';

export const get = asyncHandler(async (req: Request, res: Response) => {
  const policy = await getPolicy(req.user!.organizationId!);
  res.status(200).json({ success: true, data: { policy } });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { targets } = req.body as UpdateSlaPolicyInput;
  const policy = await updatePolicy(req.user!.organizationId!, targets as SlaTargets);
  res.status(200).json({ success: true, data: { policy } });
});
