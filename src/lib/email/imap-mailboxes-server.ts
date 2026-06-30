import { ImapFlow, type ListResponse } from 'imapflow';
import { assertEmailConfigReady, getEmailPassword } from '@/lib/email/config';
import {
  isArchivedFolder,
  MAILBOX_CANDIDATES,
} from '@/lib/email/imap-mailboxes';

function isSelectableMailbox(mailbox: ListResponse): boolean {
  return !mailbox.flags?.has('\\Noselect');
}

function mailboxDisplayName(mailbox: ListResponse): string {
  return (mailbox.name || mailbox.path || '').toLowerCase();
}

/**
 * Randa archyvo aplanką taip, kaip jį mato Spark ir kiti IMAP klientai.
 * Jei yra keli kandidatai — renkamas užprenumeruotas aplankas su daugiausiai laiškų
 * (t. y. tas, kurį Spark jau naudoja).
 */
export async function findArchiveMailbox(client: ImapFlow): Promise<string | null> {
  const override = process.env.EMAIL_ARCHIVE_FOLDER?.trim();
  if (override) {
    try {
      const lock = await client.getMailboxLock(override);
      lock.release();
      return override;
    } catch {
      console.warn(`EMAIL_ARCHIVE_FOLDER="${override}" nerastas serveryje`);
    }
  }

  const mailboxes = (await client.list({ statusQuery: { messages: true } })).filter(
    isSelectableMailbox
  );

  const candidates = mailboxes.filter((mailbox) => {
    if (mailbox.specialUse === '\\Archive') return true;
    if (mailboxDisplayName(mailbox) === 'archive') return true;
    if (isArchivedFolder(mailbox.path) || isArchivedFolder(mailbox.name || '')) return true;
    return false;
  });

  if (candidates.length === 0) return null;

  candidates.sort((left, right) => scoreArchiveCandidate(right) - scoreArchiveCandidate(left));
  return candidates[0].path;
}

function scoreArchiveCandidate(mailbox: ListResponse): number {
  let score = 0;
  if (mailbox.specialUse === '\\Archive') score += 100;
  if (mailbox.subscribed) score += 50;
  if (mailboxDisplayName(mailbox) === 'archive') score += 30;
  score += Math.min(mailbox.status?.messages ?? 0, 40);
  return score;
}

export async function subscribeArchiveMailbox(
  client: ImapFlow,
  archivePath: string
): Promise<void> {
  try {
    await client.mailboxSubscribe(archivePath);
  } catch (error) {
    console.warn(`Nepavyko užprenumeruoti archyvo aplanko „${archivePath}“:`, error);
  }
}

export async function resolveSentMailboxPath(): Promise<string | null> {
  const config = assertEmailConfigReady();
  const password = getEmailPassword();

  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: { user: config.username, pass: password },
    logger: false,
  });

  await client.connect();
  try {
    return await resolveMailbox(client, 'Sent');
  } finally {
    await client.logout();
  }
}

export async function resolveMailbox(
  client: ImapFlow,
  folderKey: keyof typeof MAILBOX_CANDIDATES | string
): Promise<string | null> {
  const candidates =
    MAILBOX_CANDIDATES[folderKey as keyof typeof MAILBOX_CANDIDATES] ?? [folderKey];
  const normalizedKey = folderKey.toLowerCase();

  const mailboxes = await client.list();

  for (const mailbox of mailboxes) {
    if (mailbox.flags?.has('\\Noselect')) continue;

    if (folderKey === 'Sent' && mailbox.specialUse === '\\Sent') {
      return mailbox.path;
    }
    if (folderKey === 'Archive' && mailbox.specialUse === '\\Archive') {
      return mailbox.path;
    }

    const name = (mailbox.name || mailbox.path || '').toLowerCase();
    if (folderKey === 'Archive' && name === 'archive') {
      return mailbox.path;
    }

    if (name === normalizedKey || name.endsWith(`.${normalizedKey}`)) {
      return mailbox.path;
    }
  }

  for (const candidate of candidates) {
    try {
      const lock = await client.getMailboxLock(candidate);
      lock.release();
      return candidate;
    } catch {
      // try next
    }
  }

  return null;
}

/** Randa arba sukuria archyvo aplanką, suderinamą su Spark / Apple Mail / Thunderbird. */
export async function ensureArchiveMailbox(client: ImapFlow): Promise<string> {
  const existing = await findArchiveMailbox(client);
  if (existing) {
    await subscribeArchiveMailbox(client, existing);
    return existing;
  }

  for (const candidate of MAILBOX_CANDIDATES.Archive) {
    try {
      await client.mailboxCreate(candidate);
      const created = (await findArchiveMailbox(client)) ?? candidate;
      await subscribeArchiveMailbox(client, created);
      return created;
    } catch {
      // bandome kitą pavadinimą
    }
  }

  throw new Error(
    'Nepavyko rasti ar sukurti Archive aplanko. Spark naudoja aplanką „Archive“ — sukurkite jį per Spark arba webmail, arba nustatykite EMAIL_ARCHIVE_FOLDER .env.local.'
  );
}
