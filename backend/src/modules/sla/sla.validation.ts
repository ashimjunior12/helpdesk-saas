import { z } from 'zod';
import { TICKET_PRIORITIES } from '../tickets/ticket.model.js';

const targetSchema = z.object({
  firstResponseMins: z.number().int().min(1).max(100000),
  resolutionMins: z.number().int().min(1).max(100000),
});

// Requires a target for every priority.
export const updateSlaPolicySchema = z.object({
  targets: z.object(
    Object.fromEntries(TICKET_PRIORITIES.map((p) => [p, targetSchema])) as Record<
      (typeof TICKET_PRIORITIES)[number],
      typeof targetSchema
    >,
  ),
});

export type UpdateSlaPolicyInput = z.infer<typeof updateSlaPolicySchema>;
