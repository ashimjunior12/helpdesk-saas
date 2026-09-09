import type { Server } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initRealtime } from './sockets/index.js';
import { startWorkers, stopWorkers } from './queues/startWorkers.js';
import { closeNotificationsQueue } from './queues/notifications.queue.js';
import { logger } from './utils/logger.js';

/**
 * Process entrypoint: connect to the database, start the HTTP server, and wire
 * up graceful shutdown. If the database is unreachable at boot we exit rather
 * than serving traffic we cannot fulfill.
 */
async function start(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => {
    logger.info(
      { operation: 'server.start', port: env.PORT, env: env.NODE_ENV },
      `Server listening on http://localhost:${env.PORT}`,
    );
  });

  // Attach the Socket.IO server to the same HTTP server for real-time events.
  initRealtime(server);

  // Start background job workers (no-op when REDIS_URL is not configured).
  startWorkers();

  setupGracefulShutdown(server);
}

/**
 * On SIGINT/SIGTERM stop accepting new connections, then close the DB
 * connection, so in-flight requests can finish and resources are released
 * cleanly. Unhandled failures are logged and force an exit.
 */
function setupGracefulShutdown(server: Server): void {
  const shutdown = (signal: string) => {
    logger.info({ operation: 'server.shutdown', signal }, 'Shutting down');
    server.close(async () => {
      await stopWorkers();
      await closeNotificationsQueue();
      await disconnectDatabase();
      process.exit(0);
    });
    // Safety net: force exit if graceful close hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ operation: 'process.unhandledRejection', reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ operation: 'process.uncaughtException', err }, 'Uncaught exception');
    process.exit(1);
  });
}

start().catch((err) => {
  logger.fatal({ operation: 'server.start', err }, 'Failed to start server');
  process.exit(1);
});
