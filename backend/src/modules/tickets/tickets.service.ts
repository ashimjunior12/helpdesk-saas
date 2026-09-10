import type { FilterQuery } from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { CustomerModel } from '../customers/customer.model.js';
import { UserModel } from '../auth/user.model.js';
import { TeamModel } from '../teams/team.model.js';
import { TicketModel, TICKET_TRANSITIONS, type Ticket, type TicketDocument } from './ticket.model.js';
import { nextTicketNumber } from './counter.model.js';
import { SOCKET_EVENTS, emitToOrg, emitToTicket } from '../../sockets/registry.js';
import {
  notifyTicketAssigned,
  notifyTicketStatus,
} from '../notifications/notifications.service.js';
import { computeDueDates } from '../sla/sla.service.js';
import { applyAutomationOnCreate } from '../automation/automation.service.js';
import type {
  AssignTicketInput,
  ChangeStatusInput,
  CreateTicketInput,
  ListTicketsQuery,
  UpdateTicketInput,
} from './tickets.validation.js';

const MONGO_DUPLICATE_KEY = 11000;
const CREATE_RETRIES = 3;

interface ListResult {
  tickets: TicketDocument[];
  total: number;
  page: number;
  limit: number;
}

async function assertCustomerInOrg(organizationId: string, customerId: string): Promise<void> {
  if (!(await CustomerModel.exists({ _id: customerId, organizationId }))) {
    throw AppError.notFound('Customer not found');
  }
}

// An assignee must be an active member of the same organization.
async function assertAssigneeInOrg(organizationId: string, userId: string): Promise<void> {
  if (!(await UserModel.exists({ _id: userId, organizationId, isActive: true }))) {
    throw AppError.notFound('Assignee not found');
  }
}

async function assertTeamInOrg(organizationId: string, teamId: string): Promise<void> {
  if (!(await TeamModel.exists({ _id: teamId, organizationId }))) {
    throw AppError.notFound('Team not found');
  }
}

export async function createTicket(
  organizationId: string,
  actorUserId: string,
  input: CreateTicketInput,
): Promise<TicketDocument> {
  await assertCustomerInOrg(organizationId, input.customerId);
  if (input.assignedAgentId) {
    await assertAssigneeInOrg(organizationId, input.assignedAgentId);
  }
  if (input.teamId) {
    await assertTeamInOrg(organizationId, input.teamId);
  }

  const now = new Date();
  const priority = input.priority ?? 'MEDIUM';
  const { firstResponseDueAt, resolutionDueAt } = await computeDueDates(
    organizationId,
    priority,
    now,
  );

  // The atomic counter makes number collisions practically impossible; the retry
  // is a safety net against the rare race, backed by the unique index.
  for (let attempt = 0; attempt < CREATE_RETRIES; attempt += 1) {
    const number = await nextTicketNumber(organizationId);
    try {
      const ticket = await TicketModel.create({
        ...input,
        organizationId,
        number,
        status: 'OPEN',
        firstResponseDueAt,
        resolutionDueAt,
      });
      logger.info(
        { operation: 'tickets.create', organizationId, ticketId: ticket.id, number },
        'Ticket created',
      );
      // Automation may adjust the ticket (priority/category/team/agent) before we
      // broadcast and notify, so those reflect the final state.
      await applyAutomationOnCreate(ticket);
      emitToOrg(organizationId, SOCKET_EVENTS.TICKET_CREATED, ticket.toJSON());
      await notifyTicketAssigned(ticket, actorUserId);
      return ticket;
    } catch (err) {
      if (isDuplicateKeyError(err) && attempt < CREATE_RETRIES - 1) {
        continue;
      }
      throw err;
    }
  }
  throw AppError.internal('Could not allocate a ticket number');
}

