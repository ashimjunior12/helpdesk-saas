import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { getTicket } from '../tickets/tickets.service.js';
import { SOCKET_EVENTS, emitToTicket } from '../../sockets/registry.js';
import { notifyTicketMessage } from '../notifications/notifications.service.js';
import { MessageModel, type MessageDocument } from './message.model.js';
import type { CreateMessageInput, ListMessagesQuery } from './messages.validation.js';

interface ListResult {
  messages: MessageDocument[];
  total: number;
  page: number;
  limit: number;
}

// Adds a message to a ticket. The ticket is looked up tenant-scoped, so a ticket
// in another organization is unreachable (404). An AGENT message is attributed
// to the acting user; a CUSTOMER message is attributed to the ticket's customer.
export async function addMessage(
  organizationId: string,
  ticketId: string,
  actorUserId: string,
  input: CreateMessageInput,
): Promise<MessageDocument> {
  const ticket = await getTicket(organizationId, ticketId);

  const authorId = input.authorType === 'AGENT' ? actorUserId : ticket.customerId;

  const message = await MessageModel.create({
    organizationId,
    ticketId: ticket.id,
    authorType: input.authorType,
    authorId,
    body: input.body,
  });

  logger.info(
    { operation: 'messages.create', organizationId, ticketId, messageId: message.id },
    'Message added',
  );
  emitToTicket(ticketId, SOCKET_EVENTS.MESSAGE_CREATED, message.toJSON());
  await notifyTicketMessage(ticket, actorUserId);
  return message;
}

export async function listMessages(
  organizationId: string,
  ticketId: string,
  query: ListMessagesQuery,
): Promise<ListResult> {
  await getTicket(organizationId, ticketId);

  const skip = (query.page - 1) * query.limit;
  const [messages, total] = await Promise.all([
    MessageModel.find({ ticketId }).sort({ createdAt: 1 }).skip(skip).limit(query.limit),
    MessageModel.countDocuments({ ticketId }),
  ]);

  return { messages, total, page: query.page, limit: query.limit };
}

export async function deleteMessage(
  organizationId: string,
  ticketId: string,
  messageId: string,
): Promise<void> {
  await getTicket(organizationId, ticketId);

  const result = await MessageModel.deleteOne({ _id: messageId, ticketId, organizationId });
  if (result.deletedCount === 0) {
    throw AppError.notFound('Message not found');
  }
  logger.info(
    { operation: 'messages.delete', organizationId, ticketId, messageId },
    'Message deleted',
  );
  emitToTicket(ticketId, SOCKET_EVENTS.MESSAGE_DELETED, { id: messageId, ticketId });
}
