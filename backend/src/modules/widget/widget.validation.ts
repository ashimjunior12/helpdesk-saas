import { z } from 'zod';

export const updateWidgetSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    welcomeMessage: z.string().trim().min(1).max(300).optional(),
    primaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'primaryColor must be a hex color like #2563eb')
      .optional(),
    enabled: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field' });

export const widgetTicketSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
});

export type UpdateWidgetInput = z.infer<typeof updateWidgetSchema>;
export type WidgetTicketInput = z.infer<typeof widgetTicketSchema>;
