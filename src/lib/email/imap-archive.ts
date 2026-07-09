import { ImapFlow } from 'imapflow';
import { assertEmailConfigReady, getEmailPassword } from '@/lib/email/config';
import { ensureArchiveMailbox, resolveMailbox } from '@/lib/email/imap-mailboxes-server';

export async function archiveEmailOnServer(
  imapUid: number,
  sourceFolder = 'INBOX'
): Promise<string> {
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

  try {
    const archivePath = await ensureArchiveMailbox(client);
    const sourcePath = (await resolveMailbox(client, sourceFolder)) ?? sourceFolder;
    const lock = await client.getMailboxLock(sourcePath);

    try {
      try {
        const moved = await client.messageMove({ uid: imapUid }, archivePath, { uid: true });
        if (!moved) {
          throw new Error(
            `Nepavyko perkelti laiško į „${archivePath}“ aplanką pašto serveryje.`
          );
        }
      } catch (moveError) {
        const message =
          moveError instanceof Error ? moveError.message.toLowerCase() : String(moveError);
        const likelyAlreadyMoved =
          message.includes('not found') ||
          message.includes('invalid') ||
          message.includes('no such') ||
          message.includes('exists');
        if (!likelyAlreadyMoved) {
          throw moveError;
        }
        console.warn(`messageMove failed for uid ${imapUid}, treating as already archived`);
      }

      return archivePath;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
