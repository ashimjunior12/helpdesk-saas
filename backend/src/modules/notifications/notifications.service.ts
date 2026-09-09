import type { FilterQuery } from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { SOCKET_EVENTS, emitToUser } from '../../sockets/registry.js';
import { isQueueEnabled } from '../../config/redis.js';
import { enqueueNotification, type NotificationJobData } from '../../queues/notifications.queue.js';
import type { TicketDocument } from '../tickets/ticket.model.js';
import {
  NotificationModel,
  type Notification,
  type NotificationDocument,
} from './notification.model.js';
import type { ListNotificationsQuery } from './notifications.validation.js';

interface ListResult {
  notifications: NotificationDocument[];
  total: number;
  page: number;
  limit: number;
}

// Persists a notification and pushes it live to the recipient. This is the unit
// of work run either inline or by the BullMQ worker.
export async function createNotificationRecord(data: NotificationJobData): Promise<void> {
  const notification = await NotificationModel.create({
    organizationId: data.organizationId,
    userId: data.userId,
    type: data.type,
    title: data.title,
    body: data.body,
    ticketId: data.ticketId ?? null,
    ticketNumber: data.ticketNumber ?? null,
  });
  emitToUser(data.userId, SOCKET_EVENTS.NOTIFICATION_CREATED, notification.toJSON());
}

// Routes notification work to the queue when Redis is configured, otherwise runs
// it inline. If enqueueing fails (Redis configured but unreachable), it falls
// back to inline so a notification is never silently lost.
async function dispatchNotification(data: NotificationJobData): Promise<void> {
  if (isQueueEnabled()) {
    try {
      if (await enqueueNotification(data)) {
        return;
      }
    } catch (err) {
      logger.warn(
        { operation: 'notifications.enqueue', err },
        'Notification queue unavailable; creating inline',
      );
    }
  }
  await createNotificationRecord(data);
}

// The recipient of a ticket notification is its assigned agent, never the person
// who performed the action.
function recipientFor(ticket: TicketDocument, actorUserId: string): string | null {
  const assignee = ticket.assignedAgentId ? String(ticket.assignedAgentId) : null;
  return assignee && assignee !== actorUserId ? assignee : null;
}

// Notification generation is best-effort: a failure here must never fail the
// underlying ticket/message operation, so errors are logged and swallowed.
async function safeNotify(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.warn({ operation: 'notifications.generate', err }, 'Failed to create notification');
  }
}

export function notifyTicketAssigned(ticket: TicketDocument, actorUserId: string): Promise<void> {
  const userId = recipientFor(ticket, actorUserId);
  if (!userId) return Promise.resolve();
  return safeNotify(() =>
    dispatchNotification({
      organizationId: String(ticket.organizationId),
      userId,
      type: 'TICKET_ASSIGNED',
      title: `You were assigned ticket #${ticket.number}`,
      body: ticket.subject,
      ticketId: ticket.id,
      ticketNumber: ticket.number,
    }),
  );
}

export function notifyTicketMessage(ticket: TicketDocument, actorUserId: string): Promise<void> {
  const userId = recipientFor(ticket, actorUserId);
  if (!userId) return Promise.resolve();
  return safeNotify(() =>
    dispatchNotification({
      organizationId: String(ticket.organizationId),
      userId,
      type: 'TICKET_MESSAGE',
      title: `New message on ticket #${ticket.number}`,
      body: ticket.subject,
      ticketId: ticket.id,
      ticketNumber: ticket.number,
    }),
  );
}

export function notifyTicketStatus(ticket: TicketDocument, actorUserId: string): Promise<void> {
  const userId = recipientFor(ticket, actorUserId);
  if (!userId) return Promise.resolve();
  return safeNotify(() =>
    dispatchNotification({
      organizationId: String(ticket.organizationId),
      userId,
      type: 'TICKET_STATUS',
      title: `Ticket #${ticket.number} is now ${ticket.status}`,
      body: ticket.subject,
      ticketId: ticket.id,
      ticketNumber: ticket.number,
    }),
  );
}

export async function listNotifications(
  organizationId: string,
  userId: string,
  query: ListNotificationsQuery,
): Promise<ListResult> {
  const filter: FilterQuery<Notification> = { organizationId, userId };
  if (query.unread) filter.isRead = false;

  const skip = (query.page - 1) * query.limit;
  const [notifications, total] = await Promise.all([
    NotificationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    NotificationModel.countDocuments(filter),
  ]);

  return { notifications, total, page: query.page, limit: query.limit };
}

export function unreadCount(organizationId: string, userId: string): Promise<number> {
  return NotificationModel.countDocuments({ organizationId, userId, isRead: false });
}

export async function markRead(
  organizationId: string,
  userId: string,
  notificationId: string,
): Promise<NotificationDocument> {
  const notification = await NotificationModel.findOneAndUpdate(
    { _id: notificationId, organizationId, userId },
    { isRead: true },
    { new: true },
  );
  if (!notification) {
    throw AppError.notFound('Notification not found');
  }
  return notification;
}

export async function markAllRead(organizationId: string, userId: string): Promise<number> {
  const result = await NotificationModel.updateMany(
    { organizationId, userId, isRead: false },
    { isRead: true },
  );
  return result.modifiedCount;
}
