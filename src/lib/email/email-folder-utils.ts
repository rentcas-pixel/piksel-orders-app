export function isArchivedFolder(folder: string): boolean {
  const normalized = folder.toLowerCase();
  return (
    normalized === 'archive' ||
    normalized === 'archives' ||
    normalized.endsWith('.archive') ||
    normalized.includes('archyv')
  );
}

export function isSentFolder(folder: string): boolean {
  const normalized = folder.toLowerCase();
  return (
    normalized === 'sent' ||
    normalized.endsWith('.sent') ||
    normalized.includes('sent items') ||
    normalized.includes('sent messages') ||
    normalized.includes('sent mail')
  );
}

export function isEmailSent(email: { folder: string; draft_status?: string }): boolean {
  return isSentFolder(email.folder) || email.draft_status === 'sent';
}

export function isEmailArchived(email: {
  archived_at?: string | null;
  folder: string;
}): boolean {
  return Boolean(email.archived_at) || isArchivedFolder(email.folder);
}
