import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { createRedisConnection, isQueueEnabled } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { createNotificationRecord } from '../modules/notifications/notifications.service.js';
import { NOTIFICATIONS_QUEUE, type NotificationJobData } from './notifications.queue.js';

let notificationsWorker: Worker<NotificationJobData> | undefined;
let connection: Redis | undefined;

// Starts the background workers. A no-op when queues are disabled (no Redis), so
// the same entrypoint works with or without Redis.
export function startWorkers(): void {
  if (!isQueueEnabled()) {
    logger.info({ operation: 'workers.start' }, 'Queues disabled (no REDIS_URL); jobs run inline');
    return;
  }

  connection = createRedisConnection();
  notificationsWorker = new Worker<NotificationJobData>(
    NOTIFICATIONS_QUEUE,
    async (job) => {
      await createNotificationRecord(job.data);
    },
    { connection },
  );

  notificationsWorker.on('failed', (job, err) => {
    logger.error(
      { operation: 'worker.notifications', jobId: job?.id, err },
      'Notification job failed',
    );
  });

  logger.info({ operation: 'workers.start', queue: NOTIFICATIONS_QUEUE }, 'Workers started');
}

export async function stopWorkers(): Promise<void> {
  if (notificationsWorker) {
    await notificationsWorker.close();
    notificationsWorker = undefined;
  }
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
}
