'use client';

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { ChatIcon, CopyIcon } from '@/components/icons';
import type { WidgetConfig } from '@/lib/types';

export default function WidgetSettingsPage() {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

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
      setTimeout(() => setSaved(false), 2000);
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

  function copySnippet() {
    navigator.clipboard?.writeText(scriptSnippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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

  const previewVars = { '--wc': color } as CSSProperties;

  return (
    <>
      <div className="page-head">
        <div>
          <h2 style={{ fontSize: '1.3rem' }}>Support widget</h2>
          <p>Customize the widget and embed it on your website with one snippet.</p>
        </div>
        <span className={`status-pill ${enabled ? 'status-on' : 'status-off'}`}>
          <span className="d" />
          {enabled ? 'Live' : 'Disabled'}
        </span>
      </div>

      <div className="detail-grid">
        <form className="panel panel-pad" onSubmit={save}>
          <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 16 }}>
            Appearance
          </h3>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="label" htmlFor="wt">Title</label>
            <input id="wt" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="ww">Welcome message</label>
            <textarea id="ww" className="textarea" value={welcome} onChange={(e) => setWelcome(e.target.value)} maxLength={300} required style={{ minHeight: 70 }} />
          </div>
          <div className="field">
            <label className="label" htmlFor="wc">Primary color</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                id="wc"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: 44, height: 38, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'none', cursor: 'pointer', padding: 2 }}
              />
              <input className="input" value={color} onChange={(e) => setColor(e.target.value)} style={{ maxWidth: 140 }} />
            </div>
          </div>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Widget enabled (customers can submit)
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            {saved && <span style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: 600 }}>Saved</span>}
          </div>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="panel panel-pad">
            <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 14 }}>
              Preview
            </h3>
            <div className="wpreview" style={previewVars}>
              <div className="wp-card">
                <div className="wp-header">
                  <div className="t">{title || 'Contact support'}</div>
                  <div className="w">{welcome || 'Send us a message and we will reply by email.'}</div>
                </div>
                <div className="wp-body">
                  <div className="wp-input" />
                  <div className="wp-input" />
                  <div className="wp-input tall" />
                  <div className="wp-btn">Send message</div>
                </div>
              </div>
              <div className="wp-launcher">
                <ChatIcon />
              </div>
            </div>
          </div>

          <div className="panel panel-pad">
            <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 10 }}>
              Embed on your website
            </h3>
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: 0 }}>
              Paste before the closing body tag. It adds a floating support button.
            </p>
            <pre className="snippet">{scriptSnippet}</pre>
            <button className="btn btn-secondary btn-sm" onClick={copySnippet}>
              <CopyIcon /> {copied ? 'Copied' : 'Copy snippet'}
            </button>

            <div style={{ marginTop: 16 }}>
              <div className="meta-row">
                <span className="mk">Public key</span>
                <code style={{ fontSize: '0.78rem' }}>{config.publicKey}</code>
              </div>
              <div className="meta-row">
                <span className="mk">Live form</span>
                <a className="link" href={`${origin}/widget?key=${config.publicKey}`} target="_blank" rel="noreferrer">
                  Open preview
                </a>
              </div>
            </div>

            <button className="btn btn-ghost btn-sm" style={{ marginTop: 12, color: '#dc2626' }} onClick={rotate}>
              Rotate public key
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
