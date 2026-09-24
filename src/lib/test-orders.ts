import type { Order } from '@/types';
import {
  mergeOrderWithPlayCampaign,
  type PlayPublicCampaignRecord,
} from '@/lib/play-public-campaigns';

const STORAGE_KEY = 'pikselHubTestOrders';
const TEST_ORDERS_CHANNEL = 'piksel-test-orders';

export function notifyTestOrdersChanged(orderId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const channel = new BroadcastChannel(TEST_ORDERS_CHANNEL);
    channel.postMessage({ type: 'updated', id: orderId ? String(orderId) : undefined });
    channel.close();
  } catch {
    /* BroadcastChannel gali nebūti */
  }
}

export function subscribeTestOrders(onChange: (orderId?: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    onChange();
  };
  const pullFromServer = () => {
    void hydrateTestOrdersFromPlayCampaigns().finally(() => onChange());
  };
  const onFocus = () => pullFromServer();
  const onVisibility = () => {
    if (document.visibilityState === 'visible') pullFromServer();
  };

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(TEST_ORDERS_CHANNEL);
    channel.onmessage = (event: MessageEvent<{ id?: string }>) => {
      const id = event?.data?.id;
      onChange(typeof id === 'string' && id ? id : undefined);
    };
  } catch {
    /* ignore */
  }

  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisibility);
    channel?.close();
  };
}

export type TestOrderPlanSnapshot = {
  grid?: boolean[][];
  clip_duration?: number;
  intensity?: string;
  viewsPerHour?: number;
  days?: number;
  viaduct?: boolean;
  viaductFrequency?: number;
  screenNames?: string[];
  screenRows?: Array<{
    name: string;
    city?: string;
    owner?: string;
    type?: string;
    resolution?: string;
    catalogId?: string;
    impressions?: number;
    ots?: number;
    clipPrice?: number;
    cpt?: number;
    gross?: number;
    screenDiscount?: number;
    net?: number;
    from?: string;
    to?: string;
    days?: number;
  }>;
  volumeDiscount?: number;
  periodDiscount?: number;
  total?: number;
};

/** Kaip live PocketBase Order + test markeris */
export type TestOrder = Order & {
  details: NonNullable<Order['details']> & {
    isTest: true;
    plan?: TestOrderPlanSnapshot;
    /** Demo UI: chat bubble next to client (hub parity). */
    hasCommentOrScreenshot?: boolean;
  };
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function isTestOrder(order: Pick<Order, 'id' | 'details'> | null | undefined): boolean {
  if (!order) return false;
  if (String(order.id).startsWith('test-')) return true;
  const details = order.details as { isTest?: boolean } | undefined;
  return details?.isTest === true;
}

/**
 * Sulygina test orderį su live PocketBase Order struktūra:
 * top-level grid, clip_duration, viaduct_frequency, discount, screenPrices…
 * details.plan lieka hub enrichment (screenRows, tipai).
 */
export function normalizeTestOrder(order: TestOrder): TestOrder {
  const plan = order.details?.plan;
  const grid = order.grid?.length ? order.grid : plan?.grid;
  const clip_duration =
    order.clip_duration ?? plan?.clip_duration ?? 10;
  const viaduct_frequency =
    Number(order.viaduct_frequency) ||
    Number(plan?.viaductFrequency) ||
    1;

  const screenPrices: Record<string, number> = {
    ...(order.details?.screenPrices || {}),
  };
  for (const row of plan?.screenRows || []) {
    const id = row.catalogId;
    if (!id) continue;
    if (screenPrices[id] == null && typeof row.clipPrice === 'number') {
      screenPrices[id] = row.clipPrice;
    }
  }

  const total =
    typeof order.details?.total === 'number' && order.details.total > 0
      ? order.details.total
      : typeof plan?.total === 'number' && plan.total > 0
        ? plan.total
        : Number(order.final_price) || 0;

  const amountDiscount =
    typeof order.details?.amountDiscount === 'number'
      ? order.details.amountDiscount
      : typeof plan?.volumeDiscount === 'number'
        ? Math.round(plan.volumeDiscount * 100)
        : undefined;

  const periodDiscount =
    typeof order.details?.periodDiscount === 'number'
      ? order.details.periodDiscount
      : typeof plan?.periodDiscount === 'number'
        ? Math.round(plan.periodDiscount * 100)
        : undefined;

  const intensity =
    order.intensity ||
    plan?.intensity ||
    'Medi';

  return {
    ...order,
    id: order.id || `test-${Date.now()}`,
    client: order.client || '',
    agency: order.agency || '',
    invoice_id: order.invoice_id || String(order.id || '').replace(/^test-/, '') || '0',
    approved: !!order.approved,
    viaduct: !!order.viaduct || !!plan?.viaduct,
    from: order.from || '',
    to: order.to || '',
    media_received: !!order.media_received,
    final_price: total,
    invoice_sent: !!order.invoice_sent,
    invoice_issued: !!order.invoice_issued,
    updated: order.updated || new Date().toISOString(),
    intensity,
    screens: Array.isArray(order.screens) ? order.screens : [],
    grid: grid || undefined,
    clip_duration,
    viaduct_frequency,
    on_sale_screens: order.on_sale_screens || [],
    on_sale_discount: order.on_sale_discount ?? 0,
    hidden_screens: order.hidden_screens || [],
    details: {
      ...(order.details || {}),
      isTest: true,
      hasCommentOrScreenshot: !!(order.details as { hasCommentOrScreenshot?: boolean } | undefined)
        ?.hasCommentOrScreenshot,
      ...(order.details?.mediaCoverage
        ? { mediaCoverage: order.details.mediaCoverage }
        : {}),
      discount:
        typeof order.details?.discount === 'number' ? order.details.discount : 80,
      total,
      finalPrice: total,
      // Nepatvirtintas negali būti Live / Rodoma
      live: order.approved
        ? order.details?.live
        : { status: 'idle' as const },
      ...(amountDiscount != null ? { amountDiscount } : {}),
      ...(periodDiscount != null ? { periodDiscount } : {}),
      ...(Object.keys(screenPrices).length ? { screenPrices } : {}),
      plan: plan
        ? {
            ...plan,
            grid: grid || plan.grid,
            clip_duration,
            intensity,
            viaduct: !!order.viaduct || !!plan.viaduct,
            viaductFrequency: viaduct_frequency,
            total,
          }
        : {
            clip_duration,
            intensity,
            grid,
            viaductFrequency: viaduct_frequency,
            total,
          },
    },
  };
}

export function listTestOrders(): TestOrder[] {
  if (!canUseStorage()) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as TestOrder[];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((order) => isTestOrder(order))
      .map((order) => normalizeTestOrder(order));
  } catch {
    return [];
  }
}

