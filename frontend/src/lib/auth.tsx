'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, clearTokens, getAccessToken, setTokens } from './api';
import type { AuthUser } from './types';

interface AuthTokens {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  createOrganization: (name: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<{ user: AuthUser }>('/api/auth/me');
      setUser(data.user);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<AuthTokens>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const data = await apiFetch<AuthTokens>('/api/auth/register', {
      method: 'POST',
      body: { email, password, name },
      auth: false,
    });
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const createOrganization = useCallback(async (name: string) => {
    const data = await apiFetch<{ accessToken: string; refreshToken: string }>('/api/organizations', {
      method: 'POST',
      body: { name },
    });
    // Org creation reissues tokens carrying the new org context.
    setTokens(data.accessToken, data.refreshToken);
    const me = await apiFetch<{ user: AuthUser }>('/api/auth/me');
    setUser(me.user);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, createOrganization, logout, refresh: loadMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
