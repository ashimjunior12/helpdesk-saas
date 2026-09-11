import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createUser, deleteUser, getUser, listUsers, updateUser } from './users.service.js';
import type { CreateUserInput, UpdateUserInput } from './users.validation.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const user = await createUser(req.user!.organizationId!, req.body as CreateUserInput);
  res.status(201).json({ success: true, data: { user } });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const users = await listUsers(req.user!.organizationId!);
  res.status(200).json({ success: true, data: { users } });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const user = await getUser(req.user!.organizationId!, req.params.id);
  res.status(200).json({ success: true, data: { user } });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const user = await updateUser(
    req.user!.organizationId!,
    req.user!.id,
    req.params.id,
    req.body as UpdateUserInput,
  );
  res.status(200).json({ success: true, data: { user } });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteUser(req.user!.organizationId!, req.user!.id, req.params.id);
  res.status(204).send();
});
