'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatDuration, relativeTime } from '@/lib/format';
import { StatusBadge, PriorityBadge } from '@/components/Badge';
import type { AnalyticsOverview, Pagination, Ticket, TicketStatus } from '@/lib/types';

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: '#4f46e5',
  PENDING: '#d97706',
  RESOLVED: '#059669',
  CLOSED: '#94a3b8',
};
const STATUS_ORDER: TicketStatus[] = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'];

export default function OverviewPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [recent, setRecent] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<AnalyticsOverview>('/api/analytics/overview'),
      apiFetch<{ tickets: Ticket[]; pagination: Pagination }>('/api/tickets?limit=5'),
    ])
      .then(([o, t]) => {
        setOverview(o);
        setRecent(t.tickets);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !overview) {
    return (
      <div className="center">
        <div className="spinner" />
      </div>
    );
  }

  const breaches = overview.sla.firstResponseBreached + overview.sla.resolutionBreached;
  const stats = [
    { k: 'Open tickets', v: overview.totals.open },
    { k: 'Total tickets', v: overview.totals.tickets },
    { k: 'SLA breaches', v: breaches },
    { k: 'Avg resolution', v: formatDuration(overview.avgResolutionMs) },
  ];

  const statusTotal = STATUS_ORDER.reduce((s, k) => s + (overview.byStatus[k] || 0), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h2 style={{ fontSize: '1.3rem' }}>Overview</h2>
          <p>A snapshot of your support workload.</p>
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.k} className="stat">
            <div className="k">
              <span className="kdot" />
              {s.k}
            </div>
            <div className="v">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="panel panel-pad" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 12 }}>
          Tickets by status
        </h3>
        {statusTotal === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No tickets yet.</p>
        ) : (
          <>
            <div className="meter">
              {STATUS_ORDER.map((k) => {
                const val = overview.byStatus[k] || 0;
                if (!val) return null;
                return (
                  <span
                    key={k}
                    style={{ width: `${(val / statusTotal) * 100}%`, background: STATUS_COLORS[k] }}
                    title={`${k}: ${val}`}
                  />
                );
              })}
            </div>
            <div className="legend">
              {STATUS_ORDER.map((k) => (
                <span key={k} className="li">
                  <span className="sw" style={{ background: STATUS_COLORS[k] }} />
                  {k.charAt(0) + k.slice(1).toLowerCase()} - {overview.byStatus[k] || 0}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="page-head">
        <h3 style={{ fontSize: '1rem' }}>Recent tickets</h3>
        <span className="link" onClick={() => router.push('/app/tickets')}>
          View all
        </span>
      </div>

      {recent.length === 0 ? (
        <div className="panel panel-pad empty">No tickets yet.</div>
      ) : (
        <div className="tlist">
          {recent.map((t) => (
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
      )}
    </>
  );
}
