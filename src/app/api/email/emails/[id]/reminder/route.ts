import { NextResponse } from 'next/server';
import { setProcessedEmailReminder } from '@/lib/email/email-reminder-service';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      remind_at?: string | null;
      remind_note?: string | null;
    };

    const email = await setProcessedEmailReminder(id, {
      remind_at: body.remind_at ?? null,
      remind_note: body.remind_note ?? null,
    });

    return NextResponse.json({ data: email });
  } catch (error) {
    console.error('Email reminder error:', error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Nepavyko nustatyti priminimo.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
