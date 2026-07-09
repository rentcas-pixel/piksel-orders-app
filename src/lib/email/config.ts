import type { EmailMailboxConfig } from '@/lib/email/types';

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  return value === 'true' || value === '1';
}

export function getEmailMailboxConfig(): EmailMailboxConfig {
  const password = process.env.EMAIL_PASSWORD?.trim() ?? '';

  return {
    imapHost: process.env.EMAIL_IMAP_HOST?.trim() || 'mail.piksel.lt',
    imapPort: Number(process.env.EMAIL_IMAP_PORT || 993),
    imapSecure: readBool(process.env.EMAIL_IMAP_SECURE, true),
    smtpHost: process.env.EMAIL_SMTP_HOST?.trim() || 'mail.piksel.lt',
    smtpPort: Number(process.env.EMAIL_SMTP_PORT || 465),
    smtpSecure: readBool(process.env.EMAIL_SMTP_SECURE, true),
    username: process.env.EMAIL_USERNAME?.trim() || 'renatas@piksel.lt',
    fromName: process.env.EMAIL_FROM_NAME?.trim() || 'Piksel',
    passwordConfigured: password.length > 0,
  };
}

export function getEmailPassword(): string {
  const password = process.env.EMAIL_PASSWORD?.trim();
  if (!password) {
    throw new Error('EMAIL_PASSWORD nerastas .env.local faile.');
  }
  return password;
}

export function assertEmailConfigReady(): EmailMailboxConfig {
  const config = getEmailMailboxConfig();
  if (!config.passwordConfigured) {
    throw new Error('Nustatykite EMAIL_PASSWORD .env.local faile.');
  }
  if (!config.username) {
    throw new Error('Nustatykite EMAIL_USERNAME .env.local faile.');
  }
  return config;
}

/** Kiek dienų atgal imti laiškus (numatyta 14). */
export function getEmailSyncDays(): number {
  const raw = Number(process.env.EMAIL_SYNC_DAYS || 14);
  if (!Number.isFinite(raw) || raw < 1) return 14;
  return Math.min(Math.floor(raw), 90);
}

/** Jei true — imami tik neskaityti laiškai. */
export function isEmailSyncUnreadOnly(): boolean {
  const value = process.env.EMAIL_SYNC_UNREAD_ONLY?.trim().toLowerCase();
  return value === 'true' || value === '1';
}

/** Maks. laiškų per vieną sync (AI kvietimų limitas). */
export function getEmailSyncMaxPerRun(): number {
  const raw = Number(process.env.EMAIL_SYNC_MAX_PER_RUN || 25);
  if (!Number.isFinite(raw) || raw < 1) return 25;
  return Math.min(Math.floor(raw), 100);
}
