import { NextResponse } from 'next/server';
import {
  filterEmailContacts,
  listEmailContacts,
} from '@/lib/email/email-contacts-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const exclude = searchParams.get('exclude') || undefined;
  const limit = Math.min(Number(searchParams.get('limit') || 10), 20);

  try {
    const contacts = await listEmailContacts(exclude);
    const data = filterEmailContacts(contacts, query, limit);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Email contacts error:', error);
    const message = error instanceof Error ? error.message : 'Nepavyko užkrauti adresų.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
