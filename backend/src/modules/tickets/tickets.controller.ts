import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  assignTicket,
  changeStatus,
  createTicket,
  deleteTicket,
  getTicket,
  listTickets,
  updateTicket,
} from './tickets.service.js';
import {
  listTicketsQuerySchema,
  type AssignTicketInput,
  type ChangeStatusInput,
  type CreateTicketInput,
  type UpdateTicketInput,
} from './tickets.validation.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await createTicket(req.user!.organizationId!, req.body as CreateTicketInput);
  res.status(201).json({ success: true, data: { ticket } });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = listTicketsQuerySchema.parse(req.query);
  const { tickets, total, page, limit } = await listTickets(req.user!.organizationId!, query);
  res.status(200).json({
    success: true,
    data: {
      tickets,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await getTicket(req.user!.organizationId!, req.params.id);
  res.status(200).json({ success: true, data: { ticket } });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await updateTicket(
    req.user!.organizationId!,
    req.params.id,
    req.body as UpdateTicketInput,
  );
  res.status(200).json({ success: true, data: { ticket } });
});

export const changeTicketStatus = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await changeStatus(
    req.user!.organizationId!,
    req.params.id,
    req.body as ChangeStatusInput,
  );
  res.status(200).json({ success: true, data: { ticket } });
});

export const assign = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await assignTicket(
    req.user!.organizationId!,
    req.params.id,
    req.body as AssignTicketInput,
  );
  res.status(200).json({ success: true, data: { ticket } });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteTicket(req.user!.organizationId!, req.params.id);
  res.status(204).send();
});
