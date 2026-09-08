import type { Request, Response } from 'express';
import { isDatabaseConnected } from '../../config/database.js';
import { env } from '../../config/env.js';

/**
 * Liveness + readiness probe.
 *
 * Returns 200 when the process is up and its dependencies (currently just
 * MongoDB) are reachable, and 503 when a dependency is down so orchestrators
 * and uptime monitors can react. The response deliberately avoids leaking
 * connection strings or other internals.
 */
export function getHealth(_req: Request, res: Response): void {
  const dbConnected = isDatabaseConnected();
  const healthy = dbConnected;

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      status: healthy ? 'ok' : 'degraded',
      environment: env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbConnected ? 'up' : 'down',
      },
    },
  });
}
