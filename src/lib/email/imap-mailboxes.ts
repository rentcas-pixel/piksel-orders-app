export {
  isArchivedFolder,
  isEmailArchived,
  isEmailSent,
  isSentFolder,
} from '@/lib/email/email-folder-utils';

export const MAILBOX_CANDIDATES: Record<string, string[]> = {
  Sent: ['Sent', 'INBOX.Sent', 'Sent Items', 'Sent Messages', 'Sent Mail'],
  Archive: ['Archive', 'INBOX.Archive', 'Archives', 'Archyvai'],
  INBOX: ['INBOX'],
};

export function getStyleFolderKeys(): string[] {
  const raw = process.env.EMAIL_STYLE_FOLDERS?.trim();
  if (!raw) return ['Sent', 'Archive'];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getStyleMaxEmails(): number {
  const raw = Number(process.env.EMAIL_STYLE_MAX_EMAILS || 40);
  if (!Number.isFinite(raw) || raw < 5) return 40;
  return Math.min(Math.floor(raw), 100);
}
