import type { Socket } from 'socket.io';
import { verifyAccessToken } from '../modules/auth/token.service.js';

// Socket.IO handshake authentication. The client sends the access token via
// `auth: { token }` (or an Authorization header); we verify it with the same
// logic as the REST API and attach the user to socket.data. Any failure refuses
// the connection.
export function authenticateSocket(socket: Socket, next: (err?: Error) => void): void {
  try {
    const fromAuth = socket.handshake.auth?.token as string | undefined;
    const fromHeader = socket.handshake.headers.authorization;
    const token = fromAuth ?? (fromHeader?.startsWith('Bearer ') ? fromHeader.slice(7) : undefined);

    if (!token) {
      throw new Error('missing token');
    }

    socket.data.user = verifyAccessToken(token);
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
}
