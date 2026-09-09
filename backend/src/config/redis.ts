import IORedis, { type Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Background jobs run through Redis/BullMQ only when REDIS_URL is configured;
// otherwise they run inline (see the queue dispatch fallback).
export function isQueueEnabled(): boolean {
  return Boolean(env.REDIS_URL);
}

// Each BullMQ Queue and Worker gets its own connection (workers issue blocking
// commands). `maxRetriesPerRequest: null` is required by BullMQ.
export function createRedisConnection(): Redis {
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is not configured');
  }
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (err) => {
    logger.error({ operation: 'redis.error', err }, 'Redis connection error');
  });
  return connection;
}
