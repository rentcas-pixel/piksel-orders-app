import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { assertEmailConfigReady, getEmailPassword } from '@/lib/email/config';
import {
  getStyleFolderKeys,
  getStyleMaxEmails,
} from '@/lib/email/imap-mailboxes';
import { resolveMailbox } from '@/lib/email/imap-mailboxes-server';
import { stripEmailSignature } from '@/lib/email/signature';

export interface StyleSampleEmail {
  folder: string;
  subject: string | null;
  date: Date;
  bodyText: string;
}

function truncateBody(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

function stripQuotedReply(text: string): string {
  const lines = text.split('\n');
  const cutPatterns = [
    /^On .+ wrote:$/i,
    /^>.+/,
    /^-{2,}\s*Original Message/i,
    /^From:/i,
    /^202\d-.+wrote:$/i,
  ];

  const kept: string[] = [];
  for (const line of lines) {
    if (cutPatterns.some((pattern) => pattern.test(line.trim()))) break;
    kept.push(line);
  }
  return kept.join('\n').trim();
}

function toDate(value: string | Date | undefined): Date {
  if (!value) return new Date();
  return value instanceof Date ? value : new Date(value);
}

function getImapErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Nežinoma IMAP klaida.';
  const responseText =
    typeof error === 'object' &&
    error !== null &&
    'responseText' in error &&
    typeof (error as { responseText?: unknown }).responseText === 'string'
      ? (error as { responseText: string }).responseText
      : null;
  if (responseText) {
    return `${error.message}: ${responseText}`;
  }
  return error.message;
}

async function processStyleMessage(
  message: { source?: Buffer; internalDate?: Date | string; uid?: number },
  folderPath: string,
  folderKey: string,
  username: string
): Promise<StyleSampleEmail | null> {
  if (!message.source) return null;

  const parsed = await simpleParser(message.source);
  const rawBody = parsed.text ?? '';
  const cleaned = stripQuotedReply(stripEmailSignature(rawBody));
  if (cleaned.length < 20) return null;

  const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase() ?? '';
  const isOwnSent =
    folderKey === 'Sent' || fromAddress === username.toLowerCase();

  if (folderKey === 'Archive' && !isOwnSent) {
    return null;
  }

  return {
    folder: folderPath,
    subject: parsed.subject ?? null,
    date: toDate(message.internalDate),
    bodyText: truncateBody(cleaned, 1200),
  };
}

async function fetchRecentMessagesForStyle(
  client: ImapFlow,
  remaining: number
): Promise<Array<{ source?: Buffer; internalDate?: Date | string; uid?: number }>> {
  const exists = client.mailbox?.exists ?? 0;
  if (!exists || remaining <= 0) return [];

  const scanCount = Math.min(Math.max(remaining * 5, 100), exists);
  const startSeq = Math.max(1, exists - scanCount + 1);
  const messages: Array<{ source?: Buffer; internalDate?: Date | string; uid?: number }> = [];

  for await (const message of client.fetch(`${startSeq}:*`, {
    source: true,
    internalDate: true,
  })) {
    messages.push(message);
  }

  return messages.reverse();
}

export async function fetchEmailsForStyleLearning(): Promise<StyleSampleEmail[]> {
  const config = assertEmailConfigReady();
  const password = getEmailPassword();
  const folderKeys = getStyleFolderKeys();
  const maxEmails = getStyleMaxEmails();
  const samples: StyleSampleEmail[] = [];
  const username = config.username.toLowerCase();

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

  try {
    for (const folderKey of folderKeys) {
      if (samples.length >= maxEmails) break;

      const mailboxPath = await resolveMailbox(client, folderKey);
      if (!mailboxPath) continue;

      const lock = await client.getMailboxLock(mailboxPath);
      try {
        const remaining = maxEmails - samples.length;
        const recentMessages = await fetchRecentMessagesForStyle(client, remaining);

        for (const message of recentMessages) {
          if (samples.length >= maxEmails) break;

          const sample = await processStyleMessage(
            message,
            mailboxPath,
            folderKey,
            username
          );
          if (sample) samples.push(sample);
        }
      } catch (error) {
        throw new Error(
          `Nepavyko skaityti „${mailboxPath}“ aplanko: ${getImapErrorMessage(error)}`
        );
      } finally {
        lock.release();
      }
    }
  } finally {
    await client.logout();
  }

  return samples;
}