export async function listTickets(
  organizationId: string,
  query: ListTicketsQuery,
): Promise<ListResult> {
  const filter: FilterQuery<Ticket> = { organizationId };
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.assignedAgentId) filter.assignedAgentId = query.assignedAgentId;
  if (query.customerId) filter.customerId = query.customerId;
  if (query.teamId) filter.teamId = query.teamId;
  if (query.search) {
    filter.subject = new RegExp(escapeRegex(query.search), 'i');
  }

  const skip = (query.page - 1) * query.limit;
  const [tickets, total] = await Promise.all([
    TicketModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    TicketModel.countDocuments(filter),
  ]);

  return { tickets, total, page: query.page, limit: query.limit };
}

export async function getTicket(organizationId: string, ticketId: string): Promise<TicketDocument> {
  const ticket = await TicketModel.findOne({ _id: ticketId, organizationId });
  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }
  return ticket;
}

export async function updateTicket(
  organizationId: string,
  ticketId: string,
  input: UpdateTicketInput,
): Promise<TicketDocument> {
  const ticket = await TicketModel.findOneAndUpdate({ _id: ticketId, organizationId }, input, {
    new: true,
    runValidators: true,
  });
  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }
  const payload = ticket.toJSON();
  emitToTicket(ticketId, SOCKET_EVENTS.TICKET_UPDATED, payload);
  emitToOrg(organizationId, SOCKET_EVENTS.TICKET_UPDATED, payload);
  return ticket;
}

export async function changeStatus(
  organizationId: string,
  ticketId: string,
  actorUserId: string,
  input: ChangeStatusInput,
): Promise<TicketDocument> {
  const ticket = await getTicket(organizationId, ticketId);

  if (!TICKET_TRANSITIONS[ticket.status].includes(input.status)) {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      `Cannot change status from ${ticket.status} to ${input.status}`,
    );
  }

  ticket.status = input.status;
  // Track resolution time for SLA: set when resolved/closed, clear on reopen.
  if (input.status === 'RESOLVED' || input.status === 'CLOSED') {
    if (!ticket.resolvedAt) ticket.resolvedAt = new Date();
  } else {
    ticket.resolvedAt = null;
  }
  await ticket.save();
  logger.info(
    { operation: 'tickets.status', organizationId, ticketId, status: input.status },
    'Ticket status changed',
  );
  const payload = ticket.toJSON();
  emitToTicket(ticketId, SOCKET_EVENTS.TICKET_STATUS_CHANGED, payload);
  emitToOrg(organizationId, SOCKET_EVENTS.TICKET_STATUS_CHANGED, payload);
  await notifyTicketStatus(ticket, actorUserId);
  return ticket;
}

export async function assignTicket(
  organizationId: string,
  ticketId: string,
  actorUserId: string,
  input: AssignTicketInput,
): Promise<TicketDocument> {
  const update: Record<string, unknown> = {};

  if ('assignedAgentId' in input) {
    if (input.assignedAgentId) {
      await assertAssigneeInOrg(organizationId, input.assignedAgentId);
    }
    update.assignedAgentId = input.assignedAgentId ?? null;
  }
  if ('teamId' in input) {
    if (input.teamId) {
      await assertTeamInOrg(organizationId, input.teamId);
    }
    update.teamId = input.teamId ?? null;
  }

  const ticket = await TicketModel.findOneAndUpdate({ _id: ticketId, organizationId }, update, {
    new: true,
    runValidators: true,
  });
  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }
  const payload = ticket.toJSON();
  emitToTicket(ticketId, SOCKET_EVENTS.TICKET_ASSIGNED, payload);
  emitToOrg(organizationId, SOCKET_EVENTS.TICKET_ASSIGNED, payload);
  await notifyTicketAssigned(ticket, actorUserId);
  return ticket;
}

export async function deleteTicket(organizationId: string, ticketId: string): Promise<void> {
  const result = await TicketModel.deleteOne({ _id: ticketId, organizationId });
  if (result.deletedCount === 0) {
    throw AppError.notFound('Ticket not found');
  }
  logger.info({ operation: 'tickets.delete', organizationId, ticketId }, 'Ticket deleted');
  emitToOrg(organizationId, SOCKET_EVENTS.TICKET_DELETED, { id: ticketId });
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: number }).code === MONGO_DUPLICATE_KEY
  );
}
