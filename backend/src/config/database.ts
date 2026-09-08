import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * MongoDB connection lifecycle via Mongoose.
 *
 * Mongoose buffers commands until the connection is ready, but we still connect
 * explicitly at startup so the process fails fast if the database is
 * unreachable rather than silently queueing work. Connection state changes are
 * logged so operational issues are visible.
 */
export async function connectDatabase(): Promise<void> {
  mongoose.connection.on('connected', () => {
    logger.info({ operation: 'db.connect' }, 'MongoDB connected');
  });
  mongoose.connection.on('error', (err) => {
    logger.error({ operation: 'db.error', err }, 'MongoDB connection error');
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn({ operation: 'db.disconnect' }, 'MongoDB disconnected');
  });

  await mongoose.connect(env.MONGODB_URI, {
    // Fail fast on an unreachable server instead of hanging for the default 30s.
    serverSelectionTimeoutMS: 5000,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  logger.info({ operation: 'db.close' }, 'MongoDB connection closed');
}

/** 1 = connected. Used by the health check to report DB reachability. */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
