import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  addMember,
  createTeam,
  deleteTeam,
  getTeam,
  listTeams,
  removeMember,
  updateTeam,
} from './teams.service.js';
import type { AddMemberInput, CreateTeamInput, UpdateTeamInput } from './teams.validation.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body as CreateTeamInput;
  const team = await createTeam(req.user!.organizationId!, name);
  res.status(201).json({ success: true, data: { team } });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const teams = await listTeams(req.user!.organizationId!);
  res.status(200).json({ success: true, data: { teams } });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const team = await getTeam(req.user!.organizationId!, req.params.id);
  res.status(200).json({ success: true, data: { team } });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body as UpdateTeamInput;
  const team = await updateTeam(req.user!.organizationId!, req.params.id, name);
  res.status(200).json({ success: true, data: { team } });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteTeam(req.user!.organizationId!, req.params.id);
  res.status(204).send();
});

export const addTeamMember = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.body as AddMemberInput;
  const team = await addMember(req.user!.organizationId!, req.params.id, userId);
  res.status(200).json({ success: true, data: { team } });
});

export const removeTeamMember = asyncHandler(async (req: Request, res: Response) => {
  const team = await removeMember(req.user!.organizationId!, req.params.id, req.params.userId);
  res.status(200).json({ success: true, data: { team } });
});
