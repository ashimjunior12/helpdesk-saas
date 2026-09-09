import { z } from 'zod';
import { USER_ROLES } from '../auth/user.model.js';

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
  role: z.enum(USER_ROLES),
});

export const updateUserSchema = z
  .object({
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.role !== undefined || data.isActive !== undefined, {
    message: 'Provide at least one of role or isActive',
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
