import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { createRedisConnection, isQueueEnabled } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { createNotificationRecord } from '../modules/notifications/notifications.service.js';
import { evaluateSlaBreaches } from '../modules/sla/sla.service.js';
import { NOTIFICATIONS_QUEUE, type NotificationJobData } from './notifications.queue.js';
import { SLA_QUEUE, scheduleSlaEvaluation } from './sla.queue.js';

let notificationsWorker: Worker<NotificationJobData> | undefined;
let slaWorker: Worker | undefined;
let connection: Redis | undefined;
let slaConnection: Redis | undefined;

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

  slaConnection = createRedisConnection();
  slaWorker = new Worker(
    SLA_QUEUE,
    async () => {
      await evaluateSlaBreaches();
    },
    { connection: slaConnection },
  );
  slaWorker.on('failed', (job, err) => {
    logger.error({ operation: 'worker.sla', jobId: job?.id, err }, 'SLA job failed');
  });

  // Best-effort scheduling; failure to register the repeatable job must not stop startup.
  void scheduleSlaEvaluation().catch((err) => {
    logger.error({ operation: 'sla.schedule', err }, 'Failed to schedule SLA evaluation');
  });

  logger.info(
    { operation: 'workers.start', queues: [NOTIFICATIONS_QUEUE, SLA_QUEUE] },
    'Workers started',
  );
}

export async function stopWorkers(): Promise<void> {
  if (notificationsWorker) {
    await notificationsWorker.close();
    notificationsWorker = undefined;
  }
  if (slaWorker) {
    await slaWorker.close();
    slaWorker = undefined;
  }
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
  if (slaConnection) {
    await slaConnection.quit();
    slaConnection = undefined;
  }
}
