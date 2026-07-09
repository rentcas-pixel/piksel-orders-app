import { NextResponse } from 'next/server';
import { isValidAddressList } from '@/lib/email/email-addresses';
import { sendNewEmail } from '@/lib/email/smtp-client';
import { parseOutgoingAttachments } from '@/lib/email/outgoing-attachments';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      to?: string;
      cc?: string;
      bcc?: string;
      subject?: string;
      message?: string;
      attachments?: unknown;
    };

    if (!body.to?.trim()) {
      return NextResponse.json({ error: 'Nurodykite gavėją.' }, { status: 400 });
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
    if (!body.subject?.trim()) {
      return NextResponse.json({ error: 'Nurodykite temą.' }, { status: 400 });
    }
    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Laiško tekstas negali būti tuščias.' }, { status: 400 });
    }

    const attachments = parseOutgoingAttachments(body.attachments);
    await sendNewEmail({
      to: body.to.trim(),
      cc: body.cc?.trim() || undefined,
      bcc: body.bcc?.trim() || undefined,
      subject: body.subject.trim(),
      body: body.message.trim(),
      attachments,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Email compose error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepavyko išsiųsti laiško.' },
      { status: 500 }
    );
  }
}
