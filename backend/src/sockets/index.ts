import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { TicketModel } from '../modules/tickets/ticket.model.js';
import { authenticateSocket } from './socketAuth.js';
import { orgRoom, setIO, ticketRoom, userRoom, type SocketData } from './registry.js';

type Ack = (response: { ok: boolean; error?: string }) => void;

const isObjectId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

// Creates the Socket.IO server, wires authentication and room subscription, and
// registers it in the emit registry so services can broadcast events.
export function initRealtime(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const { user } = socket.data as SocketData;

    // Everyone in an org shares its room for org-wide events (new tickets, etc.),
    // plus a private per-user room for personal notifications.
    socket.join(userRoom(user.id));
    if (user.organizationId) {
      socket.join(orgRoom(user.organizationId));
    }

    // A client opts into a ticket's stream, but only if that ticket is in their
    // organization - so a guessed/foreign ticket id can never be joined.
    socket.on('ticket:subscribe', async (payload: { ticketId?: string }, ack?: Ack) => {
      const ticketId = payload?.ticketId;
      if (!user.organizationId || !isObjectId(ticketId)) {
        ack?.({ ok: false, error: 'INVALID' });
        return;
      }
      const exists = await TicketModel.exists({ _id: ticketId, organizationId: user.organizationId });
      if (!exists) {
        ack?.({ ok: false, error: 'NOT_FOUND' });
        return;
      }
      await socket.join(ticketRoom(ticketId));
      ack?.({ ok: true });
    });

    socket.on('ticket:unsubscribe', (payload: { ticketId?: string }, ack?: Ack) => {
      if (isObjectId(payload?.ticketId)) {
        socket.leave(ticketRoom(payload.ticketId));
      }
      ack?.({ ok: true });
    });
  });

  setIO(io);
  logger.info({ operation: 'realtime.init' }, 'Socket.IO initialized');
  return io;
}