export function getTestOrder(id: string): TestOrder | null {
  return listTestOrders().find((order) => String(order.id) === String(id)) || null;
}

export function upsertTestOrder(order: TestOrder): TestOrder {
  const next = normalizeTestOrder({
    ...order,
    id: order.id || `test-${Date.now()}`,
    details: {
      ...(order.details || { isTest: true }),
      isTest: true,
    },
    updated: new Date().toISOString(),
  });
  const others = listTestOrders().filter((item) => String(item.id) !== String(next.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([next, ...others]));
  notifyTestOrdersChanged(next.id);
  return next;
}

/** Prideda trūkstamus test orderius (esamų neperrašo). */
export function mergeMissingTestOrders(orders: TestOrder[]): number {
  if (!canUseStorage() || orders.length === 0) return 0;
  const existing = listTestOrders();
  const have = new Set(existing.map((item) => String(item.id)));
  const incoming = orders
    .filter((order) => isTestOrder(order) && !have.has(String(order.id)))
    .map((order) =>
      normalizeTestOrder({
        ...order,
        details: {
          ...(order.details || { isTest: true }),
          isTest: true,
        },
      })
    );
  if (incoming.length === 0) return 0;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...incoming, ...existing]));
  notifyTestOrdersChanged();
  return incoming.length;
}

export function deleteTestOrder(id: string): void {
  const next = listTestOrders().filter((item) => String(item.id) !== String(id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  notifyTestOrdersChanged(id);
}

export function createTestOrderDraft(input: {
  client: string;
  agency: string;
}): TestOrder {
  const id = `test-${Date.now()}`;
  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const toDate = new Date(today);
  toDate.setDate(toDate.getDate() + 6);
  const to = toDate.toISOString().slice(0, 10);
  // Medi checkerboard — same rule as skaičiuoklė applyPreset("medi") phase 0
  const grid = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 17 }, (_, hourIndex) => (day + hourIndex) % 2 === 0),
  );

  return upsertTestOrder({
    id,
    client: input.client.trim(),
    agency: input.agency.trim(),
    invoice_id: id.replace(/^test-/, ''),
    approved: false,
    viaduct: false,
    from,
    to,
    media_received: false,
    invoice_issued: false,
    final_price: 0,
    invoice_sent: false,
    updated: new Date().toISOString(),
    intensity: 'Medi',
    screens: [],
    grid,
    clip_duration: 10,
    viaduct_frequency: 1,
    on_sale_screens: [],
    on_sale_discount: 0,
    hidden_screens: [],
    details: {
      isTest: true,
      discount: 80,
      total: 0,
      finalPrice: 0,
      plan: {
        clip_duration: 10,
        intensity: 'Medi',
        grid,
        viaductFrequency: 1,
        total: 0,
      },
    },
  });
}

