import { z } from 'zod';
import { TICKET_PRIORITIES } from '../tickets/ticket.model.js';

export const publicTicketSchema = z.object({
  customer: z.object({
    email: z.string().trim().toLowerCase().email(),
    name: z.string().trim().min(1).max(120),
  }),
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.string().trim().max(60).optional(),
});

export type PublicTicketInput = z.infer<typeof publicTicketSchema>;
