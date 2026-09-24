import type { Order } from '@/types';

export type PlayCampaignKind = 'test' | 'live';

export type PlayPublicCampaignRecord = {
  token: string;
  orderId: string;
  kind: PlayCampaignKind;
  campaign: Record<string, unknown>;
  screens: Array<Record<string, unknown>>;
  status: string;
  locked: boolean;
  updatedAt: string;
};

const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generatePlayCampaignToken(): string {
  const bytes = new Uint8Array(15);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join('');
}

export function isPlayTestOrderId(orderId: string): boolean {
  return String(orderId || '').startsWith('test-');
}

export function playCampaignKindForOrderId(orderId: string): PlayCampaignKind {
  return isPlayTestOrderId(orderId) ? 'test' : 'live';
}

export function normalizePlayCampaignToken(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asScreenRows(screens: Array<Record<string, unknown>>) {
  return screens.map((row) => {
    const snapshot = asRecord(row.calculation_snapshot);
    return {
      name: String(snapshot.name || row.name || ''),
      city: String(snapshot.city || row.city || ''),
      owner: String(row.owner || ''),
      type: String(snapshot.type || row.type || ''),
      resolution: String(snapshot.resolution || snapshot.dimensions || row.resolution || ''),
      catalogId: String(row.screen_id || row.catalogId || ''),
      from: String(row.from || ''),
      to: String(row.to || ''),
      impressions: Number(row.impressions) || 0,
      ots: Number(row.ots_total ?? row.ots) || 0,
      clipPrice: Number(row.clip_price ?? row.clipPrice) || 0,
      cpt: Number(row.cpt) || 0,
      gross: Number(row.gross_price ?? row.gross) || 0,
      screenDiscount: Number(row.discount ?? row.screenDiscount) || 0,
      net: Number(row.net_price ?? row.net) || 0,
    };
  });
}

export function orderPatchFromPlayCampaign(
  record: Pick<PlayPublicCampaignRecord, 'token' | 'campaign' | 'screens' | 'status' | 'locked'>
): Partial<Order> {
  const campaign = asRecord(record.campaign);
  const screens = Array.isArray(record.screens) ? record.screens.map(asRecord) : [];
  const screenIds = screens
    .map((row) => String(row.screen_id || row.catalogId || '').trim())
    .filter(Boolean);
  const screenRows = asScreenRows(screens);
  const screenPrices: Record<string, number> = {};
  for (const row of screenRows) {
    if (row.catalogId) screenPrices[row.catalogId] = row.clipPrice;
  }
  const total = Number(campaign.final_price) || 0;
  const clipDuration = Number(campaign.clip_duration_seconds) || 10;
  const viaduct =
    campaign.viaduct === true ||
    campaign.mode === 'viaducts' ||
    /^Kas\s+[124]\s+minut/i.test(String(campaign.intensity || ''));
  const viaductFrequency = Number(campaign.viaduct_frequency) || 1;
  const grid = Array.isArray(campaign.grid) ? (campaign.grid as boolean[][]) : undefined;
  const intensity = String(campaign.intensity || (viaduct ? `Kas ${viaductFrequency} min.` : 'Medi'));

  return {
    from: String(campaign.date_from || '').slice(0, 10),
    to: String(campaign.date_to || '').slice(0, 10),
    screens: screenIds,
    final_price: total,
    intensity,
    viaduct,
    clip_duration: clipDuration,
    viaduct_frequency: viaduct ? viaductFrequency : 1,
    ...(grid ? { grid } : {}),
    details: {
      publicToken: record.token,
      billingPeriods: Array.isArray(campaign.billingPeriods) ? campaign.billingPeriods.map((value) => {
        const period = asRecord(value);
        return { id: String(period.id || ''), from: String(period.from || ''), to: String(period.to || '') };
      }) : [],
      total,
      finalPrice: total,
      amountDiscount: Number(campaign.volume_discount) || 0,
      periodDiscount: Number(campaign.period_discount) || 0,
      screenPrices,
      plan: {
        grid,
        clip_duration: clipDuration,
        intensity,
        viaduct,
        viaductFrequency: viaduct ? viaductFrequency : 1,
        screenNames: screenRows.map((row) => row.name).filter(Boolean),
        screenRows,
        volumeDiscount: (Number(campaign.volume_discount) || 0) / 100,
        periodDiscount: (Number(campaign.period_discount) || 0) / 100,
        total,
      },
    },
  };
}

export function mergeOrderWithPlayCampaign(
  order: Order,
  record: PlayPublicCampaignRecord
): Order {
  const patch = orderPatchFromPlayCampaign(record);
  return {
    ...order,
    ...patch,
    approved: record.locked ? true : order.approved,
    details: {
      ...(order.details || {}),
      ...(patch.details || {}),
      isTest: order.details?.isTest === true || record.kind === 'test',
      publicToken: record.token,
      live: order.details?.live,
      clockOverlay: order.details?.clockOverlay,
      mediaCoverage: order.details?.mediaCoverage,
      plan: {
        ...(order.details?.plan || {}),
        ...(patch.details?.plan || {}),
      },
    },
    updated: record.updatedAt || new Date().toISOString(),
  };
}

export function applyPlayPublicCampaignLock(
  record: PlayPublicCampaignRecord,
  locked: boolean
): PlayPublicCampaignRecord {
  return {
    ...record,
    locked: Boolean(locked),
    status: locked ? 'approved' : 'awaiting_approval',
  };
}

export function resolvePlayPublicCampaignLock(
  record: PlayPublicCampaignRecord,
  orderApproved?: boolean | null
): PlayPublicCampaignRecord {
  if (typeof orderApproved === 'boolean') {
    return applyPlayPublicCampaignLock(record, orderApproved);
  }
  return record;
}

export function normalizePlayPublicCampaign(raw: unknown): PlayPublicCampaignRecord | null {
  const data = asRecord(raw);
  const token = normalizePlayCampaignToken(data.token);
  const orderId = String(data.orderId || '').trim();
  if (!token || !orderId) return null;
  const kind: PlayCampaignKind = data.kind === 'live' || !isPlayTestOrderId(orderId) ? 'live' : 'test';
  const status = String(data.status || 'awaiting_approval');
  const locked =
    data.locked === true || (data.locked !== false && status === 'approved');
  return {
    token,
    orderId,
    kind: isPlayTestOrderId(orderId) ? 'test' : kind,
    campaign: asRecord(data.campaign),
    screens: Array.isArray(data.screens)
      ? data.screens.map((row) => asRecord(row))
      : [],
    status: locked ? 'approved' : status === 'approved' ? 'awaiting_approval' : status,
    locked,
    updatedAt: String(data.updatedAt || new Date().toISOString()),
  };
}
