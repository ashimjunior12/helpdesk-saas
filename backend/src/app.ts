import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { httpLogger, requestId } from './middleware/requestContext.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { organizationRouter } from './modules/organizations/organization.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { teamsRouter } from './modules/teams/teams.routes.js';
import { customersRouter } from './modules/customers/customers.routes.js';
import { ticketsRouter } from './modules/tickets/tickets.routes.js';
import { messagesRouter } from './modules/messages/messages.routes.js';
import { notesRouter } from './modules/notes/notes.routes.js';

/**
 * Builds and configures the Express application.
 *
 * Kept separate from server startup (see server.ts) so tests can import a fully
 * wired app without opening a network port or connecting to real services.
 * Middleware order matters: security headers -> CORS -> body parsing ->
 * request context/logging -> routes -> 404 -> centralized error handler (last).
 */
export function createApp(): Application {
  const app = express();

  // Behind a proxy/load balancer we still want the real client IP.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(requestId);
  app.use(httpLogger);

  // Feature routers mount under /api. More modules will be added in later phases.
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/organizations', organizationRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/teams', teamsRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/tickets', ticketsRouter);
  app.use('/api/tickets/:ticketId/messages', messagesRouter);
  app.use('/api/tickets/:ticketId/notes', notesRouter);

  // Unmatched routes and centralized error handling come last.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
