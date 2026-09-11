'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { CopyIcon } from '@/components/icons';
import type { WidgetConfig } from '@/lib/types';

export default function WidgetSettingsPage() {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [welcome, setWelcome] = useState('');
  const [color, setColor] = useState('#4f46e5');
  const [enabled, setEnabled] = useState(true);

  function apply(c: WidgetConfig) {
    setConfig(c);
    setTitle(c.title);
    setWelcome(c.welcomeMessage);
    setColor(c.primaryColor);
    setEnabled(c.enabled);
  }

  useEffect(() => {
    apiFetch<{ config: WidgetConfig }>('/api/widget-config')
      .then((d) => apply(d.config))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load widget settings.'))
      .finally(() => setLoading(false));
  }, []);

  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const scriptSnippet = useMemo(() => {
    if (!config) return '';
    return (
      `<script src="${origin}/widget.js"\n` +
      `        data-key="${config.publicKey}"\n` +
      `        data-color="${color}"\n` +
      `        data-greeting="${welcome.replace(/"/g, '&quot;')}"></script>`
    );
  }, [config, origin, color, welcome]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const d = await apiFetch<{ config: WidgetConfig }>('/api/widget-config', {
        method: 'PUT',
        body: { title, welcomeMessage: welcome, primaryColor: color, enabled },
      });
      apply(d.config);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function rotate() {
    if (!window.confirm('Rotate the public key? The old embed snippet will stop working.')) return;
    try {
      const d = await apiFetch<{ config: WidgetConfig }>('/api/widget-config/rotate-key', {
        method: 'POST',
      });
      apply(d.config);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not rotate the key.');
    }
  }

  function copy(text: string, which: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  if (loading) {
    return (
      <div className="center">
        <div className="spinner" />
      </div>
    );
  }

  if (!config) {
    return <div className="panel panel-pad empty">{error ?? 'Widget settings are unavailable.'}</div>;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2 style={{ fontSize: '1.3rem' }}>Support widget</h2>
          <p>Customize the widget and copy the snippet to embed it on your website.</p>
        </div>
      </div>

      <div className="detail-grid">
        <form className="panel panel-pad" onSubmit={save}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="label" htmlFor="wt">Title</label>
            <input id="wt" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="ww">Welcome message</label>
            <textarea id="ww" className="textarea" value={welcome} onChange={(e) => setWelcome(e.target.value)} maxLength={300} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="wc">Primary color</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input id="wc" type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 46, height: 38, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'none', cursor: 'pointer' }} />
              <input className="input" value={color} onChange={(e) => setColor(e.target.value)} style={{ maxWidth: 140 }} />
            </div>
          </div>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Widget enabled
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            {saved && <span className="muted" style={{ fontSize: '0.85rem' }}>Saved</span>}
          </div>
        </form>

        <div className="panel panel-pad">
          <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 10 }}>
            Embed on your website
          </h3>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: 0 }}>
            Paste this before <code>&lt;/body&gt;</code>. It adds a floating support button.
          </p>
          <pre className="snippet">{scriptSnippet}</pre>
          <button className="btn btn-secondary btn-sm" onClick={() => copy(scriptSnippet, 'script')}>
            <CopyIcon /> {copied === 'script' ? 'Copied' : 'Copy snippet'}
          </button>

          <div style={{ marginTop: 18 }}>
            <div className="meta-row">
              <span className="mk">Public key</span>
              <code style={{ fontSize: '0.8rem' }}>{config.publicKey}</code>
            </div>
            <div className="meta-row">
              <span className="mk">Preview</span>
              <a className="link" href={`${origin}/widget?key=${config.publicKey}`} target="_blank" rel="noreferrer">
                Open form
              </a>
            </div>
          </div>

          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12, color: '#dc2626' }} onClick={rotate}>
            Rotate public key
          </button>
        </div>
      </div>
    </>
  );
}
