'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { relativeTime } from '@/lib/format';
import { BellIcon } from './icons';
import type { NotificationItem } from '@/lib/types';

export function NotificationsBell() {
  const socket = useSocket();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const loadCount = useCallback(async () => {
    try {
      const data = await apiFetch<{ count: number }>('/api/notifications/unread-count');
      setCount(data.count);
    } catch {
      // ignore transient errors
    }
  }, []);

  useEffect(() => {
    void loadCount();
    const id = setInterval(loadCount, 30000);
    return () => clearInterval(id);
  }, [loadCount]);

  useEffect(() => {
    if (!socket) return;
    const onCreated = () => setCount((c) => c + 1);
    socket.on('notification:created', onCreated);
    return () => {
      socket.off('notification:created', onCreated);
    };
  }, [socket]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        const data = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications?limit=15');
        setItems(data.notifications);
        if (count > 0) {
          await apiFetch('/api/notifications/read-all', { method: 'POST' });
          setCount(0);
        }
      } catch {
        // ignore
      }
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="bell" onClick={toggle} aria-label="Notifications">
        <BellIcon />
        {count > 0 && <span className="bell-count">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="dropdown">
          {items.length === 0 ? (
            <div className="empty" style={{ padding: '32px 16px' }}>
              No notifications yet.
            </div>
          ) : (
            items.map((n) => (
              <div key={n.id} className={`notif ${n.isRead ? '' : 'unread'}`}>
                <div className="nt">{n.title}</div>
                {n.body && <div className="nb">{n.body}</div>}
                <div className="nb">{relativeTime(n.createdAt)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
