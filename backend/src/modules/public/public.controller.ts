import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getTicket, listTickets } from '../tickets/tickets.service.js';
import { listTicketsQuerySchema } from '../tickets/tickets.validation.js';
import { createPublicTicket } from './public.service.js';
import type { PublicTicketInput } from './public.validation.js';

export const createTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await createPublicTicket(req.apiKey!.organizationId, req.body as PublicTicketInput);
  res.status(201).json({ success: true, data: { ticket } });
});

export const listTicketsPublic = asyncHandler(async (req: Request, res: Response) => {
  const query = listTicketsQuerySchema.parse(req.query);
  const { tickets, total, page, limit } = await listTickets(req.apiKey!.organizationId, query);
  res.status(200).json({
    success: true,
    data: { tickets, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

export const getTicketPublic = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await getTicket(req.apiKey!.organizationId, req.params.id);
  res.status(200).json({ success: true, data: { ticket } });
});
