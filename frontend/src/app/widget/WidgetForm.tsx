'use client';

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';
import styles from './widget.module.css';

interface PublicConfig {
  title: string;
  welcomeMessage: string;
  primaryColor: string;
}

type Status = 'loading' | 'ready' | 'unavailable';

export default function WidgetForm() {
  const key = useSearchParams().get('key') ?? '';

  const [status, setStatus] = useState<Status>('loading');
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState('');

  useEffect(() => {
    if (!key) {
      setStatus('unavailable');
      return;
    }
    fetch(`${API_BASE_URL}/api/public/widget/${key}/config`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => {
        setConfig(json.data.config as PublicConfig);
        setStatus('ready');
      })
      .catch(() => setStatus('unavailable'));
  }, [key]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/public/widget/${key}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? 'Something went wrong. Please try again.');
      }
      setSubmittedEmail(form.email);
      setTicketNumber(json.data.ticketNumber as number);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function sendAnother() {
    setTicketNumber(null);
    setError(null);
  }

  const accentStyle = { '--accent': config?.primaryColor } as CSSProperties;

  if (status === 'loading') {
    return (
      <div className={styles.viewport}>
        <div className={styles.card}>
          <div className={styles.state}>Loading…</div>
        </div>
      </div>
    );
  }

  if (status === 'unavailable') {
    return (
      <div className={styles.viewport}>
        <div className={styles.card}>
          <div className={styles.state}>This support widget is unavailable.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.viewport} style={accentStyle}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>{config?.title}</h1>
          <p className={styles.welcome}>{config?.welcomeMessage}</p>
        </div>

        {ticketNumber !== null ? (
          <div className={styles.success}>
            <div className={styles.successIcon} aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p className={styles.successTitle}>Your request has been submitted</p>
            <p className={styles.successBody}>
              We created ticket <span className={styles.ticketRef}>#{ticketNumber}</span> and will
              reply to <strong>{submittedEmail}</strong> by email.
            </p>
            <button type="button" className={styles.buttonGhost} onClick={sendAnother}>
              Send another message
            </button>
          </div>
        ) : (
          <form className={styles.body} onSubmit={handleSubmit} noValidate>
            {error && <div className={`${styles.message} ${styles.error}`}>{error}</div>}

            <div className={styles.field}>
              <label className={styles.label} htmlFor="w-name">
                Name
              </label>
              <input
                id="w-name"
                className={styles.input}
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="w-email">
                Email
              </label>
              <input
                id="w-email"
                className={styles.input}
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="w-subject">
                Subject
              </label>
              <input
                id="w-subject"
                className={styles.input}
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="w-message">
                How can we help?
              </label>
              <textarea
                id="w-message"
                className={styles.textarea}
                required
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>

            <button className={styles.button} type="submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send message'}
            </button>
            <p className={styles.note}>We typically reply by email.</p>
          </form>
        )}
      </div>
    </div>
  );
}
