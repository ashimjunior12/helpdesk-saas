import { z } from 'zod';
import {
  ACTION_TYPES,
  AUTOMATION_TRIGGERS,
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
} from './automationRule.model.js';

const conditionSchema = z.object({
  field: z.enum(CONDITION_FIELDS),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.array(z.string().min(1)).min(1),
});

const actionSchema = z.object({
  type: z.enum(ACTION_TYPES),
  value: z.string().min(1),
});

export const createRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  enabled: z.boolean().optional(),
  trigger: z.enum(AUTOMATION_TRIGGERS).default('TICKET_CREATED'),
  conditions: z.array(conditionSchema).max(20).default([]),
  actions: z.array(actionSchema).min(1, 'At least one action is required').max(20),
});

export const updateRuleSchema = createRuleSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Provide at least one field to update' },
);

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
