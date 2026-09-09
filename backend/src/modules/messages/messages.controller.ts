import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { addMessage, deleteMessage, listMessages } from './messages.service.js';
import { listMessagesQuerySchema, type CreateMessageInput } from './messages.validation.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const message = await addMessage(
    req.user!.organizationId!,
    req.params.ticketId,
    req.user!.id,
    req.body as CreateMessageInput,
  );
  res.status(201).json({ success: true, data: { message } });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = listMessagesQuerySchema.parse(req.query);
  const { messages, total, page, limit } = await listMessages(
    req.user!.organizationId!,
    req.params.ticketId,
    query,
  );
  res.status(200).json({
    success: true,
    data: {
      messages,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteMessage(req.user!.organizationId!, req.params.ticketId, req.params.id);
  res.status(204).send();
});
