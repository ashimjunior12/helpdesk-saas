import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { createRedisConnection, isQueueEnabled } from '../config/redis.js';

export const SLA_QUEUE = 'sla';
export const SLA_EVALUATE_JOB = 'evaluate';

let queue: Queue | undefined;
let connection: Redis | undefined;

function getQueue(): Queue {
  if (!queue) {
    connection = createRedisConnection();
    queue = new Queue(SLA_QUEUE, { connection });
  }
  return queue;
}

// Registers a repeatable job that evaluates SLA breaches every minute. A fixed
// scheduler id keeps the schedule from being duplicated across restarts.
export async function scheduleSlaEvaluation(): Promise<void> {
  if (!isQueueEnabled()) {
    return;
  }
  await getQueue().upsertJobScheduler(
    'sla-evaluate',
    { every: 60_000 },
    {
      name: SLA_EVALUATE_JOB,
      opts: { removeOnComplete: true, removeOnFail: 100 },
    },
  );
}

export async function closeSlaQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = undefined;
  }
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
}
