import { NextResponse } from 'next/server';
import { ImapFlow } from 'imapflow';
import { assertEmailConfigReady, getEmailPassword } from '@/lib/email/config';
import { findArchiveMailbox } from '@/lib/email/imap-mailboxes-server';

export const runtime = 'nodejs';

export async function GET() {
  try {
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

    try {
      const path = await findArchiveMailbox(client);
      if (!path) {
        return NextResponse.json({
          data: null,
          error: 'Archyvo aplankas nerastas serveryje.',
        });
      }

      const mailboxes = await client.list({ statusQuery: { messages: true } });
      const mailbox = mailboxes.find((item) => item.path === path);

      return NextResponse.json({
        data: {
          path,
          name: mailbox?.name ?? path,
          specialUse: mailbox?.specialUse ?? null,
          subscribed: mailbox?.subscribed ?? false,
          messages: mailbox?.status?.messages ?? null,
        },
      });
    } finally {
      await client.logout();
    }
  } catch (error) {
    console.error('Archive folder lookup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepavyko nuskaityti archyvo aplanko.' },
      { status: 500 }
    );
  }
}
