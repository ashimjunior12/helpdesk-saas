import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createRule, deleteRule, getRule, listRules, updateRule } from './automation.service.js';
import type { CreateRuleInput, UpdateRuleInput } from './automation.validation.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const rule = await createRule(req.user!.organizationId!, req.body as CreateRuleInput);
  res.status(201).json({ success: true, data: { rule } });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const rules = await listRules(req.user!.organizationId!);
  res.status(200).json({ success: true, data: { rules } });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const rule = await getRule(req.user!.organizationId!, req.params.id);
  res.status(200).json({ success: true, data: { rule } });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const rule = await updateRule(req.user!.organizationId!, req.params.id, req.body as UpdateRuleInput);
  res.status(200).json({ success: true, data: { rule } });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteRule(req.user!.organizationId!, req.params.id);
  res.status(204).send();
});
