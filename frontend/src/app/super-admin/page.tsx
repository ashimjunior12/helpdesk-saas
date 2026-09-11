'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';

// Separate, visually distinct sign-in for the platform SUPER_ADMIN. Org users
// (admin/manager/agent) use /login instead.
export default function SuperAdminLoginPage() {
  const { user, loading, login, logout } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user?.role === 'SUPER_ADMIN') router.replace('/app/platform');
  }, [loading, user, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await login(email, password);
      if (u.role !== 'SUPER_ADMIN') {
        logout();
        setError('This account is not a platform administrator. Use the team sign-in.');
        setBusy(false);
        return;
      }
      router.replace('/app/platform');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap auth-platform">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark brand-mark-platform">
            <ShieldIcon />
          </span>
          Platform Console
        </div>
        <p className="auth-sub">Administrator access. Manage organizations and their teams.</p>

        <form onSubmit={submit} noValidate>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="label" htmlFor="email">
              Administrator email
            </label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Please wait...' : 'Sign in to console'}
          </button>
        </form>

        <div className="auth-alt">
          <Link href="/login">Team member sign-in</Link>
        </div>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
