import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { TICKET_PRIORITIES, type TicketDocument, type TicketPriority } from '../tickets/ticket.model.js';
import { TeamModel } from '../teams/team.model.js';
import { UserModel } from '../auth/user.model.js';
import { computeDueDates } from '../sla/sla.service.js';
import {
  AutomationRuleModel,
  type AutomationRuleDocument,
  type RuleAction,
  type RuleCondition,
} from './automationRule.model.js';
import type { CreateRuleInput, UpdateRuleInput } from './automation.validation.js';

// Validates that action targets exist in the org and that SET_PRIORITY uses a
// real priority, so a rule can never be saved with a dangling reference.
async function validateActions(organizationId: string, actions: RuleAction[]): Promise<void> {
  for (const action of actions) {
    if (action.type === 'SET_PRIORITY' && !TICKET_PRIORITIES.includes(action.value as TicketPriority)) {
      throw AppError.badRequest(`Invalid priority: ${action.value}`);
    }
    if (action.type === 'ASSIGN_TEAM' && !(await TeamModel.exists({ _id: action.value, organizationId }))) {
      throw AppError.badRequest('ASSIGN_TEAM target team not found in this organization');
    }
    if (
      action.type === 'ASSIGN_AGENT' &&
      !(await UserModel.exists({ _id: action.value, organizationId, isActive: true }))
    ) {
      throw AppError.badRequest('ASSIGN_AGENT target user not found in this organization');
    }
  }
}

export async function createRule(
  organizationId: string,
  input: CreateRuleInput,
): Promise<AutomationRuleDocument> {
  await validateActions(organizationId, input.actions);
  return AutomationRuleModel.create({ ...input, organizationId });
}

export function listRules(organizationId: string): Promise<AutomationRuleDocument[]> {
  return AutomationRuleModel.find({ organizationId }).sort({ createdAt: 1 });
}

export async function getRule(organizationId: string, id: string): Promise<AutomationRuleDocument> {
  const rule = await AutomationRuleModel.findOne({ _id: id, organizationId });
  if (!rule) throw AppError.notFound('Automation rule not found');
  return rule;
}

export async function updateRule(
  organizationId: string,
  id: string,
  input: UpdateRuleInput,
): Promise<AutomationRuleDocument> {
  if (input.actions) {
    await validateActions(organizationId, input.actions);
  }
  const rule = await AutomationRuleModel.findOneAndUpdate({ _id: id, organizationId }, input, {
    new: true,
    runValidators: true,
  });
  if (!rule) throw AppError.notFound('Automation rule not found');
  return rule;
}

export async function deleteRule(organizationId: string, id: string): Promise<void> {
  const result = await AutomationRuleModel.deleteOne({ _id: id, organizationId });
  if (result.deletedCount === 0) throw AppError.notFound('Automation rule not found');
}

function fieldValue(ticket: TicketDocument, field: RuleCondition['field']): string {
  if (field === 'priority') return ticket.priority;
  if (field === 'category') return ticket.category ?? '';
  return ticket.subject;
}

function conditionMatches(ticket: TicketDocument, condition: RuleCondition): boolean {
  const actual = fieldValue(ticket, condition.field);
  const [first] = condition.value;
  if (condition.operator === 'eq') return actual === first;
  if (condition.operator === 'contains') return actual.toLowerCase().includes(first.toLowerCase());
  return condition.value.includes(actual); // 'in'
}

// Runs enabled TICKET_CREATED rules against a freshly created ticket, applying
// matching rules in order. Recomputes SLA due dates when a rule changes priority.
// Best-effort: an automation failure must not fail ticket creation.
export async function applyAutomationOnCreate(ticket: TicketDocument): Promise<void> {
  try {
    const organizationId = String(ticket.organizationId);
    const rules = await AutomationRuleModel.find({
      organizationId,
      enabled: true,
      trigger: 'TICKET_CREATED',
    }).sort({ createdAt: 1 });

    let changed = false;
    let priorityChanged = false;

    for (const rule of rules) {
      if (!rule.conditions.every((c) => conditionMatches(ticket, c))) continue;

      for (const action of rule.actions) {
        if (action.type === 'SET_PRIORITY' && TICKET_PRIORITIES.includes(action.value as TicketPriority)) {
          ticket.priority = action.value as TicketPriority;
          priorityChanged = true;
          changed = true;
        } else if (action.type === 'SET_CATEGORY') {
          ticket.category = action.value;
          changed = true;
        } else if (action.type === 'ASSIGN_TEAM') {
          if (await TeamModel.exists({ _id: action.value, organizationId })) {
            ticket.teamId = action.value as unknown as TicketDocument['teamId'];
            changed = true;
          }
        } else if (action.type === 'ASSIGN_AGENT') {
          if (await UserModel.exists({ _id: action.value, organizationId, isActive: true })) {
            ticket.assignedAgentId = action.value as unknown as TicketDocument['assignedAgentId'];
            changed = true;
          }
        }
      }
    }

    if (priorityChanged) {
      const { firstResponseDueAt, resolutionDueAt } = await computeDueDates(
        organizationId,
        ticket.priority,
        ticket.createdAt,
      );
      ticket.firstResponseDueAt = firstResponseDueAt;
      ticket.resolutionDueAt = resolutionDueAt;
    }

    if (changed) {
      await ticket.save();
      logger.info(
        { operation: 'automation.apply', organizationId, ticketId: ticket.id },
        'Automation rules applied',
      );
    }
  } catch (err) {
    logger.warn({ operation: 'automation.apply', err }, 'Automation failed; ticket kept as-is');
  }
}
