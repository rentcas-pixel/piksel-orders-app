'use client';

import { useEmailAutoSync } from '@/lib/email/use-email-auto-sync';

interface EmailAutoSyncProps {
  enabled?: boolean;
  onNewEmails?: (count: number) => void;
}

export function EmailAutoSync({ enabled = true, onNewEmails }: EmailAutoSyncProps) {
  useEmailAutoSync({ enabled, onNewEmails });
  return null;
}
