import { z } from 'zod';
import { TICKET_PRIORITIES, TICKET_STATUSES } from './ticket.model.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const createTicketSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(200, 'Subject is too long'),
  description: z.string().trim().max(5000, 'Description is too long').optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.string().trim().max(60, 'Category is too long').optional(),
  customerId: objectId,
  assignedAgentId: objectId.optional(),
  teamId: objectId.optional(),
});

export const updateTicketSchema = z
  .object({
    subject: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    category: z.string().trim().max(60).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const changeStatusSchema = z.object({
  status: z.enum(TICKET_STATUSES),
});

export const assignTicketSchema = z
  .object({
    assignedAgentId: objectId.nullable().optional(),
    teamId: objectId.nullable().optional(),
  })
  .refine((data) => 'assignedAgentId' in data || 'teamId' in data, {
    message: 'Provide assignedAgentId and/or teamId (use null to clear)',
  });

export const listTicketsQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignedAgentId: objectId.optional(),
  customerId: objectId.optional(),
  teamId: objectId.optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
