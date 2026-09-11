'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatDuration, relativeTime } from '@/lib/format';
import { StatusBadge, PriorityBadge } from '@/components/Badge';
import type { AnalyticsOverview, Pagination, Ticket } from '@/lib/types';

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
            <div className="k">{s.k}</div>
            <div className="v">{s.v}</div>
          </div>
        ))}
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
