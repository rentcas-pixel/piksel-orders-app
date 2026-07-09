import { NextResponse } from 'next/server';
import { generateEmailReplyWithContext } from '@/lib/email/email-ai';
import { EmailService } from '@/lib/email/email-service';
import type { ProcessedEmail } from '@/lib/email/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      threadEmails?: ProcessedEmail[];
      mailboxAddress?: string;
    };

    const email = await EmailService.getById(id);
    if (!email) {
      return NextResponse.json({ error: 'Laiškas nerastas.' }, { status: 404 });
    }
    if (email.draft_status === 'sent') {
      return NextResponse.json({ error: 'Laiškas jau išsiųstas.' }, { status: 400 });
    }

    const generation = await generateEmailReplyWithContext(email, {
      threadEmails: body.threadEmails,
      mailboxAddress: body.mailboxAddress,
    });

    const updated = await EmailService.updateGeneratedReply(id, {
      draft_reply: generation.draft_reply,
      summary: generation.summary,
      recommended_action: generation.suggested_action,
    });

    return NextResponse.json({
      data: updated,
      generation,
    });
  } catch (error) {
    console.error('Email draft generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepavyko sugeneruoti atsakymo.' },
      { status: 500 }
    );
  }
}
