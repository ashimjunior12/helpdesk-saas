'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import { PriorityBadge, StatusBadge } from '@/components/Badge';
import { PlusIcon } from '@/components/icons';
import type { Customer, Pagination, Ticket, TicketPriority, TicketStatus } from '@/lib/types';

const STATUSES: (TicketStatus | 'ALL')[] = ['ALL', 'OPEN', 'PENDING', 'RESOLVED', 'CLOSED'];
const LIMIT = 15;

export default function TicketsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<TicketStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (status !== 'ALL') params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    try {
      const data = await apiFetch<{ tickets: Ticket[]; pagination: Pagination }>(
        `/api/tickets?${params.toString()}`,
      );
      setTickets(data.tickets);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2 style={{ fontSize: '1.3rem' }}>Tickets</h2>
          <p>Track and respond to customer requests.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <PlusIcon /> New ticket
        </button>
      </div>

      <div className="toolbar">
        <input
          className="input search"
          placeholder="Search by subject or number..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`pill ${status === s ? 'active' : ''}`}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="center" style={{ minHeight: 200 }}>
          <div className="spinner" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="panel panel-pad empty">No tickets match this view.</div>
      ) : (
        <>
          <div className="tlist">
            {tickets.map((t) => (
              <div key={t.id} className="trow" onClick={() => router.push(`/app/tickets/${t.id}`)}>
                <span className="num">#{t.number}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="subj">{t.subject}</div>
                  <div className="sub">Updated {relativeTime(t.updatedAt)}</div>
                </div>
                <div className="tags">
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                </div>
              </div>
            ))}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="pager">
              <span>
                Page {pagination.page} of {pagination.totalPages} - {pagination.total} total
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showNew && (
        <NewTicketModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => router.push(`/app/tickets/${id}`)}
        />
      )}
    </>
  );
}

function NewTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function findOrCreateCustomer(): Promise<string> {
    const email = customerEmail.trim().toLowerCase();
    const found = await apiFetch<{ customers: Customer[] }>(
      `/api/customers?search=${encodeURIComponent(email)}&limit=10`,
    );
    const match = found.customers.find((c) => c.email === email);
    if (match) return match.id;
    const created = await apiFetch<{ customer: Customer }>('/api/customers', {
      method: 'POST',
      body: { name: customerName.trim(), email },
    });
    return created.customer.id;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const customerId = await findOrCreateCustomer();
      const created = await apiFetch<{ ticket: Ticket }>('/api/tickets', {
        method: 'POST',
        body: { subject: subject.trim(), priority, customerId },
      });
      onCreated(created.ticket.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the ticket.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>New ticket</h3>
        <p className="sub">Log a request on behalf of a customer.</p>
        <form onSubmit={submit} noValidate>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="label" htmlFor="subject">Subject</label>
            <input id="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="priority">Priority</label>
            <select id="priority" className="select" value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="cname">Customer name</label>
            <input id="cname" className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="cemail">Customer email</label>
            <input id="cemail" className="input" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Creating...' : 'Create ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
