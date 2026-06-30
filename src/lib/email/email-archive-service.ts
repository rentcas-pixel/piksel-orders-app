import { EmailService } from '@/lib/email/email-service';
import { isEmailArchived } from '@/lib/email/imap-mailboxes';
import { archiveEmailOnServer } from '@/lib/email/imap-archive';

export async function archiveProcessedEmail(emailId: string) {
  const email = await EmailService.getById(emailId);
  if (!email) {
    throw new Error('Laiškas nerastas.');
  }
  if (isEmailArchived(email)) {
    throw new Error('Laiškas jau archyvuotas.');
  }

  let archiveFolder: string;
  try {
    archiveFolder = await archiveEmailOnServer(email.imap_uid, email.folder);
  } catch (error) {
    console.error('IMAP archyvavimo klaida:', error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Nepavyko archyvuoti laiško pašto serveryje.'
    );
  }

  return EmailService.markArchived(emailId, archiveFolder);
}
