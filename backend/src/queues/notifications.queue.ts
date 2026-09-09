import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { createRedisConnection, isQueueEnabled } from '../config/redis.js';
import type { NotificationType } from '../modules/notifications/notification.model.js';

export const NOTIFICATIONS_QUEUE = 'notifications';
export const NOTIFICATION_JOB = 'create';

export interface NotificationJobData {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  ticketId?: string;
  ticketNumber?: number;
}

let queue: Queue<NotificationJobData> | undefined;
let connection: Redis | undefined;

function getQueue(): Queue<NotificationJobData> {
  if (!queue) {
    connection = createRedisConnection();
    queue = new Queue<NotificationJobData>(NOTIFICATIONS_QUEUE, { connection });
  }
  return queue;
}

// Enqueues a notification job. Returns false when queues are disabled so the
// caller runs the work inline. May throw if Redis is configured but unreachable;
// the caller treats that as a fall-back-to-inline signal too.
export async function enqueueNotification(data: NotificationJobData): Promise<boolean> {
  if (!isQueueEnabled()) {
    return false;
  }
  await getQueue().add(NOTIFICATION_JOB, data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: 100,
  });
  return true;
}

export async function closeNotificationsQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = undefined;
  }
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
}
