import { ImapFlow } from 'imapflow';
import { assertEmailConfigReady, getEmailPassword } from '@/lib/email/config';
import { resolveMailbox } from '@/lib/email/imap-mailboxes-server';

export async function markEmailsSeenOnServer(
  uids: number[],
  folder = 'INBOX'
): Promise<void> {
  if (uids.length === 0) return;

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
  const mailboxPath = (await resolveMailbox(client, folder)) ?? folder;
  const lock = await client.getMailboxLock(mailboxPath);

  try {
    for (const uid of uids) {
      try {
        await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
      } catch (error) {
        console.warn(`Nepavyko pažymėti UID ${uid} kaip skaityto:`, error);
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }
}
