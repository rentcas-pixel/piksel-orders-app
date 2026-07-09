import { EmailService } from '@/lib/email/email-service';
import { markEmailsSeenOnServer } from '@/lib/email/imap-mark-read';
import { dismissDueReminders } from '@/lib/email/email-reminder-service';

export async function markProcessedEmailsRead(emailIds: string[]) {
  const uniqueIds = [...new Set(emailIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const emails = await Promise.all(uniqueIds.map((id) => EmailService.getById(id)));
  const validEmails = emails.filter(
    (email): email is NonNullable<(typeof emails)[number]> => email != null
  );

  await dismissDueReminders(uniqueIds);

  const unread = validEmails.filter((email) => !email.read_at);

  if (unread.length > 0) {
    const updated = await EmailService.markReadMany(unread.map((email) => email.id));

    const inboxUids = unread
      .filter((email) => email.folder === 'INBOX' && !email.archived_at)
      .map((email) => email.imap_uid);

    if (inboxUids.length > 0) {
      try {
        await markEmailsSeenOnServer(inboxUids, 'INBOX');
      } catch (error) {
        console.error('IMAP skaitymo žymėjimo klaida:', error);
      }
    }

    const updatedById = new Map(updated.map((email) => [email.id, email]));
    const merged = uniqueIds
      .map((id) => updatedById.get(id) ?? validEmails.find((email) => email.id === id))
      .filter((email): email is NonNullable<typeof email> => Boolean(email));

    const refreshed = await Promise.all(merged.map((email) => EmailService.getById(email.id)));
    return refreshed.filter(
      (email): email is NonNullable<typeof email> => email != null
    );
  }

  const refreshed = await Promise.all(uniqueIds.map((id) => EmailService.getById(id)));
  return refreshed.filter((email): email is NonNullable<typeof email> => email != null);
}
