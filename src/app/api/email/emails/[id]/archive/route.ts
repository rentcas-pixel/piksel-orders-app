import { NextResponse } from 'next/server';
import { archiveProcessedEmail } from '@/lib/email/email-archive-service';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const email = await archiveProcessedEmail(id);
    return NextResponse.json({ data: email });
  } catch (error) {
    console.error('Email archive error:', error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Nepavyko archyvuoti laiško.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
