import { NextResponse } from 'next/server';
import {
  generatePlayCampaignToken,
  normalizePlayCampaignToken,
  normalizePlayPublicCampaign,
  orderPatchFromPlayCampaign,
  playCampaignKindForOrderId,
  type PlayPublicCampaignRecord,
} from '@/lib/play-public-campaigns';
import {
  getPlayPublicCampaign,
  getPlayPublicCampaignByOrderId,
  savePlayPublicCampaign,
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

/** Store a shared plan snapshot in Supabase. Does not write PocketBase orders. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Netinkamas JSON' }, { status: 400 });

  const orderId = String(body.orderId || '').trim();
  if (!orderId) return NextResponse.json({ error: 'Trūksta orderId' }, { status: 400 });

  let existing: PlayPublicCampaignRecord | null = null;
  try {
    existing = await getPlayPublicCampaignByOrderId(orderId);
  } catch (error) {
    console.error('play-campaigns POST lookup:', error);
  }
  if (existing?.locked) {
    return NextResponse.json({ error: 'Patvirtintos kampanijos keisti negalima' }, { status: 409 });
  }

  const token =
    existing?.token ||
    normalizePlayCampaignToken(body.token) ||
    generatePlayCampaignToken();
  const record = normalizePlayPublicCampaign({
    ...existing,
    ...body,
    token,
    orderId,
    kind: playCampaignKindForOrderId(orderId),
    status: String(body.status || existing?.status || 'awaiting_approval'),
    locked: Boolean(body.locked ?? existing?.locked),
  });
  if (!record) return NextResponse.json({ error: 'Netinkama kampanija' }, { status: 400 });

  try {
    const saved = await savePlayPublicCampaign(record);
    return NextResponse.json({ ...saved, orderPatch: orderPatchFromPlayCampaign(saved) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nepavyko įrašyti nuorodos';
    console.error('play-campaigns POST save:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
