import { analyzeEmailWithAi } from '@/lib/email/email-ai';
import { getEmailSyncDays, getEmailSyncMaxPerRun } from '@/lib/email/config';
import { EmailService } from '@/lib/email/email-service';
import { syncSentEmailsIfPossible } from '@/lib/email/email-sent-sync';
import { fetchInboxSeenByUid, fetchRecentInboxEmails } from '@/lib/email/imap-client';

export interface EmailSyncResult {
  processed: number;
  skipped: number;
  errors: string[];
}

export async function syncEmails(): Promise<EmailSyncResult> {
  const knownUids = await EmailService.getKnownUids('INBOX');
  const messages = await fetchRecentInboxEmails(knownUids);
  const maxPerRun = getEmailSyncMaxPerRun();
  const toProcess = messages.slice(0, maxPerRun);

  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const message of toProcess) {
    if (knownUids.has(message.uid)) {
      skipped += 1;
      continue;
    }

    try {
      const analysis = await analyzeEmailWithAi({
        subject: message.subject,
        fromAddress: message.fromAddress,
        fromName: message.fromName,
        receivedAt: message.receivedAt,
        bodyText: message.bodyText,
        bodyHtml: message.bodyHtml,
        attachments: message.attachments,
      });

      await EmailService.insertProcessedEmail({
        imap_uid: message.uid,
        message_id: message.messageId,
        in_reply_to: message.inReplyTo,
        reference_ids: message.referenceIds,
        folder: 'INBOX',
        subject: message.subject,
        from_address: message.fromAddress,
        from_name: message.fromName,
        to_addresses: message.toAddresses,
        cc_addresses: message.ccAddresses,
        received_at: message.receivedAt.toISOString(),
        body_text: message.bodyText,
        body_html: message.bodyHtml,
        attachments: message.attachments,
        category: analysis.category,
        summary: analysis.summary,
        importance_reason: analysis.importance_reason,
        recommended_action: analysis.recommended_action,
        draft_reply: null,
        read_at: message.isSeen ? message.receivedAt.toISOString() : null,
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

  try {
    const syncDays = getEmailSyncDays();
    const since = new Date(Date.now() - syncDays * 24 * 60 * 60 * 1000);
    const [localEmails, seenByUid] = await Promise.all([
      EmailService.listActiveInboxForReadSync(since.toISOString()),
      fetchInboxSeenByUid(since),
    ]);

    const toMarkRead = localEmails
      .filter((email) => !email.read_at && seenByUid.get(email.imap_uid))
      .map((email) => email.id);

    if (toMarkRead.length > 0) {
      await EmailService.markReadMany(toMarkRead);
    }
  } catch (error) {
    console.warn('Skaitymo būsenos sinchronizavimo klaida:', error);
  }

  try {
    const sentResult = await syncSentEmailsIfPossible(
      Math.max(0, maxPerRun - processed)
    );
    processed += sentResult.processed;
    skipped += sentResult.skipped;
    errors.push(...sentResult.errors);
  } catch (error) {
    console.warn('Sent aplanko sinchronizavimo klaida:', error);
  }

  await EmailService.updateSyncState({
    last_sync_count: processed,
    last_sync_error: errors.length > 0 ? errors.join(' | ') : null,
  });

  return { processed, skipped, errors };
}
