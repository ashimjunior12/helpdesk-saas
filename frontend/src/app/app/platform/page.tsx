'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import { PlusIcon } from '@/components/icons';
import type { Organization } from '@/lib/types';

export default function PlatformPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ organizations: Organization[] }>('/api/platform/organizations');
      setOrgs(data.organizations);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h2 style={{ fontSize: '1.3rem' }}>Organizations</h2>
          <p>Create workspaces and provision their admins and managers.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <PlusIcon /> New organization
        </button>
      </div>

      {loading ? (
        <div className="center" style={{ minHeight: 200 }}>
          <div className="spinner" />
        </div>
      ) : orgs.length === 0 ? (
        <div className="panel panel-pad empty">No organizations yet. Create your first one.</div>
      ) : (
        <div className="org-grid">
          {orgs.map((o) => (
            <div
              key={o.id}
              className="org-card card-hover"
              onClick={() => router.push(`/app/platform/${o.id}`)}
            >
              <div className="oc-top">
                <span className="org-logo">{o.name.charAt(0).toUpperCase()}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="oc-name">{o.name}</div>
                  <div className="oc-meta">Created {relativeTime(o.createdAt)}</div>
                </div>
              </div>
              <div className="oc-meta">
                {o.memberCount ?? 0} {o.memberCount === 1 ? 'member' : 'members'}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewOrgModal
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

function NewOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/platform/organizations', { method: 'POST', body: { name: name.trim() } });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the organization.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>New organization</h3>
        <p className="sub">Create a workspace, then add its admin.</p>
        <form onSubmit={submit} noValidate>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="label" htmlFor="on">Name</label>
            <input id="on" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
