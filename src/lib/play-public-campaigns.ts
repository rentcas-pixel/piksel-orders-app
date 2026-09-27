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
    if (row.catalogId && row.net > 0) screenPrices[row.catalogId] = row.net;
  }
  const total = Number(campaign.final_price) || 0;
  const netSum = screenRows.reduce((sum, row) => sum + (row.net > 0 ? row.net : 0), 0);
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
      finalPrice: netSum > 0 ? netSum : total,
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

function timestampMs(value: unknown): number {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Test-order plan time. planChangedAt is the plan save; updated is the fallback.
 * Non-test orders never win here, so the paid campaign path stays server-first.
 */
export function localTestPlanIsNewer(
  order: Pick<Order, 'id' | 'updated' | 'details'>,
  record: Pick<PlayPublicCampaignRecord, 'updatedAt'>
): boolean {
  const test =
    order.details?.isTest === true || isPlayTestOrderId(String(order.id || ''));
  if (!test) return false;
  const planChanged = timestampMs(order.details?.planChangedAt);
  const local = planChanged || timestampMs(order.updated);
  const server = timestampMs(record.updatedAt);
  return local > server;
}

type PlanScreenRow = NonNullable<
  NonNullable<Order['details']>['plan']
>['screenRows'] extends Array<infer Row> | undefined
  ? Row
  : never;

/** Campaign snapshot fields a test-order date/price save must write to Supabase. */
export function playCampaignSnapshotFromTestOrder(
  order: Pick<
    Order,
    | 'client'
    | 'agency'
    | 'from'
    | 'to'
    | 'final_price'
    | 'intensity'
    | 'viaduct'
    | 'grid'
    | 'clip_duration'
    | 'viaduct_frequency'
    | 'details'
  >,
  existing?: Pick<PlayPublicCampaignRecord, 'campaign' | 'screens'> | null
): { campaign: Record<string, unknown>; screens: Array<Record<string, unknown>> } {
  const rows = (order.details?.plan?.screenRows || []) as PlanScreenRow[];
  const previousScreens = Array.isArray(existing?.screens)
    ? existing.screens.map(asRecord)
    : [];
  const screens = rows.length
    ? rows.map((row) => {
        const catalogId = String(row.catalogId || '').trim();
        const previous = previousScreens.find((screen) => {
          const id = String(screen.screen_id || screen.catalogId || '').trim();
          return Boolean(catalogId) && id === catalogId;
        });
        const snapshot = asRecord(previous?.calculation_snapshot);
        return {
          ...(previous || {}),
          screen_id: catalogId || previous?.screen_id,
          from: row.from || order.from,
          to: row.to || order.to,
          name: row.name,
          city: row.city,
          impressions: row.impressions ?? previous?.impressions,
          ots_total: row.ots ?? previous?.ots_total,
          clip_price: row.clipPrice ?? previous?.clip_price,
          cpt: row.cpt ?? previous?.cpt,
          gross_price: row.gross ?? previous?.gross_price,
          net_price: row.net ?? previous?.net_price,
          calculation_snapshot: {
            ...snapshot,
            name: row.name || snapshot.name,
            city: row.city || snapshot.city,
            type: row.type || snapshot.type,
            resolution: row.resolution || snapshot.resolution,
          },
        };
      })
    : previousScreens;

  const previousCampaign = asRecord(existing?.campaign);
  return {
    campaign: {
      ...previousCampaign,
      name: order.client || previousCampaign.name,
      client_name: order.client || previousCampaign.client_name,
      agency_name: order.agency || previousCampaign.agency_name,
      date_from: order.from,
      date_to: order.to,
      final_price: order.final_price,
      intensity: order.intensity || order.details?.plan?.intensity || previousCampaign.intensity,
      grid: order.details?.plan?.grid || order.grid || previousCampaign.grid,
      clip_duration_seconds:
        order.details?.plan?.clip_duration ??
        order.clip_duration ??
        previousCampaign.clip_duration_seconds,
      volume_discount: order.details?.amountDiscount ?? previousCampaign.volume_discount,
      period_discount: order.details?.periodDiscount ?? previousCampaign.period_discount,
      viaduct: order.viaduct,
      viaduct_frequency:
        order.viaduct_frequency ??
        order.details?.plan?.viaductFrequency ??
        previousCampaign.viaduct_frequency,
      planChangedAt: order.details?.planChangedAt || previousCampaign.planChangedAt,
    },
    screens,
  };
}

/** Barter snapshot: dates, agreed price, screens. No hour grid. */
export function playCampaignBarterSnapshot(
  order: Pick<Order, 'client' | 'agency' | 'from' | 'to' | 'final_price' | 'details'>
): { campaign: Record<string, unknown>; screens: Array<Record<string, unknown>> } {
  const agreedRaw = Number(order.details?.barterPrice ?? order.final_price);
  const agreed = Number.isFinite(agreedRaw) && agreedRaw > 0 ? agreedRaw : 0;
  const screens = order.details?.barterScreens || [];
  return {
    campaign: {
      barter: true,
      name: order.client,
      client_name: order.client,
      agency_name: order.agency,
      date_from: order.from,
      date_to: order.to,
      final_price: agreed,
      planChangedAt: order.details?.planChangedAt,
    },
    screens: screens.map((screen) => ({
      screen_id: screen.id,
      name: screen.name,
      city: screen.city || '',
      from: order.from,
      to: order.to,
      net_price: 0,
      gross_price: 0,
      impressions: 0,
      calculation_snapshot: {
        name: screen.name,
        city: screen.city || '',
      },
    })),
  };
}

export function mergeOrderWithPlayCampaign(
  order: Order,
  record: PlayPublicCampaignRecord
): Order {
  if (localTestPlanIsNewer(order, record)) {
    return {
      ...order,
      details: {
        ...(order.details || {}),
        isTest: order.details?.isTest === true || record.kind === 'test',
        publicToken: record.token || order.details?.publicToken,
        live: order.details?.live,
        clockOverlay: order.details?.clockOverlay,
        mediaCoverage: order.details?.mediaCoverage,
      },
    };
  }
  const campaign = asRecord(record.campaign);
  if (campaign.barter === true) {
    const agreedRaw = Number(campaign.final_price);
    const price = Number.isFinite(agreedRaw) && agreedRaw > 0 ? agreedRaw : 0;
    const withoutGrid: Order = { ...order, final_price: price };
    delete withoutGrid.grid;
    return {
      ...withoutGrid,
      from: String(campaign.date_from || order.from || '').slice(0, 10),
      to: String(campaign.date_to || order.to || '').slice(0, 10),
      final_price: price,
      approved: record.locked ? true : order.approved,
      details: {
        ...(order.details || {}),
        barter: true,
        barterPrice: price,
        total: price,
        finalPrice: price,
        isTest: order.details?.isTest === true || record.kind === 'test',
        publicToken: record.token,
        live: order.details?.live,
        clockOverlay: order.details?.clockOverlay,
        mediaCoverage: order.details?.mediaCoverage,
        plan: {
          clip_duration: order.details?.plan?.clip_duration,
          intensity: order.details?.plan?.intensity,
          screenNames: (order.details?.barterScreens || []).map((screen) => screen.name),
          screenRows: (order.details?.barterScreens || []).map((screen) => ({
            name: screen.name,
            city: screen.city,
            catalogId: screen.id,
            owner: 'Piksel',
            from: String(campaign.date_from || order.from || '').slice(0, 10),
            to: String(campaign.date_to || order.to || '').slice(0, 10),
            net: 0,
          })),
          total: price,
        },
      },
      updated: record.updatedAt || new Date().toISOString(),
    };
  }
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
