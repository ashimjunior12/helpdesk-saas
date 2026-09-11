export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

const ACCESS_KEY = 'hd_access';
const REFRESH_KEY = 'hd_refresh';
const ACTIVE_ORG_KEY = 'hd_active_org';

export interface ActiveOrg {
  id: string;
  name: string;
}

// The organization a SUPER_ADMIN is currently acting inside. Sent as
// X-Organization-Id so org-scoped endpoints operate on that org. Unused by
// normal org users (their org comes from the token).
export function getActiveOrg(): ActiveOrg | null {
  const raw = read(ACTIVE_ORG_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveOrg;
  } catch {
    return null;
  }
}

export function setActiveOrg(org: ActiveOrg): void {
  try {
    window.localStorage.setItem(ACTIVE_ORG_KEY, JSON.stringify(org));
  } catch {
    // ignore
  }
}

export function clearActiveOrg(): void {
  try {
    window.localStorage.removeItem(ACTIVE_ORG_KEY);
  } catch {
    // ignore
  }
}

function read(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return read(ACCESS_KEY);
}

export function setTokens(access: string, refresh: string): void {
  try {
    window.localStorage.setItem(ACCESS_KEY, access);
    window.localStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

export function clearTokens(): void {
  try {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
  }
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

// Attempts to refresh the access token once. Returns true on success.
async function refresh(): Promise<boolean> {
  const refreshToken = read(REFRESH_KEY);
  if (!refreshToken) return false;
  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const json = (await parse(res)) as { data: { accessToken: string; refreshToken: string } };
  setTokens(json.data.accessToken, json.data.refreshToken);
  return true;
}

interface Options {
  method?: string;
  body?: unknown;
  auth?: boolean;
  _retried?: boolean;
}

// Central fetch wrapper: attaches the bearer token, unwraps the response
// envelope, throws ApiError on failure, and transparently refreshes once on an
// expired access token.
export async function apiFetch<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getAccessToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const activeOrg = getActiveOrg();
  if (auth && activeOrg) headers['X-Organization-Id'] = activeOrg.id;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && auth && !options._retried && (await refresh())) {
    return apiFetch<T>(path, { ...options, _retried: true });
  }

  const json = (await parse(res)) as { success?: boolean; data?: T; error?: { code: string; message: string } };
  if (!res.ok || json.success === false) {
    const err = json.error;
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? 'Request failed');
  }
  return json.data as T;
}
