import { NextResponse } from 'next/server';
import { syncEmails } from '@/lib/email/email-sync-service';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST() {
  try {
    const result = await syncEmails();
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Email sync error:', error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' &&
            error !== null &&
            'message' in error &&
            typeof (error as { message: unknown }).message === 'string'
          ? String((error as { message: string }).message)
          : 'Sinchronizacija nepavyko.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
