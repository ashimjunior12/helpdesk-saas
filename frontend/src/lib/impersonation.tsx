'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { clearActiveOrg, getActiveOrg, setActiveOrg, type ActiveOrg } from './api';

interface ImpersonationValue {
  activeOrg: ActiveOrg | null;
  enterOrg: (org: ActiveOrg) => void;
  exitOrg: () => void;
}

const ImpersonationContext = createContext<ImpersonationValue | null>(null);

// Tracks which organization a super admin is currently working inside. Kept in
// React state (for reactive UI) and mirrored to storage (so the API client can
// attach the X-Organization-Id header).
export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [activeOrg, setActive] = useState<ActiveOrg | null>(() => getActiveOrg());

  const enterOrg = useCallback((org: ActiveOrg) => {
    setActiveOrg(org);
    setActive(org);
  }, []);

  const exitOrg = useCallback(() => {
    clearActiveOrg();
    setActive(null);
  }, []);

  return (
    <ImpersonationContext.Provider value={{ activeOrg, enterOrg, exitOrg }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation(): ImpersonationValue {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider');
  return ctx;
}
