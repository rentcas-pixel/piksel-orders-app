'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  playNewEmailNotificationSound,
  unlockEmailNotificationAudio,
} from '@/lib/email/email-notification-sound';

/** Pilnas sync (su AI) — ne dažniau nei kas 5 min. */
export const EMAIL_AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Greitas IMAP UID tikrinimas — kas 90 s, kai skirtukas matomas. */
const EMAIL_POLL_INTERVAL_MS = 90 * 1000;

const SYNC_FETCH_TIMEOUT_MS = 150_000;

interface UseEmailAutoSyncOptions {
  enabled?: boolean;
  intervalMs?: number;
  onNewEmails?: (count: number) => void;
}

async function pollForNewInboxMessages(): Promise<number> {
  const response = await fetch('/api/email/poll', { cache: 'no-store' });
  if (!response.ok) return 0;
  const payload = (await response.json()) as { newInboxCount?: number };
  return payload.newInboxCount ?? 0;
}

async function runFullSync(): Promise<number> {
  const response = await fetch('/api/email/sync', {
    method: 'POST',
    signal: AbortSignal.timeout(SYNC_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Sync HTTP ${response.status}`);
  }
  const payload = (await response.json()) as { data?: { processed: number } };
  return payload.data?.processed ?? 0;
}

export function useEmailAutoSync(options?: UseEmailAutoSyncOptions) {
  const enabled = options?.enabled ?? true;
  const fullSyncIntervalMs = options?.intervalMs ?? EMAIL_AUTO_SYNC_INTERVAL_MS;
  const onNewEmailsRef = useRef(options?.onNewEmails);
  onNewEmailsRef.current = options?.onNewEmails;

  const syncingRef = useRef(false);
  const lastFullSyncAtRef = useRef(0);
  const lastPollAtRef = useRef(0);

  const syncIfNeeded = useCallback(async (reason: 'poll' | 'interval' | 'startup' | 'focus') => {
    if (syncingRef.current) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    const now = Date.now();
    const dueForFullSync = now - lastFullSyncAtRef.current >= fullSyncIntervalMs;

    try {
      let newInboxCount = 0;
      if (reason !== 'interval' || !dueForFullSync) {
        newInboxCount = await pollForNewInboxMessages();
        lastPollAtRef.current = now;
      }

      const shouldFullSync =
        newInboxCount > 0 || (reason === 'interval' && dueForFullSync);

      if (!shouldFullSync) return;

      syncingRef.current = true;
      const processed = await runFullSync();
      lastFullSyncAtRef.current = Date.now();

      if (processed > 0) {
        playNewEmailNotificationSound();
        onNewEmailsRef.current?.(processed);
      }
    } catch (error) {
      console.warn(`Foninis email sync (${reason}) nepavyko:`, error);
    } finally {
      syncingRef.current = false;
    }
  }, [fullSyncIntervalMs]);

  useEffect(() => {
    if (!enabled) return;

    const unlock = () => unlockEmailNotificationAudio();
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    const startupTimer = window.setTimeout(() => {
      void syncIfNeeded('startup');
    }, 3000);

    const pollTimer = window.setInterval(() => {
      void syncIfNeeded('poll');
    }, EMAIL_POLL_INTERVAL_MS);

    const fullSyncTimer = window.setInterval(() => {
      void syncIfNeeded('interval');
    }, fullSyncIntervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const sincePoll = Date.now() - lastPollAtRef.current;
      if (sincePoll >= EMAIL_POLL_INTERVAL_MS) {
        void syncIfNeeded('focus');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearTimeout(startupTimer);
      clearInterval(pollTimer);
      clearInterval(fullSyncTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [enabled, fullSyncIntervalMs, syncIfNeeded]);

  return { syncNow: () => syncIfNeeded('focus') };
}
