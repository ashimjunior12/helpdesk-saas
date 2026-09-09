import { z } from 'zod';

export const createNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note body is required').max(10000, 'Note is too long'),
});

export const listNotesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>;
