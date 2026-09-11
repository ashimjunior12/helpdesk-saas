'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL, getAccessToken } from './api';

const SocketContext = createContext<Socket | null>(null);

// Opens a single authenticated Socket.IO connection for the app area. The token
// is read at connect time; on reconnect the client re-sends it.
export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const ref = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const s = io(API_BASE_URL, {
      transports: ['websocket'],
      auth: { token },
    });
    ref.current = s;
    setSocket(s);

    return () => {
      s.close();
      ref.current = null;
    };
  }, []);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}
