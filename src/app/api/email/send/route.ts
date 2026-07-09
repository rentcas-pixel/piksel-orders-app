import { NextResponse } from 'next/server';
import { isValidAddressList } from '@/lib/email/email-addresses';
import { embedSentEmailReply } from '@/lib/email/email-embeddings-service';
import { EmailService } from '@/lib/email/email-service';
import { sendEmailReply } from '@/lib/email/smtp-client';
import { parseOutgoingAttachments } from '@/lib/email/outgoing-attachments';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      emailId?: string;
      replyText?: string;
      to?: string;
      cc?: string;
      bcc?: string;
      attachments?: unknown;
    };

    if (!body.emailId) {
      return NextResponse.json({ error: 'Nenurodytas laiško ID.' }, { status: 400 });
    }
    if (!body.replyText?.trim()) {
      return NextResponse.json({ error: 'Atsakymo tekstas negali būti tuščias.' }, { status: 400 });
    }
    if (!body.to?.trim()) {
      return NextResponse.json({ error: 'Nurodykite bent vieną gavėją.' }, { status: 400 });
    }
    if (!isValidAddressList(body.to)) {
      return NextResponse.json({ error: 'Neteisingas Kam laukas.' }, { status: 400 });
    }
    if (body.cc?.trim() && !isValidAddressList(body.cc)) {
      return NextResponse.json({ error: 'Neteisingas Cc laukas.' }, { status: 400 });
    }
    if (body.bcc?.trim() && !isValidAddressList(body.bcc)) {
      return NextResponse.json({ error: 'Neteisingas Bcc laukas.' }, { status: 400 });
    }

    const email = await EmailService.getById(body.emailId);
    if (!email) {
      return NextResponse.json({ error: 'Laiškas nerastas.' }, { status: 404 });
    }
    if (email.draft_status === 'sent') {
      return NextResponse.json({ error: 'Šis laiškas jau buvo išsiųstas.' }, { status: 400 });
    }

    const attachments = parseOutgoingAttachments(body.attachments);
    await sendEmailReply({
      email,
      replyText: body.replyText.trim(),
      to: body.to.trim(),
      cc: body.cc?.trim() || undefined,
      bcc: body.bcc?.trim() || undefined,
      attachments,
    });
    const updated = await EmailService.markSent(body.emailId, body.replyText.trim(), {
      to: body.to.trim(),
      cc: body.cc?.trim() || undefined,
    });
    void embedSentEmailReply(updated, email.subject);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepavyko išsiųsti laiško.' },
      { status: 500 }
    );
  }
}
