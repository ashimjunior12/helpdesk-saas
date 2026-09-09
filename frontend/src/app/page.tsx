import { fetchHealth } from '@/lib/api';

/**
 * Foundation landing page. Server-side fetches the backend health endpoint to
 * prove the frontend/backend wiring works end to end. This is placeholder UI
 * for Phase 0 - real product screens come in later phases.
 */
export default async function HomePage() {
  const health = await fetchHealth();
  const connected = health?.success ?? false;

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Helpdesk SaaS</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>Phase 0 - Project Foundation</p>

      <section
        style={{
          marginTop: '2rem',
          padding: '1.25rem 1.5rem',
          borderRadius: 12,
          background: '#151b31',
          border: '1px solid #26304f',
        }}
      >
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Backend status</h2>
        {health ? (
          <ul style={{ lineHeight: 1.9, margin: 0, paddingLeft: '1.1rem' }}>
            <li>API: <strong>{connected ? 'connected' : 'degraded'}</strong></li>
            <li>Environment: {health.data.environment}</li>
            <li>Database: {health.data.dependencies.database}</li>
            <li>Uptime: {health.data.uptimeSeconds}s</li>
          </ul>
        ) : (
          <p style={{ color: '#ff8f8f', margin: 0 }}>
            Cannot reach the backend API. Start it with <code>npm run dev</code> in{' '}
            <code>/backend</code>.
          </p>
        )}
      </section>
    </main>
  );
}
