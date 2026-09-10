import { fetchHealth } from '@/lib/api';

const FEATURES = [
  {
    title: 'Multi-tenant by design',
    body: 'Strict per-organization isolation. Every query is scoped to the authenticated org, and cross-tenant access returns 404.',
  },
  {
    title: 'Tickets and conversations',
    body: 'A validated status workflow, priorities, assignment, threaded messages, and private internal notes that never reach customers.',
  },
  {
    title: 'Real-time updates',
    body: 'Socket.IO with JWT-authenticated connections and tenant-scoped rooms for live messages, ticket changes, and notifications.',
  },
  {
    title: 'SLA and automation',
    body: 'Per-organization SLA targets with breach detection, plus rules that triage and route tickets automatically on creation.',
  },
  {
    title: 'Search and analytics',
    body: 'Fast cross-entity search and an aggregated overview of ticket volume, status, priority, and response times.',
  },
  {
    title: 'API and widget',
    body: 'A public REST API secured by hashed keys, and an embeddable support widget for your own website.',
  },
];

const ENDPOINTS = [
  { method: 'POST', path: '/api/auth/login' },
  { method: 'GET', path: '/api/tickets' },
  { method: 'POST', path: '/api/tickets/:id/messages' },
  { method: 'GET', path: '/api/analytics/overview' },
  { method: 'POST', path: '/api/public/v1/tickets' },
  { method: 'GET', path: '/metrics' },
];

export default async function HomePage() {
  const health = await fetchHealth();
  const dbUp = health?.data?.dependencies?.database === 'up';
  const apiReachable = health !== null;

  const statusLabel = !apiReachable
    ? 'API unreachable'
    : dbUp
      ? 'API operational'
      : 'API up, database unavailable';
  const dotClass = !apiReachable ? 'dot-down' : dbUp ? 'dot-up' : 'dot-down';

  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <div className="brand">
            <span className="brand-mark">H</span>
            <span>Helpdesk SaaS</span>
          </div>
          <nav className="nav-links">
            <a href="/widget?key=demo">Widget</a>
            <a href="https://github.com/ashimjunior12/helpdesk-saas">Source</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container">
            <span className="eyebrow">Customer support platform</span>
            <h1>Support software for modern teams</h1>
            <p>
              A multi-tenant helpdesk: manage customers, receive and route tickets, converse in
              real time, track SLAs, and automate triage. Built as a production-style API with a
              modular monolith architecture.
            </p>
            <div className="actions">
              <a className="btn btn-primary" href="https://github.com/ashimjunior12/helpdesk-saas">
                View the source
              </a>
              <a className="btn btn-secondary" href="/widget?key=demo">
                See the widget
              </a>
            </div>
            <div className="status">
              <span className={`dot ${dotClass}`} aria-hidden="true" />
              {statusLabel}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2 className="section-title">Capabilities</h2>
            <div className="grid">
              {FEATURES.map((f) => (
                <article key={f.title} className="card">
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2 className="section-title">A sample of the API</h2>
            <div className="endpoints">
              {ENDPOINTS.map((e) => (
                <div key={`${e.method} ${e.path}`} className="endpoint">
                  <span className="method">{e.method}</span>
                  <span className="path">{e.path}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">Helpdesk SaaS. Node.js, Express, TypeScript, MongoDB, Next.js.</div>
      </footer>
    </>
  );
}
