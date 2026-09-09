import type { Server } from 'socket.io';
import type { AuthenticatedUser } from '../modules/auth/token.service.js';

// Server -> client event names. Shared with clients (and tests) to avoid typos.
export const SOCKET_EVENTS = {
  MESSAGE_CREATED: 'message:created',
  MESSAGE_DELETED: 'message:deleted',
  TICKET_CREATED: 'ticket:created',
  TICKET_UPDATED: 'ticket:updated',
  TICKET_STATUS_CHANGED: 'ticket:status_changed',
  TICKET_ASSIGNED: 'ticket:assigned',
  TICKET_DELETED: 'ticket:deleted',
  // Internal notes: only staff subscribe to ticket rooms, so these never reach
  // customer connections (which will use a separate namespace when they exist).
  NOTE_CREATED: 'note:created',
  NOTE_DELETED: 'note:deleted',
  NOTIFICATION_CREATED: 'notification:created',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export interface SocketData {
  user: AuthenticatedUser;
}

export const orgRoom = (organizationId: string): string => `org:${organizationId}`;
export const ticketRoom = (ticketId: string): string => `ticket:${ticketId}`;
export const userRoom = (userId: string): string => `user:${userId}`;

// The io instance is set at server startup. It stays undefined in unit/HTTP
// integration tests (no socket server), so the emit helpers below are no-ops
// there and business logic never has to know whether real-time is attached.
let io: Server | undefined;

export function setIO(server: Server | undefined): void {
  io = server;
}

export function getIO(): Server | undefined {
  return io;
}

export function emitToOrg(organizationId: string, event: SocketEvent, payload: unknown): void {
  io?.to(orgRoom(organizationId)).emit(event, payload);
}

export function emitToTicket(ticketId: string, event: SocketEvent, payload: unknown): void {
  io?.to(ticketRoom(ticketId)).emit(event, payload);
}

export function emitToUser(userId: string, event: SocketEvent, payload: unknown): void {
  io?.to(userRoom(userId)).emit(event, payload);
}
