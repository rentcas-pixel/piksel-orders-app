'use client';

import { useEffect, useState } from 'react';
import type { AppRole } from '@/lib/app-permissions';
import type { AppTab, InvoicesSubTab } from '@/lib/app-navigation';

export interface AppSession {
  email: string;
  role: AppRole;
  visibleTabs: AppTab[];
  visibleInvoicesSubTabs: InvoicesSubTab[];
}

export function useAppSession() {
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/app/me', { cache: 'no-store' });
        if (cancelled) return;

        if (response.status === 401) {
          window.location.assign('/login');
          return;
        }

        if (!response.ok) {
          setError('Nepavyko užkrauti sesijos.');
          setLoading(false);
          return;
        }

        const data = (await response.json()) as AppSession;
        setSession(data);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Nepavyko užkrauti sesijos.');
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { session, loading, error };
}
