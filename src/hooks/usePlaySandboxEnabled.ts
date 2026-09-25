'use client';

import { useEffect, useState } from 'react';
import { isPlaySandboxEnabled } from '@/lib/play-sandbox-paths';

export function usePlaySandboxState(): { ready: boolean; enabled: boolean } {
  const [state, setState] = useState({ ready: false, enabled: false });

  useEffect(() => {
    setState({ ready: true, enabled: isPlaySandboxEnabled(window.location.host) });
  }, []);

  return state;
}

export function usePlaySandboxEnabled(): boolean {
  return usePlaySandboxState().enabled;
}
