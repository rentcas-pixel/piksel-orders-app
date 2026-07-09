import { NextResponse } from 'next/server';
import { EmailService } from '@/lib/email/email-service';
import { reactivateDueReminders } from '@/lib/email/email-reminder-service';
import type { EmailCategory } from '@/lib/email/types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = (searchParams.get('category') || 'all') as EmailCategory | 'all';
  const search = searchParams.get('search') || undefined;
  const archive = (searchParams.get('archive') || 'active') as
    | 'active'
    | 'archived'
    | 'sent';

  try {
    await reactivateDueReminders();
    const emails = await EmailService.list({ category, search, archive });
    const syncState = await EmailService.getSyncState();
    return NextResponse.json({ data: emails, syncState });
  } catch (error) {
    console.error('Email list error:', error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Nepavyko užkrauti laiškų.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
