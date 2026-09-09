import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const createTeamSchema = z.object({
  name: z.string().trim().min(1, 'Team name is required').max(120, 'Name is too long'),
});

export const updateTeamSchema = z.object({
  name: z.string().trim().min(1, 'Team name is required').max(120, 'Name is too long'),
});

export const addMemberSchema = z.object({
  userId: objectId,
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
