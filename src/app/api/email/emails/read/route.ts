import { NextResponse } from 'next/server';
import { markProcessedEmailsRead } from '@/lib/email/email-read-service';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Nenurodyti laiškų ID.' }, { status: 400 });
    }

    const data = await markProcessedEmailsRead(ids);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Email read error:', error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Nepavyko pažymėti laiško kaip skaityto.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
