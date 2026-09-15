'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSocket } from '@/lib/socket';
import { relativeTime } from '@/lib/format';
import { PriorityBadge, StatusBadge } from '@/components/Badge';
import { ArrowLeftIcon, SendIcon, TrashIcon } from '@/components/icons';
import type {
  Customer,
  Member,
  Message,
  Note,
  Ticket,
  TicketPriority,
  TicketStatus,
} from '@/lib/types';

const STATUSES: TicketStatus[] = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'];
const PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function TicketDetailPage() {
  const router = useRouter();
  const socket = useSocket();
  const { user } = useAuth();
  const id = useParams().id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tab, setTab] = useState<'conversation' | 'notes'>('conversation');
  const [loading, setLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const load = useCallback(async () => {
    const t = await apiFetch<{ ticket: Ticket }>(`/api/tickets/${id}`);
    setTicket(t.ticket);
    const [c, u, m, n] = await Promise.all([
      apiFetch<{ customer: Customer }>(`/api/customers/${t.ticket.customerId}`).catch(() => null),
      apiFetch<{ users: Member[] }>('/api/users').catch(() => ({ users: [] })),
      apiFetch<{ messages: Message[] }>(`/api/tickets/${id}/messages?limit=200`),
      apiFetch<{ notes: Note[] }>(`/api/tickets/${id}/notes?limit=200`),
    ]);
    if (c) setCustomer(c.customer);
    setMembers(u.users);
    setMessages(m.messages);
    setNotes(n.notes);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Real-time: subscribe to this ticket and merge incoming events.
  useEffect(() => {
    if (!socket) return;
    let active = true;
    const subscribe = () => socket.emit('ticket:subscribe', { ticketId: id });
    if (socket.connected) subscribe();
    socket.on('connect', subscribe);

    const onMessage = (m: Message) => {
      if (active && m.ticketId === id) setMessages((prev) => mergeById(prev, m));
    };
    const onNote = (n: Note) => {
      if (active && n.ticketId === id) setNotes((prev) => mergeById(prev, n));
    };
    const onTicket = (t: Ticket) => {
      if (active && t.id === id) setTicket(t);
    };
    socket.on('message:created', onMessage);
    socket.on('note:created', onNote);
    socket.on('ticket:updated', onTicket);
    socket.on('ticket:status_changed', onTicket);
    socket.on('ticket:assigned', onTicket);

    return () => {
      active = false;
      socket.emit('ticket:unsubscribe', { ticketId: id });
      socket.off('connect', subscribe);
      socket.off('message:created', onMessage);
      socket.off('note:created', onNote);
      socket.off('ticket:updated', onTicket);
      socket.off('ticket:status_changed', onTicket);
      socket.off('ticket:assigned', onTicket);
    };
  }, [socket, id]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages, tab]);

  async function changeStatus(status: TicketStatus) {
    setMetaError(null);
    try {
      const data = await apiFetch<{ ticket: Ticket }>(`/api/tickets/${id}/status`, {
        method: 'POST',
        body: { status },
      });
      setTicket(data.ticket);
    } catch (err) {
      setMetaError(err instanceof ApiError ? err.message : 'Could not change status.');
    }
  }

  async function changePriority(priority: TicketPriority) {
    const data = await apiFetch<{ ticket: Ticket }>(`/api/tickets/${id}`, {
      method: 'PATCH',
      body: { priority },
    });
    setTicket(data.ticket);
  }

  async function changeAssignee(value: string) {
    const data = await apiFetch<{ ticket: Ticket }>(`/api/tickets/${id}/assign`, {
      method: 'POST',
      body: { assignedAgentId: value || null },
    });
    setTicket(data.ticket);
  }

  async function deleteTicket() {
    if (!window.confirm(`Delete ticket #${ticket?.number}? This cannot be undone.`)) return;
    setMetaError(null);
    try {
      await apiFetch(`/api/tickets/${id}`, { method: 'DELETE' });
      router.push('/app/tickets');
    } catch (err) {
      setMetaError(err instanceof ApiError ? err.message : 'Could not delete ticket.');
    }
  }

  function authorName(m: Message): string {
    if (m.authorType === 'CUSTOMER') return customer?.name ?? 'Customer';
    return memberMap.get(m.authorId)?.name ?? 'Agent';
  }

  if (loading || !ticket) {
    return (
      <div className="center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <span className="back" onClick={() => router.push('/app/tickets')}>
        <ArrowLeftIcon /> Back to tickets
      </span>

      <div className="page-head">
        <div>
          <h2 style={{ fontSize: '1.25rem' }}>
            <span className="muted">#{ticket.number}</span> {ticket.subject}
          </h2>
          <p>{customer ? `${customer.name} · ${customer.email}` : 'Loading customer...'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      <div className="detail-grid">
        <div className="panel">
          <div className="tabs">
            <button className={`tab ${tab === 'conversation' ? 'active' : ''}`} onClick={() => setTab('conversation')}>
              Conversation
            </button>
            <button className={`tab ${tab === 'notes' ? 'active' : ''}`} onClick={() => setTab('notes')}>
              Internal notes
            </button>
          </div>

          {tab === 'conversation' ? (
            <>
              <div className="thread" ref={threadRef}>
                {ticket.description && (
                  <div className="msg CUSTOMER">
                    <div className="who">{customer?.name ?? 'Customer'}</div>
                    {ticket.description}
                    <div className="time">Original request</div>
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`msg ${m.authorType}`}>
                    <div className="who">{authorName(m)}</div>
                    {m.body}
                    <div className="time">{relativeTime(m.createdAt)}</div>
                  </div>
                ))}
                {messages.length === 0 && !ticket.description && (
                  <div className="empty">No messages yet. Start the conversation below.</div>
                )}
              </div>
              <MessageComposer ticketId={id} onSent={(m) => setMessages((prev) => mergeById(prev, m))} />
            </>
          ) : (
            <>
              <div className="thread" ref={threadRef}>
                {notes.length === 0 ? (
                  <div className="empty">No internal notes. These are only visible to your team.</div>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} className="note">
                      <strong>{memberMap.get(n.authorId)?.name ?? 'Agent'}</strong>
                      <div>{n.body}</div>
                      <div className="time">{relativeTime(n.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>
              <NoteComposer ticketId={id} onSent={(n) => setNotes((prev) => mergeById(prev, n))} />
            </>
          )}
        </div>

        <div className="panel panel-pad">
          <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 8 }}>
            Details
          </h3>
          {metaError && <div className="form-error">{metaError}</div>}

          <div className="field">
            <label className="label">Status</label>
            <select className="select" value={ticket.status} onChange={(e) => changeStatus(e.target.value as TicketStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label">Priority</label>
            <select className="select" value={ticket.priority} onChange={(e) => changePriority(e.target.value as TicketPriority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 4 }}>
            <label className="label">Assignee</label>
            <select className="select" value={ticket.assignedAgentId ?? ''} onChange={(e) => changeAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {members
                .filter((m) => m.isActive)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="meta-row">
              <span className="mk">Created</span>
              <span>{relativeTime(ticket.createdAt)}</span>
            </div>
            <div className="meta-row">
              <span className="mk">Category</span>
              <span>{ticket.category || '-'}</span>
            </div>
          </div>

          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') &&
            (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') && (
              <div className="danger-zone">
                <button className="btn btn-danger btn-block" onClick={deleteTicket}>
                  <TrashIcon /> Delete ticket
                </button>
                <p className="danger-hint">
                  Permanently removes this {ticket.status.toLowerCase()} ticket and its conversation.
                </p>
              </div>
            )}
        </div>
      </div>
    </>
  );
}

function mergeById<T extends { id: string }>(list: T[], item: T): T[] {
  if (list.some((x) => x.id === item.id)) return list;
  return [...list, item];
}

function MessageComposer({ ticketId, onSent }: { ticketId: string; onSent: (m: Message) => void }) {
  const [body, setBody] = useState('');
  const [asCustomer, setAsCustomer] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const data = await apiFetch<{ message: Message }>(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: { body: body.trim(), authorType: asCustomer ? 'CUSTOMER' : 'AGENT' },
      });
      onSent(data.message);
      setBody('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="composer" onSubmit={send}>
      <textarea
        className="textarea"
        placeholder="Write a reply..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        style={{ minHeight: 64 }}
      />
      <div className="composer-row" style={{ justifyContent: 'space-between' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={asCustomer} onChange={(e) => setAsCustomer(e.target.checked)} />
          Log as customer message
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy || !body.trim()}>
          <SendIcon /> Send
        </button>
      </div>
    </form>
  );
}

function NoteComposer({ ticketId, onSent }: { ticketId: string; onSent: (n: Note) => void }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const data = await apiFetch<{ note: Note }>(`/api/tickets/${ticketId}/notes`, {
        method: 'POST',
        body: { body: body.trim() },
      });
      onSent(data.note);
      setBody('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="composer" onSubmit={send}>
      <textarea
        className="textarea"
        placeholder="Add an internal note (only your team can see this)..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        style={{ minHeight: 64 }}
      />
      <div className="composer-row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" type="submit" disabled={busy || !body.trim()}>
          Add note
        </button>
      </div>
    </form>
  );
}
