import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { addNote, deleteNote, listNotes } from './notes.service.js';
import { listNotesQuerySchema, type CreateNoteInput } from './notes.validation.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const note = await addNote(
    req.user!.organizationId!,
    req.params.ticketId,
    req.user!.id,
    req.body as CreateNoteInput,
  );
  res.status(201).json({ success: true, data: { note } });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = listNotesQuerySchema.parse(req.query);
  const { notes, total, page, limit } = await listNotes(
    req.user!.organizationId!,
    req.params.ticketId,
    query,
  );
  res.status(200).json({
    success: true,
    data: {
      notes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteNote(req.user!.organizationId!, req.params.ticketId, req.params.id);
  res.status(204).send();
});
