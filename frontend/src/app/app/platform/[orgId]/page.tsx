'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { Avatar, RoleBadge } from '@/components/Avatar';
import { ArrowLeftIcon, PlusIcon } from '@/components/icons';
import type { Member, Organization, OrgRole } from '@/lib/types';

export default function PlatformOrgPage() {
  const router = useRouter();
  const orgId = useParams().orgId as string;

  const [org, setOrg] = useState<Organization | null>(null);
  const [users, setUsers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orgs, u] = await Promise.all([
        apiFetch<{ organizations: Organization[] }>('/api/platform/organizations'),
        apiFetch<{ users: Member[] }>(`/api/platform/organizations/${orgId}/users`),
      ]);
      setOrg(orgs.organizations.find((o) => o.id === orgId) ?? null);
      setUsers(u.users);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <span className="back" onClick={() => router.push('/app/platform')}>
        <ArrowLeftIcon /> All organizations
      </span>

      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="org-logo">{(org?.name ?? '?').charAt(0).toUpperCase()}</span>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>{org?.name ?? 'Organization'}</h2>
            <p>{users.length} {users.length === 1 ? 'member' : 'members'}</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <PlusIcon /> Add member
        </button>
      </div>

      {users.length === 0 ? (
        <div className="panel panel-pad empty">
          No members yet. Add an admin to hand this organization over.
        </div>
      ) : (
        <div className="tlist">
          {users.map((u) => (
            <div key={u.id} className="urow">
              <Avatar name={u.name} />
              <div style={{ minWidth: 0 }}>
                <div className="uname">{u.name}</div>
                <div className="umail">{u.email}</div>
              </div>
              <span className="uspacer" />
              {!u.isActive && <span className="badge badge-CLOSED">Disabled</span>}
              <RoleBadge role={u.role} />
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <AddMemberModal
          orgId={orgId}
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

function AddMemberModal({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<OrgRole>('ADMIN');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/platform/organizations/${orgId}/users`, {
        method: 'POST',
        body: { name: name.trim(), email: email.trim(), password, role },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the member.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Add member</h3>
        <p className="sub">They can sign in with these credentials.</p>
        <form onSubmit={submit} noValidate>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="label" htmlFor="mn">Name</label>
            <input id="mn" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="me">Email</label>
            <input id="me" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="mp">Temporary password</label>
            <input id="mp" className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="field">
            <label className="label" htmlFor="mr">Role</label>
            <select id="mr" className="select" value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="AGENT">Agent</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Adding...' : 'Add member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
