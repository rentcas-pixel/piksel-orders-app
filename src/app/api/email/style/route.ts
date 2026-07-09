import { NextResponse } from 'next/server';
import {
  countEmailStyleCandidates,
  getEmailWritingStyleSummary,
  learnEmailWritingStyleFromMailbox,
} from '@/lib/email/email-style-service';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('preview') === '1') {
      const available = await countEmailStyleCandidates();
      const summary = await getEmailWritingStyleSummary();
      return NextResponse.json({
        data: {
          available,
          ...summary,
        },
      });
    }

    const summary = await getEmailWritingStyleSummary();
    return NextResponse.json({ data: summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepavyko užkrauti stiliaus.' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const style = await learnEmailWritingStyleFromMailbox();
    return NextResponse.json({ data: style });
  } catch (error) {
    console.error('Email style learn error:', error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Stiliaus mokymas nepavyko.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
