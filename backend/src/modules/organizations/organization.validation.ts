import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, 'Organization name is required').max(120, 'Name is too long'),
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1, 'Organization name is required').max(120, 'Name is too long'),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
