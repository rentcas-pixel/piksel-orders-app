import { NextResponse } from 'next/server';
import { EmailService } from '@/lib/email/email-service';
import { listNewInboxUids } from '@/lib/email/imap-client';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  try {
    const knownUids = await EmailService.getKnownUids('INBOX');
    const newUids = await listNewInboxUids(knownUids);
    return NextResponse.json({ newInboxCount: newUids.length });
  } catch (error) {
    console.error('Email poll error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepavyko patikrinti pašto.' },
      { status: 500 }
    );
  }
}
