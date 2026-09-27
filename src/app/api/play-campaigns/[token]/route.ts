import { NextResponse } from 'next/server';
import {
  applyPlayPublicCampaignLock,
  normalizePlayCampaignToken,
  normalizePlayPublicCampaign,
  orderPatchFromPlayCampaign,
} from '@/lib/play-public-campaigns';
import {
  getPlayPublicCampaign,
  getPlayPublicCampaignByOrderId,
  savePlayPublicCampaign,
} from '@/lib/play-public-campaigns-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ token: string }> };

async function loadCampaignByToken(token: string) {
  const linked = await getPlayPublicCampaign(token);
  return linked ? (await getPlayPublicCampaignByOrderId(linked.orderId)) || linked : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const token = normalizePlayCampaignToken((await context.params).token);
  if (!token) return NextResponse.json({ error: 'Trūksta nuorodos' }, { status: 400 });
  try {
    const record = await getPlayPublicCampaign(token);
    if (!record) return NextResponse.json({ error: 'Kampanijos nuoroda negalioja' }, { status: 404 });
    return NextResponse.json({
      ...record,
      orderPatch: orderPatchFromPlayCampaign(record),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nepavyko nuskaityti nuorodos';
    console.error('play-campaigns token GET:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const token = normalizePlayCampaignToken((await context.params).token);
  if (!token) return NextResponse.json({ error: 'Trūksta nuorodos' }, { status: 400 });
  const existing = await loadCampaignByToken(token);
  if (!existing) {
    return NextResponse.json({ error: 'Kampanijos nuoroda negalioja' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.locked !== 'boolean') {
    return NextResponse.json({ error: 'Netinkamas JSON' }, { status: 400 });
  }

  try {
    const saved = await savePlayPublicCampaign(applyPlayPublicCampaignLock(existing, body.locked));
    return NextResponse.json({
      ...saved,
      orderPatch: orderPatchFromPlayCampaign(saved),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nepavyko įrašyti nuorodos';
    console.error('play-campaigns PATCH lock:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const token = normalizePlayCampaignToken((await context.params).token);
  if (!token) return NextResponse.json({ error: 'Trūksta nuorodos' }, { status: 400 });
  const existing = await loadCampaignByToken(token);
  if (!existing) {
    return NextResponse.json({ error: 'Kampanijos nuoroda negalioja' }, { status: 404 });
  }
  if (existing.locked) {
    return NextResponse.json({ error: 'Patvirtintos kampanijos keisti negalima' }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Netinkamas JSON' }, { status: 400 });

  const next = normalizePlayPublicCampaign({
    ...existing,
    campaign: body.campaign ?? existing.campaign,
    screens: body.screens ?? existing.screens,
    status: existing.status,
    locked: existing.locked,
  });
  if (!next) return NextResponse.json({ error: 'Netinkama kampanija' }, { status: 400 });

  try {
    const saved = await savePlayPublicCampaign(next);
    return NextResponse.json({
      ...saved,
      orderPatch: orderPatchFromPlayCampaign(saved),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nepavyko įrašyti nuorodos';
    console.error('play-campaigns PUT save:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