type DemoSeed = {
  client: string;
  agency: string;
  invoice_id: string;
  approved: boolean;
  from: string;
  to: string;
  media_received: boolean;
  final_price: number;
  invoice_issued?: boolean;
  invoice_sent?: boolean;
  is_spec_order?: boolean;
  hasComment?: boolean;
  /** Variantas A: Media stulpelio 8/10 (rezoliucijos, ne ekranai) */
  mediaCoverage?: { ok: number; total: number; unit?: 'resolution' };
};

const DEMO_SEEDS: DemoSeed[] = [
  {
    client: 'Red Bull',
    agency: 'Havas Media',
    invoice_id: '3612',
    approved: false,
    from: '2026-07-20',
    to: '2026-07-26',
    media_received: false,
    final_price: 286.34,
    hasComment: true,
  },
  {
    client: 'Tech Zity',
    agency: 'Dentsu',
    invoice_id: '3609',
    approved: true,
    from: '2026-07-13',
    to: '2026-07-26',
    media_received: true,
    final_price: 1878.4,
    invoice_issued: true,
    invoice_sent: false,
    is_spec_order: true,
    mediaCoverage: { ok: 8, total: 10 },
  },
  {
    client: 'Tele2 Planai',
    agency: 'Media House',
    invoice_id: '3604',
    approved: true,
    from: '2026-07-13',
    to: '2026-07-19',
    media_received: true,
    final_price: 2156.0,
    invoice_issued: true,
    invoice_sent: true,
    mediaCoverage: { ok: 10, total: 10 },
  },
  {
    client: 'Bitė Planai',
    agency: 'Media House',
    invoice_id: '3603',
    approved: true,
    from: '2026-07-13',
    to: '2026-07-19',
    media_received: false,
    final_price: 2156.0,
    hasComment: true,
    mediaCoverage: { ok: 0, total: 10 },
  },
  {
    client: 'Pigu.lt',
    agency: 'Open',
    invoice_id: '3598',
    approved: false,
    from: '2026-07-27',
    to: '2026-08-02',
    media_received: false,
    final_price: 940.12,
  },
  {
    client: 'Maxima vasara',
    agency: 'DDB',
    invoice_id: '3591',
    approved: true,
    from: '2026-07-06',
    to: '2026-07-12',
    media_received: true,
    final_price: 4320.5,
    invoice_issued: true,
    invoice_sent: true,
    is_spec_order: true,
    mediaCoverage: { ok: 12, total: 12 },
  },
  {
    client: 'Lidl savaitė',
    agency: 'McCann',
    invoice_id: '3587',
    approved: true,
    from: '2026-07-20',
    to: '2026-07-26',
    media_received: true,
    final_price: 1680.0,
    mediaCoverage: { ok: 7, total: 10 },
  },
  {
    client: 'Circle K',
    agency: 'BPN',
    invoice_id: '3582',
    approved: false,
    from: '2026-08-03',
    to: '2026-08-09',
    media_received: false,
    final_price: 512.75,
    hasComment: true,
  },
];

/**
 * Jei localStorage tuščias — įdeda hub-like demo eilutes (SPEC, komentarai, statusai).
 * Esamiems demo įrašams uždeda mediaCoverage snapshot (8/10 ir pan.).
 */
