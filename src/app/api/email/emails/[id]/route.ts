import { NextResponse } from 'next/server';
import { EmailService } from '@/lib/email/email-service';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const email = await EmailService.getById(id);
    if (!email) {
      return NextResponse.json({ error: 'Laiškas nerastas.' }, { status: 404 });
    }
    return NextResponse.json({ data: email });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepavyko užkrauti laiško.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = (await request.json()) as { draft_reply?: string };
    if (!body.draft_reply?.trim()) {
      return NextResponse.json({ error: 'Juodraštis negali būti tuščias.' }, { status: 400 });
    }

    const email = await EmailService.updateDraft(id, body.draft_reply.trim());
    return NextResponse.json({ data: email });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepavyko išsaugoti juodraščio.' },
      { status: 500 }
    );
  }
}
