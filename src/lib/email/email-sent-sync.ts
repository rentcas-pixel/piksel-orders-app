import { EmailService } from '@/lib/email/email-service';
import { hasRecipientAddresses } from '@/lib/email/email-addresses';
import { isEmailSent } from '@/lib/email/email-folder-utils';
import { fetchMailboxEmailsByUids, fetchRecentMailboxEmails } from '@/lib/email/imap-client';
import { resolveSentMailboxPath } from '@/lib/email/imap-mailboxes-server';
import type { ProcessedEmail } from '@/lib/email/types';

export async function fetchImapRecipientsForEmails(
  emails: Array<{
    id: string;
    imap_uid: number;
    folder: string;
    to_addresses?: string[];
  }>,
  sentPath: string
): Promise<Record<string, { to_addresses: string[]; cc_addresses: string[] }>> {
  const missing = emails
    .filter(
      (email) =>
        !hasRecipientAddresses(email.to_addresses) &&
        Number.isFinite(email.imap_uid) &&
        email.imap_uid > 0
    )
    .slice(0, 100);

  if (missing.length === 0) return {};

  const byFolder = new Map<string, typeof missing>();
  for (const email of missing) {
    const folder = email.folder || sentPath;
    const list = byFolder.get(folder) ?? [];
    list.push(email);
    byFolder.set(folder, list);
  }

  const resolved = new Map<number, { to: string[]; cc: string[] }>();
  for (const [folder, folderEmails] of byFolder) {
    const uids = folderEmails.map((email) => email.imap_uid);
    try {
      const messages = await fetchMailboxEmailsByUids(folder, uids);
      for (const message of messages) {
        if (message.toAddresses.length === 0 && message.ccAddresses.length === 0) continue;
        resolved.set(message.uid, {
          to: message.toAddresses,
          cc: message.ccAddresses,
        });
      }
    } catch (error) {
      console.warn(`Nepavyko gauti gavėjų iš „${folder}“:`, error);
    }
  }

  const result: Record<string, { to_addresses: string[]; cc_addresses: string[] }> = {};
  for (const email of missing) {
    const recipients = resolved.get(email.imap_uid);
    if (!recipients) continue;
    result[email.id] = {
      to_addresses: recipients.to,
      cc_addresses: recipients.cc,
    };
    void EmailService.updateRecipients(email.id, {
      to_addresses: recipients.to,
      cc_addresses: recipients.cc,
    }).catch(() => {});
  }

  return result;
}

export async function enrichSentEmailsWithImapRecipients(
  emails: ProcessedEmail[],
  sentPath: string
): Promise<ProcessedEmail[]> {
  const recipients = await fetchImapRecipientsForEmails(emails, sentPath);
  if (Object.keys(recipients).length === 0) return emails;

  return emails.map((email) => {
    const resolved = recipients[email.id];
    if (!resolved || hasRecipientAddresses(email.to_addresses)) return email;
    return {
      ...email,
      to_addresses: resolved.to_addresses,
      cc_addresses: resolved.cc_addresses.length
        ? resolved.cc_addresses
        : email.cc_addresses,
    };
  });
}

