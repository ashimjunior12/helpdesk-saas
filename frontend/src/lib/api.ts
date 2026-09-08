/**
 * Small helper for reaching the backend API. Centralizes the base URL so
 * feature code never hardcodes it. Real typed API clients arrive in later
 * phases; for now this just powers the foundation health check.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export interface HealthResponse {
  success: boolean;
  data: {
    status: string;
    environment: string;
    uptimeSeconds: number;
    timestamp: string;
    dependencies: { database: string };
  };
}

export async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, { cache: 'no-store' });
    return (await res.json()) as HealthResponse;
  } catch {
    // Backend not running / unreachable — the page renders a disconnected state.
    return null;
  }
}
