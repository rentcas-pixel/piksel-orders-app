import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import {
  assertEmailConfigReady,
  getEmailPassword,
  getEmailSyncDays,
  isEmailSyncUnreadOnly,
} from '@/lib/email/config';
import type { EmailAttachmentMeta } from '@/lib/email/types';
import {
  extractRecipientsFromParsedMail,
  extractRecipientsFromRawSource,
} from '@/lib/email/email-addresses';

export interface FetchedEmailMessage {
  uid: number;
  messageId: string | null;
  inReplyTo: string | null;
  referenceIds: string[];
  subject: string | null;
  fromAddress: string | null;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  receivedAt: Date;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: EmailAttachmentMeta[];
  isSeen: boolean;
}

function toDate(value: string | Date | undefined): Date {
  if (!value) return new Date();
  return value instanceof Date ? value : new Date(value);
}

function extractAddress(value: { address?: string; name?: string } | undefined) {
  return {
    address: value?.address ?? null,
    name: value?.name ?? null,
  };
}

export async function fetchRecentMailboxEmails(
  mailboxPath: string,
  knownUids: Set<number>
): Promise<FetchedEmailMessage[]> {
  const config = assertEmailConfigReady();
  const password = getEmailPassword();
  const syncDays = getEmailSyncDays();
  const unreadOnly = isEmailSyncUnreadOnly();
  const since = new Date(Date.now() - syncDays * 24 * 60 * 60 * 1000);

  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: {
      user: config.username,
      pass: password,
    },
    logger: false,
  });

  const results: FetchedEmailMessage[] = [];

  await client.connect();
  const lock = await client.getMailboxLock(mailboxPath);

  try {
    const searchSince = new Date(since);
    searchSince.setHours(0, 0, 0, 0);

    const searchQuery = unreadOnly
      ? { seen: false as const, since: searchSince }
      : { since: searchSince };

    for await (const message of client.fetch(searchQuery, {
      uid: true,
      flags: true,
      source: true,
      internalDate: true,
    })) {
      if (!message.uid || knownUids.has(message.uid)) continue;

      const receivedAt = toDate(message.internalDate);
      if (receivedAt.getTime() < since.getTime()) continue;
      if (!message.source) continue;

      results.push(
        await parseFetchedMessage(
          message.uid,
          message.source,
          message.internalDate,
          message.flags?.has('\\Seen') ?? false
        )
      );
    }
  } finally {
    lock.release();
    await client.logout();
  }

  results.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  return results;
}

async function parseFetchedMessage(
  uid: number,
  source: Buffer,
  internalDate: Date | string | undefined,
  isSeen: boolean
): Promise<FetchedEmailMessage> {
  const parsed = await simpleParser(source);
  const from = extractAddress(parsed.from?.value?.[0]);
  let { toAddresses, ccAddresses } = extractRecipientsFromParsedMail(parsed);

  if (toAddresses.length === 0 && ccAddresses.length === 0) {
    const rawRecipients = extractRecipientsFromRawSource(source);
    toAddresses = rawRecipients.toAddresses;
    ccAddresses = rawRecipients.ccAddresses;
  }

  const attachments: EmailAttachmentMeta[] = (parsed.attachments ?? []).map((item) => ({
    filename: item.filename || 'be-pavadinimo',
    contentType: item.contentType || 'application/octet-stream',
    size: item.size ?? 0,
  }));

  const references = Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
      ? [parsed.references]
      : [];

  return {
    uid,
    messageId: parsed.messageId ?? null,
    inReplyTo: parsed.inReplyTo ?? null,
    referenceIds: references.filter((item): item is string => typeof item === 'string'),
    subject: parsed.subject ?? null,
    fromAddress: from.address,
    fromName: from.name,
    toAddresses,
    ccAddresses,
    receivedAt: toDate(internalDate),
    bodyText: parsed.text ?? null,
    bodyHtml: typeof parsed.html === 'string' ? parsed.html : null,
    attachments,
    isSeen,
  };
}

export async function fetchMailboxEmailsByUids(
  mailboxPath: string,
  uids: number[]
): Promise<FetchedEmailMessage[]> {
  const uniqueUids = [...new Set(uids.filter((uid) => Number.isFinite(uid) && uid > 0))];
  if (uniqueUids.length === 0) return [];

  const config = assertEmailConfigReady();
  const password = getEmailPassword();

  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: {
      user: config.username,
      pass: password,
    },
    logger: false,
  });

  const results: FetchedEmailMessage[] = [];

  await client.connect();
  const lock = await client.getMailboxLock(mailboxPath);

  try {
    const fetched = await client.fetchAll(
      uniqueUids,
      { uid: true, flags: true, source: true, internalDate: true },
      { uid: true }
    );

    for (const message of fetched) {
      if (!message.uid || !message.source) continue;
      results.push(
        await parseFetchedMessage(
          message.uid,
          message.source,
          message.internalDate,
          message.flags?.has('\\Seen') ?? false
        )
      );
    }
  } finally {
    lock.release();
    await client.logout();
  }

  return results;
}

export async function fetchRecentInboxEmails(
  knownUids: Set<number>
): Promise<FetchedEmailMessage[]> {
  return fetchRecentMailboxEmails('INBOX', knownUids);
}

/** Greitas INBOX UID skenavimas — be laiško turinio (foniniam tikrinimui). */
export async function listNewInboxUids(knownUids: Set<number>): Promise<number[]> {
  const config = assertEmailConfigReady();
  const password = getEmailPassword();
  const syncDays = getEmailSyncDays();
  const unreadOnly = isEmailSyncUnreadOnly();
  const since = new Date(Date.now() - syncDays * 24 * 60 * 60 * 1000);

  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: { user: config.username, pass: password },
    logger: false,
  });

  const newUids: number[] = [];

  await client.connect();
  const lock = await client.getMailboxLock('INBOX');

  try {
    const searchSince = new Date(since);
    searchSince.setHours(0, 0, 0, 0);

    const searchQuery = unreadOnly
      ? { seen: false as const, since: searchSince }
      : { since: searchSince };

    for await (const message of client.fetch(searchQuery, { uid: true, internalDate: true })) {
      if (!message.uid || knownUids.has(message.uid)) continue;
      const receivedAt = toDate(message.internalDate);
      if (receivedAt.getTime() < since.getTime()) continue;
      newUids.push(message.uid);
    }
  } finally {
    lock.release();
    await client.logout();
  }

  return newUids;
}

export async function fetchInboxSeenByUid(since: Date): Promise<Map<number, boolean>> {
  const config = assertEmailConfigReady();
  const password = getEmailPassword();
  const seenByUid = new Map<number, boolean>();

  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: { user: config.username, pass: password },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock('INBOX');

  try {
    const searchSince = new Date(since);
    searchSince.setHours(0, 0, 0, 0);

    for await (const message of client.fetch(
      { since: searchSince },
      { uid: true, flags: true }
    )) {
      if (!message.uid) continue;
      seenByUid.set(message.uid, message.flags?.has('\\Seen') ?? false);
    }
  } finally {
    lock.release();
    await client.logout();
  }

  return seenByUid;
}

export async function testImapConnection(): Promise<void> {
  const config = assertEmailConfigReady();
  const password = getEmailPassword();

  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: {
      user: config.username,
      pass: password,
    },
    logger: false,
  });

  await client.connect();
  await client.logout();
}