export function ensureDemoTestOrders(): TestOrder[] {
  let existing = listTestOrders();

  if (existing.length === 0) {
    const now = Date.now();
    for (let i = 0; i < DEMO_SEEDS.length; i += 1) {
      const seed = DEMO_SEEDS[i];
      const id = `test-demo-${seed.invoice_id}`;
      const grid = Array.from({ length: 7 }, (_, day) =>
        Array.from({ length: 17 }, (_, hourIndex) => (day + hourIndex) % 2 === 0),
      );
      upsertTestOrder({
        id,
        client: seed.client,
        agency: seed.agency,
        invoice_id: seed.invoice_id,
        approved: seed.approved,
        viaduct: false,
        from: seed.from,
        to: seed.to,
        media_received: seed.media_received,
        invoice_issued: !!seed.invoice_issued,
        final_price: seed.final_price,
        invoice_sent: !!seed.invoice_sent,
        is_spec_order: !!seed.is_spec_order,
        updated: new Date(now - i * 60_000).toISOString(),
        intensity: 'Medi',
        screens: [],
        grid,
        clip_duration: 10,
        viaduct_frequency: 1,
        on_sale_screens: [],
        on_sale_discount: 0,
        hidden_screens: [],
        details: {
          isTest: true,
          discount: 80,
          total: seed.final_price,
          finalPrice: seed.final_price,
          hasCommentOrScreenshot: !!seed.hasComment,
          ...(seed.mediaCoverage
            ? {
                mediaCoverage: {
                  ...seed.mediaCoverage,
                  unit: 'resolution' as const,
                  updatedAt: new Date().toISOString(),
                },
              }
            : {}),
          plan: {
            clip_duration: 10,
            intensity: 'Medi',
            grid,
            viaductFrequency: 1,
            total: seed.final_price,
          },
        },
      });
    }
    existing = listTestOrders();
  }

  let changed = false;
  for (const seed of DEMO_SEEDS) {
    if (!seed.mediaCoverage) continue;
    const id = `test-demo-${seed.invoice_id}`;
    const order = existing.find((item) => item.id === id);
    if (!order) continue;
    const prev = order.details?.mediaCoverage;
    if (
      prev &&
      prev.ok === seed.mediaCoverage.ok &&
      prev.total === seed.mediaCoverage.total
    ) {
      continue;
    }
    upsertTestOrder({
      ...order,
      details: {
        ...order.details,
        isTest: true,
        mediaCoverage: {
          ...seed.mediaCoverage,
          unit: 'resolution' as const,
          updatedAt: new Date().toISOString(),
        },
      },
    });
    changed = true;
  }

  return changed ? listTestOrders() : existing;
}

function testOrderCampaignFingerprint(order: Pick<TestOrder, 'final_price' | 'from' | 'to' | 'screens' | 'details'>): string {
  return JSON.stringify({
    price: Number(order.final_price) || 0,
    from: order.from || '',
    to: order.to || '',
    screens: order.screens || [],
    token: order.details?.publicToken || '',
    names: order.details?.plan?.screenNames || [],
    total: order.details?.plan?.total || order.details?.total || 0,
  });
}

async function fetchPlayCampaignByOrderId(
  orderId: string
): Promise<PlayPublicCampaignRecord | null> {
  const response = await fetch(`/api/play-campaigns?orderId=${encodeURIComponent(orderId)}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const record = (await response.json().catch(() => null)) as PlayPublicCampaignRecord | null;
  if (!record?.token || !record.campaign) return null;
  return record;
}

export async function hydrateTestOrderFromPlayCampaign(
  orderId: string
): Promise<TestOrder | null> {
  const current = getTestOrder(orderId);
  if (!current) return null;
  try {
    const record = await fetchPlayCampaignByOrderId(orderId);
    if (!record) return current;
    const merged = normalizeTestOrder(
      mergeOrderWithPlayCampaign(current, record) as TestOrder
    );
    if (testOrderCampaignFingerprint(current) === testOrderCampaignFingerprint(merged)) {
      return current;
    }
    return upsertTestOrder(merged);
  } catch {
    return current;
  }
}

export async function hydrateTestOrdersFromPlayCampaigns(): Promise<number> {
  if (!canUseStorage()) return 0;
  const orders = listTestOrders();
  const results = await Promise.all(
    orders.map((order) => hydrateTestOrderFromPlayCampaign(order.id))
  );
  return results.filter(Boolean).length;
}

export function getTestOrderActivityMap(orders: TestOrder[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const order of orders) {
    const details = order.details as { hasCommentOrScreenshot?: boolean } | undefined;
    if (details?.hasCommentOrScreenshot) map[order.id] = true;
  }
  return map;
}

/** Live sąrašams — niekada nerodyti test orderių (saugos tinklas). */
export function excludeTestOrders<T extends Pick<Order, 'id' | 'details'>>(orders: T[]): T[] {
  return orders.filter((order) => !isTestOrder(order));
}