export async function backfillSentRecipients(
  sentPath: string
): Promise<{ updated: number; errors: string[] }> {
  const missing = await EmailService.listSentMissingRecipients();
  if (missing.length === 0) {
    return { updated: 0, errors: [] };
  }

  const missingByUid = new Map(missing.map((row) => [row.imap_uid, row]));
  const folders = [...new Set(missing.map((row) => row.folder || sentPath))];

  let updated = 0;
  const errors: string[] = [];
  const resolvedMessages = new Map<number, Awaited<ReturnType<typeof fetchMailboxEmailsByUids>>[number]>();

  for (const folder of folders) {
    const folderMissing = missing.filter((row) => (row.folder || sentPath) === folder);
    const uids = folderMissing.map((row) => row.imap_uid);

    try {
      const byUid = await fetchMailboxEmailsByUids(folder, uids);
      for (const message of byUid) {
        resolvedMessages.set(message.uid, message);
      }

      const recent = await fetchRecentMailboxEmails(folder, new Set());
      for (const message of recent) {
        if (!missingByUid.has(message.uid)) continue;
        if (!resolvedMessages.has(message.uid) || resolvedMessages.get(message.uid)!.toAddresses.length === 0) {
          resolvedMessages.set(message.uid, message);
        }
      }
    } catch (error) {
      errors.push(
        `${folder}: ${error instanceof Error ? error.message : 'Nepavyko perskaityti Sent aplanko'}`
      );
    }
  }

  for (const row of missing) {
    const message = resolvedMessages.get(row.imap_uid);
    if (!message) continue;
    if (message.toAddresses.length === 0 && message.ccAddresses.length === 0) continue;

    try {
      const result = await EmailService.updateRecipients(row.id, {
        to_addresses: message.toAddresses,
        cc_addresses: message.ccAddresses,
      });
      if (result) {
        updated += 1;
      } else {
        errors.push(`UID ${row.imap_uid}: DB neturi gavėjų stulpelių (paleisk migraciją).`);
      }
    } catch (error) {
      errors.push(
        `UID ${row.imap_uid}: ${error instanceof Error ? error.message : 'Nežinoma klaida'}`
      );
    }
  }

  return { updated, errors };
}

export async function syncSentFolder(
  sentPath: string,
  maxCount: number
): Promise<{ processed: number; skipped: number; errors: string[] }> {
  const backfill = await backfillSentRecipients(sentPath);

  if (maxCount <= 0) {
    return { processed: backfill.updated, skipped: 0, errors: backfill.errors };
  }

  const knownUids = await EmailService.getKnownUids(sentPath);
  const messages = await fetchRecentMailboxEmails(sentPath, knownUids);
  const toProcess = messages.slice(0, maxCount);

  let processed = 0;
  let skipped = 0;
  const errors: string[] = [...backfill.errors];

  for (const message of toProcess) {
    if (knownUids.has(message.uid)) {
      skipped += 1;
      continue;
    }

    try {
      const receivedAtIso = message.receivedAt.toISOString();
      await EmailService.insertProcessedEmail({
        imap_uid: message.uid,
        message_id: message.messageId,
        in_reply_to: message.inReplyTo,
        reference_ids: message.referenceIds,
        folder: sentPath,
        subject: message.subject,
        from_address: message.fromAddress,
        from_name: message.fromName,
        to_addresses: message.toAddresses,
        cc_addresses: message.ccAddresses,
        received_at: receivedAtIso,
        body_text: message.bodyText,
        body_html: message.bodyHtml,
        attachments: message.attachments,
        category: 'informational',
        summary: '',
        importance_reason: '',
        recommended_action: '',
        draft_reply: null,
        draft_status: 'sent',
        sent_at: receivedAtIso,
        read_at: receivedAtIso,
      });

      knownUids.add(message.uid);
      processed += 1;
    } catch (error) {
      const label = message.subject || `UID ${message.uid}`;
      errors.push(
        `${label}: ${error instanceof Error ? error.message : 'Nežinoma klaida'}`
      );
    }
  }

  const backfillAfter = await backfillSentRecipients(sentPath);
  if (backfillAfter.errors.length > 0) {
    errors.push(...backfillAfter.errors);
  }

  return { processed: processed + backfill.updated + backfillAfter.updated, skipped, errors };
}

export async function syncSentEmailsIfPossible(
  remainingQuota: number
): Promise<{ processed: number; skipped: number; errors: string[] }> {
  try {
    const sentPath = await resolveSentMailboxPath();
    if (!sentPath) {
      return { processed: 0, skipped: 0, errors: [] };
    }
    return syncSentFolder(sentPath, remainingQuota);
  } catch (error) {
    return {
      processed: 0,
      skipped: 0,
      errors: [
        `Sent sinchronizacija: ${
          error instanceof Error ? error.message : 'Nežinoma klaida'
        }`,
      ],
    };
  }
}
