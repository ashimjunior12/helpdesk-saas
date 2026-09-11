'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { PlusIcon } from '@/components/icons';
import type { Customer, Pagination } from '@/lib/types';

const LIMIT = 15;

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search.trim()) params.set('search', search.trim());
    try {
      const data = await apiFetch<{ customers: Customer[]; pagination: Pagination }>(
        `/api/customers?${params.toString()}`,
      );
      setCustomers(data.customers);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2 style={{ fontSize: '1.3rem' }}>Customers</h2>
          <p>People who have contacted your support.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <PlusIcon /> Add customer
        </button>
      </div>

      <div className="toolbar">
        <input
          className="input search"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {loading ? (
        <div className="center" style={{ minHeight: 200 }}>
          <div className="spinner" />
        </div>
      ) : customers.length === 0 ? (
        <div className="panel panel-pad empty">No customers yet.</div>
      ) : (
        <>
          <div className="tlist">
            {customers.map((c) => (
              <div key={c.id} className="trow" style={{ gridTemplateColumns: '1fr auto', cursor: 'default' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="subj">{c.name}</div>
                  <div className="sub">{c.email}</div>
                </div>
                <div className="muted">{c.phone || ''}</div>
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
        <NewCustomerModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            void load();
          }}
        />
      )}
    </>
  );
}

function NewCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/customers', {
        method: 'POST',
        body: { name: name.trim(), email: email.trim(), phone: phone.trim() || undefined },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the customer.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Add customer</h3>
        <p className="sub">Create a customer record.</p>
        <form onSubmit={submit} noValidate>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="label" htmlFor="n">Name</label>
            <input id="n" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="e">Email</label>
            <input id="e" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="p">Phone (optional)</label>
            <input id="p" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Adding...' : 'Add customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
