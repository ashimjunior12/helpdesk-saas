'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { SocketProvider } from '@/lib/socket';
import { ApiError } from '@/lib/api';
import { NotificationsBell } from '@/components/NotificationsBell';
import { Avatar } from '@/components/Avatar';
import { GridIcon, LogoutIcon, TicketIcon, UsersIcon } from '@/components/icons';

const ORG_NAV = [
  { href: '/app', label: 'Overview', icon: GridIcon, exact: true },
  { href: '/app/tickets', label: 'Tickets', icon: TicketIcon, exact: false },
  { href: '/app/customers', label: 'Customers', icon: UsersIcon, exact: false },
];

const PLATFORM_NAV = [{ href: '/app/platform', label: 'Organizations', icon: GridIcon, exact: false }];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // Keep the super admin inside the platform area (they have no organization).
  useEffect(() => {
    if (!loading && isSuperAdmin && !pathname.startsWith('/app/platform')) {
      router.replace('/app/platform');
    }
  }, [loading, isSuperAdmin, pathname, router]);

  if (loading || !user) {
    return (
      <div className="center">
        <div className="spinner" />
      </div>
    );
  }

  if (!isSuperAdmin && !user.organizationId) {
    return <CreateOrganization />;
  }

  const nav = isSuperAdmin ? PLATFORM_NAV : ORG_NAV;
  const title = nav.find((n) => (n.exact ? pathname === n.href : pathname.startsWith(n.href)))?.label ??
    (isSuperAdmin ? 'Organizations' : 'Overview');

  const shell = (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-brand">
          <span className="brand-mark">H</span>
          Helpdesk
        </div>
        {nav.map((n) => {
          const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} className={`nav-item ${active ? 'active' : ''}`}>
              <Icon className="nav-icon" />
              {n.label}
            </Link>
          );
        })}
        <div className="side-foot">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Avatar name={user.email} size={30} />
            <div style={{ minWidth: 0 }}>
              <span className="who">{user.email}</span>
              <span>{isSuperAdmin ? 'Super admin' : user.role}</span>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%' }}
            onClick={() => {
              logout();
              router.replace('/login');
            }}
          >
            <LogoutIcon /> Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="topbar-right">{!isSuperAdmin && <NotificationsBell />}</div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );

  // Sockets are an org-user feature; the super admin does not need one.
  return isSuperAdmin ? shell : <SocketProvider>{shell}</SocketProvider>;
}

function CreateOrganization() {
  const { createOrganization } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createOrganization(name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create organization.');
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">H</span>
          Set up your workspace
        </div>
        <p className="auth-sub">Create your organization to start managing support.</p>
        <form onSubmit={submit} noValidate>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="label" htmlFor="org">
              Organization name
            </label>
            <input
              id="org"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc"
              required
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Creating...' : 'Create organization'}
          </button>
        </form>
      </div>
    </div>
  );
}
