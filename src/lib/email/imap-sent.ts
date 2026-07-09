import { ImapFlow } from 'imapflow';
import { assertEmailConfigReady, getEmailPassword } from '@/lib/email/config';
import { resolveMailbox } from '@/lib/email/imap-mailboxes-server';

export async function appendMessageToSentFolder(message: Buffer): Promise<void> {
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
    const sentPath = await resolveMailbox(client, 'Sent');
    if (!sentPath) {
      console.warn('Nepavyko rasti Sent aplanko — laiškas išsiųstas, bet neįrašytas į Sent.');
      return;
    }

    await client.append(sentPath, message, ['\\Seen'], new Date());
  } finally {
    await client.logout();
  }
}
