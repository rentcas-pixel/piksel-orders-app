import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { assertEmailConfigReady, getEmailPassword } from '@/lib/email/config';
import { resolveMailbox } from '@/lib/email/imap-mailboxes-server';

export interface FetchedEmailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

async function fetchMessageSource(
  client: ImapFlow,
  imapUid: number,
  preferredFolder: string
): Promise<Buffer> {
  const foldersToTry = [preferredFolder, 'INBOX', 'Archive'].filter(
    (folder, index, all) => all.indexOf(folder) === index
  );

  for (const folderKey of foldersToTry) {
    const mailboxPath = (await resolveMailbox(client, folderKey)) ?? folderKey;

    let lock;
    try {
      lock = await client.getMailboxLock(mailboxPath);
    } catch {
      continue;
    }

    try {
      const message = await client.fetchOne(
        String(imapUid),
        { source: true },
        { uid: true }
      );

      if (message?.source) {
        return message.source;
      }
    } finally {
      lock.release();
    }
  }

  throw new Error('Laiškas nerastas pašto serveryje.');
}

export async function fetchEmailAttachmentFromServer(
  imapUid: number,
  folder: string,
  attachmentIndex: number
): Promise<FetchedEmailAttachment> {
  if (!Number.isFinite(imapUid) || imapUid < 1) {
    throw new Error('Neteisingas laiško identifikatorius serveryje.');
  }
  if (!Number.isFinite(attachmentIndex) || attachmentIndex < 0) {
    throw new Error('Neteisingas priedo indeksas.');
  }

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
    const source = await fetchMessageSource(client, imapUid, folder);
    const parsed = await simpleParser(source);
    const attachments = parsed.attachments ?? [];
    const attachment = attachments[attachmentIndex];

    if (!attachment?.content) {
      throw new Error('Priedas nerastas.');
    }

    return {
      filename: attachment.filename || 'prisegtukas',
      contentType: attachment.contentType || 'application/octet-stream',
      content: Buffer.isBuffer(attachment.content)
        ? attachment.content
        : Buffer.from(attachment.content),
    };
  } finally {
    await client.logout();
  }
}
