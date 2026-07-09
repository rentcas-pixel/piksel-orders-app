import { NextResponse } from 'next/server';
import { chatWithEmailAgent, type EmailAgentChatMessage } from '@/lib/email/email-agent-chat';
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
    const body = (await request.json()) as {
      message?: string;
      currentDraft?: string;
      messages?: EmailAgentChatMessage[];
      threadEmails?: ProcessedEmail[];
      mailboxAddress?: string;
    };

    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Įveskite žinutę.' }, { status: 400 });
    }

    const email = await EmailService.getById(id);
    if (!email) {
      return NextResponse.json({ error: 'Laiškas nerastas.' }, { status: 404 });
    }
    if (email.draft_status === 'sent') {
      return NextResponse.json({ error: 'Laiškas jau išsiųstas.' }, { status: 400 });
    }

    const result = await chatWithEmailAgent({
      email,
      threadEmails: body.threadEmails?.length ? body.threadEmails : [email],
      currentDraft: body.currentDraft ?? email.draft_reply ?? '',
      messages: body.messages ?? [],
      userMessage: body.message.trim(),
      mailboxAddress: body.mailboxAddress,
    });

    let savedEmail: ProcessedEmail | null = null;
    if (result.updated_draft) {
      savedEmail = await EmailService.updateDraft(id, result.updated_draft);
    }

    return NextResponse.json({
      data: {
        assistant_message: result.assistant_message,
        updated_draft: result.updated_draft,
        email: savedEmail,
      },
    });
  } catch (error) {
    console.error('Email agent chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepavyko susisiekti su agentu.' },
      { status: 500 }
    );
  }
}
