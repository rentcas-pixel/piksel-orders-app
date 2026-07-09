import { NextResponse } from 'next/server';
import { fetchImapRecipientsForEmails } from '@/lib/email/email-sent-sync';
import { resolveSentMailboxPath } from '@/lib/email/imap-mailboxes-server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      emails?: Array<{ id: string; imap_uid: number; folder: string }>;
    };

    const emails = body.emails ?? [];
    if (emails.length === 0) {
      return NextResponse.json({ recipients: {} });
    }

    const sentPath = await resolveSentMailboxPath();
    if (!sentPath) {
      return NextResponse.json({ recipients: {} });
    }

    const recipients = await fetchImapRecipientsForEmails(emails, sentPath);
    return NextResponse.json({ recipients });
  } catch (error) {
    console.error('Sent recipients error:', error);
    const message =
      error instanceof Error ? error.message : 'Nepavyko gauti gavėjų.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
