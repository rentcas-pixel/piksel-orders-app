import { NextResponse } from 'next/server';
import {
  getPlayPublicCampaign,
  getPlayPublicCampaignByOrderId,
} from '@/lib/play-public-campaigns-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Read a play campaign snapshot from Supabase. Missing rows are empty, not 404. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId')?.trim() || '';
  const token = url.searchParams.get('token')?.trim() || '';
  if (!orderId && !token) {
    return NextResponse.json({ error: 'Trūksta orderId' }, { status: 400 });
  }

  try {
    const byOrder = orderId ? await getPlayPublicCampaignByOrderId(orderId) : null;
    const record = byOrder || (token ? await getPlayPublicCampaign(token) : null);
    return NextResponse.json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nepavyko nuskaityti kampanijos';
    console.error('play-campaigns GET:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
