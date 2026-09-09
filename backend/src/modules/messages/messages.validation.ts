import { z } from 'zod';
import { MESSAGE_AUTHOR_TYPES } from './message.model.js';

export const createMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message body is required').max(10000, 'Message is too long'),
  authorType: z.enum(MESSAGE_AUTHOR_TYPES),
});

export const listMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
