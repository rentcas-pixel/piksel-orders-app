import type { Order } from '@/types';
import {
  evaluateOrderClips,
  listOrderClips,
  resolveOrderClipScreens,
  type OrderClipRecord,
  type OrderClipScreen,
} from '@/lib/order-clips';
import { getTestOrder, isTestOrder, upsertTestOrder, type TestOrder } from '@/lib/test-orders';
import { publishOrderToPlayer, unpublishOrderFromPlayer } from '@/lib/player-bridge';
import { parseDateOnlyLocal } from '@/lib/date-utils';

export type OrderLiveSnapshot = {
  client: string;
  from: string;
  to: string;
  screenNames: string[];
  clipDuration: number;
  viaduct: boolean;
  viaductFrequency: number;
  clockOverlay: boolean;
  clipStamp: string;
  rowStamp: string;
  gridKey: string;
};

export type OrderLiveState = {
  status: 'idle' | 'live';
  publishedAt?: string;
  partial?: boolean;
  clipCount?: number;
  screenNames?: string[];
  playerApi?: string;
  playerScreen?: string;
  playerItemCount?: number;
  /** Plano/pavadinimo fingerprint paskutinio Live — Atnaujinti Live po uždarymo. */
  publishedContentKey?: string;
  /** Ką ekranai realiai turi — sąrašui „kas pasikeitė“. */
  publishedSnapshot?: OrderLiveSnapshot;
};

export type OrderLivePublishResult = {
  live: OrderLiveState;
  screens: OrderClipScreen[];
  clipCount: number;
  requiredCount: number;
  coveredCount: number;
  isPartial: boolean;
  player?: {
    base: string;
    playerScreen?: string;
    itemCount: number;
    received: boolean;
    onlineDevices?: string[];
  };
};

export function getOrderLiveState(order: Order): OrderLiveState {
  // Live tik patvirtintiems — nepatvirtintas negali būti „Rodoma“
  if (!order.approved) return { status: 'idle' };
  const live = order.details?.live;
  if (live?.status === 'live') return live;
  return { status: 'idle' };
}

function sortedScreenKey(names: Array<string | null | undefined> | undefined): string {
  return (names || [])
    .map((name) => String(name || '').trim().toLocaleLowerCase('lt-LT'))
    .filter(Boolean)
    .sort()
    .join(',');
}

const LT_MONTHS = [
  'sausio',
  'vasario',
  'kovo',
  'balandžio',
  'gegužės',
  'birželio',
  'liepos',
  'rugpjūčio',
  'rugsėjo',
  'spalio',
  'lapkričio',
  'gruodžio',
];

function planScreenNames(order: Order): string[] {
  const rows = order.details?.plan?.screenRows || [];
  if (rows.some((row) => String(row.name || '').trim())) {
    return rows.map((row) => String(row.name || '').trim()).filter(Boolean);
  }
  return (order.details?.plan?.screenNames || []).map((name) => String(name || '').trim()).filter(Boolean);
}

function screenNameList(names: string[] | null | undefined): string[] {
  return (names ?? []).map((name) => String(name || '').trim()).filter(Boolean);
}

function planRowStamp(order: Order): string {
  const rows = order.details?.plan?.screenRows || [];
  return rows
    .map((row) =>
      [
        String(row.name || '').trim().toLocaleLowerCase('lt-LT'),
        String(row.from || ''),
        String(row.to || ''),
      ].join('|')
    )
    .join(';');
}

function planGridKey(order: Order): string {
  return JSON.stringify(order.details?.plan?.grid || order.grid || []);
}

function quoteScreen(name: string): string {
  return `„${name}“`;
}

function joinLtQuoted(names: string[]): string {
  const quoted = names.map(quoteScreen);
  if (quoted.length === 1) return quoted[0];
  if (quoted.length === 2) return `${quoted[0]} ir ${quoted[1]}`;
  return `${quoted.slice(0, -1).join(', ')} ir ${quoted[quoted.length - 1]}`;
}

function formatDayLt(iso: string): { year: number; month: string; day: number } | null {
  const parsed = parseDateOnlyLocal(iso);
  if (!parsed) return null;
  return {
    year: parsed.getFullYear(),
    month: LT_MONTHS[parsed.getMonth()] || '',
    day: parsed.getDate(),
  };
}

function formatLtDateRange(fromIso: string, toIso: string): string | null {
  const from = formatDayLt(fromIso);
  const to = formatDayLt(toIso);
  if (!from || !to) return null;
  if (from.year === to.year && from.month === to.month) {
    return `${from.month} ${from.day} → ${to.day} d.`;
  }
  return `${from.month} ${from.day} d. → ${to.month} ${to.day} d.`;
}

export function orderLiveClipStamp(
  clips: Array<
    Pick<OrderClipRecord, 'id' | 'filename' | 'displayFrom' | 'displayTo' | 'displayScreenNames'>
  >
): string {
  return [...clips]
    .map((clip) =>
      [
        String(clip.id || ''),
        String(clip.filename || '').trim(),
        String(clip.displayFrom || ''),
        String(clip.displayTo || ''),
        (clip.displayScreenNames || [])
          .map((name) => String(name || '').trim().toLocaleLowerCase('lt-LT'))
          .filter(Boolean)
          .sort()
          .join(','),
      ].join('|')
    )
    .sort()
    .join(';');
}

export function clipIdsFromLiveStamp(clipStamp?: string | null): string[] {
  if (!clipStamp) return [];
  return clipStamp
    .split(';')
    .map((part) => String(part.split('|')[0] || '').trim())
    .filter(Boolean);
}

export function buildOrderLiveSnapshot(order: Order, clipStamp = ''): OrderLiveSnapshot {
  const plan = order.details?.plan;
  return {
    client: String(order.client || '').trim(),
    from: String(order.from || ''),
    to: String(order.to || ''),
    screenNames: planScreenNames(order),
    clipDuration: Number(plan?.clip_duration || order.clip_duration) || 10,
    viaduct: order.viaduct === true,
    viaductFrequency: order.viaduct
      ? Number(order.viaduct_frequency) || Number(plan?.viaductFrequency) || 1
      : 1,
    clockOverlay: order.details?.clockOverlay?.enabled === true,
    clipStamp: String(clipStamp || ''),
    rowStamp: planRowStamp(order),
    gridKey: planGridKey(order),
  };
}

export function snapshotFromLiveState(
  live: Pick<OrderLiveState, 'publishedSnapshot' | 'publishedContentKey' | 'screenNames'>,
  order?: Order
): OrderLiveSnapshot | null {
  if (live.publishedSnapshot) {
    return {
      ...live.publishedSnapshot,
      screenNames: screenNameList(
        live.publishedSnapshot.screenNames?.length
          ? live.publishedSnapshot.screenNames
          : live.screenNames
      ),
    };
  }
  const key = String(live.publishedContentKey || '');
  if (key) {
    const parts = key.split('::');
    return {
      client: parts[0] || '',
      from: parts[1] || '',
      to: parts[2] || '',
      screenNames: live.screenNames?.length ? live.screenNames : planScreenNames(order || ({} as Order)),
      clipDuration: Number(parts[7]) || 10,
      viaduct: parts[8] === 'true',
      viaductFrequency: Number(parts[9]) || 1,
      clockOverlay: parts[6] === 'true',
      clipStamp: '',
      rowStamp: '',
      gridKey: parts[3] || '',
    };
  }
  if (live.screenNames?.length) {
    return {
      client: String(order?.client || '').trim(),
      from: String(order?.from || ''),
      to: String(order?.to || ''),
      screenNames: live.screenNames,
      clipDuration: 10,
      viaduct: false,
      viaductFrequency: 1,
      clockOverlay: false,
      clipStamp: '',
      rowStamp: '',
      gridKey: '',
    };
  }
  return null;
}

export function describeOrderLiveChanges(
  published: OrderLiveSnapshot | null | undefined,
  current: OrderLiveSnapshot
): string[] {
  if (!published) return [];
  const lines: string[] = [];

  if (published.client && current.client && published.client !== current.client) {
    lines.push(`Pavadinimas pakeistas: ${published.client} → ${current.client}.`);
  }

  if (published.from && current.from && published.from !== current.from) {
    const range = formatLtDateRange(published.from, current.from);
    lines.push(range ? `Pradžia pakeista: ${range}` : 'Pradžia pakeista.');
  }
  if (published.to && current.to && published.to !== current.to) {
    const range = formatLtDateRange(published.to, current.to);
    lines.push(range ? `Pabaiga pakeista: ${range}` : 'Pabaiga pakeista.');
  }

  const publishedScreens = new Map(
    screenNameList(published.screenNames).map((name) => [
      name.toLocaleLowerCase('lt-LT'),
      name,
    ])
  );
  const currentScreens = new Map(
    screenNameList(current.screenNames).map((name) => [
      name.toLocaleLowerCase('lt-LT'),
      name,
    ])
  );
  const added = [...currentScreens.entries()]
    .filter(([key]) => !publishedScreens.has(key))
    .map(([, name]) => name);
  const removed = [...publishedScreens.entries()]
    .filter(([key]) => !currentScreens.has(key))
    .map(([, name]) => name);
  if (added.length === 1) lines.push(`Pridėtas ekranas ${quoteScreen(added[0])}.`);
  else if (added.length > 1) lines.push(`Pridėti ekranai ${joinLtQuoted(added)}.`);
  if (removed.length === 1) lines.push(`Pašalintas ekranas ${quoteScreen(removed[0])}.`);
  else if (removed.length > 1) lines.push(`Pašalinti ekranai ${joinLtQuoted(removed)}.`);

  if (
    published.clipStamp &&
    current.clipStamp &&
    published.clipStamp !== current.clipStamp
  ) {
    lines.push('Pakeistas klipas.');
  }

  if (published.clipDuration !== current.clipDuration) {
    lines.push(`Klipo trukmė pakeista: ${published.clipDuration} → ${current.clipDuration} s.`);
  }
  if (published.clockOverlay !== current.clockOverlay) {
    lines.push(current.clockOverlay ? 'Įjungtas laikrodis.' : 'Išjungtas laikrodis.');
  }
  if (published.viaduct !== current.viaduct) {
    lines.push(current.viaduct ? 'Įjungti viadukai.' : 'Išjungti viadukai.');
  } else if (current.viaduct && published.viaductFrequency !== current.viaductFrequency) {
    lines.push(
      `Viadukų dažnis pakeistas: ${published.viaductFrequency} → ${current.viaductFrequency}.`
    );
  }

  const datedAlready = published.from !== current.from || published.to !== current.to;
  if (!datedAlready && published.rowStamp && current.rowStamp && published.rowStamp !== current.rowStamp) {
    lines.push('Pakeistos ekranų datos.');
  }

  return lines;
}

export function describeLiveDirtyFallback(
  published: OrderLiveSnapshot | null | undefined,
  current: OrderLiveSnapshot,
  options?: { assumeClipChange?: boolean }
): string[] {
  const lines = describeOrderLiveChanges(published, current);
  if (lines.length) return lines;
  if (options?.assumeClipChange) return ['Pakeistas klipas.'];
  return ['Pakeistas transliacijų planas.'];
}

/** Ką Live turi atitikti — ta pati tvarka kaip publishOrderToPlayer. */
export function orderLiveContentKey(order: Order): string {
  const plan = order.details?.plan;
  const rows = plan?.screenRows || [];
  const rowKey = rows
    .map((row) =>
      [row.catalogId, row.name, row.from, row.to, row.resolution, row.type].join('|')
    )
    .join(';');
  return [
    String(order.client || '').trim(),
    String(order.from || ''),
    String(order.to || ''),
    JSON.stringify(plan?.grid || order.grid || []),
    (order.screens || []).join(','),
    rowKey || (plan?.screenNames || []).join(';'),
    String(order.details?.clockOverlay?.enabled === true),
    String(Number(plan?.clip_duration || order.clip_duration) || 10),
    String(order.viaduct === true),
    String(
      order.viaduct
        ? Number(order.viaduct_frequency) || Number(plan?.viaductFrequency) || 1
        : 1
    ),
  ].join('::');
}

/** Live buvo nusiųstas į grotuvą, ne tik pažymėtas formoje. */
export function orderLiveWasSentToPlayer(live: OrderLiveState | null | undefined): boolean {
  if (!live || live.status !== 'live') return false;
  if (live.publishedAt) return true;
  if (String(live.playerApi || '').trim()) return true;
  return Number(live.playerItemCount) > 0;
}

export function liveReconcileNotice(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('užrakintas') || message.includes('nepriimtas')) {
    return 'Grotuvas užrakintas, todėl Live būsena nekeista. Užsakymą galima redaguoti.';
  }
  if (message.includes('Nepavyko susisiekti')) {
    return 'Grotuvo nepavyko pasiekti, todėl Live būsena nekeista. Užsakymą galima redaguoti.';
  }
  return 'Live būsena nekeista. Užsakymą galima redaguoti.';
}

export type ReconcileOrderLiveResult = {
  state: OrderLiveState;
  notice?: string;
};

function storedLiveState(order: Order): OrderLiveState {
  const live = order.details?.live;
  if (live?.status === 'live') return live;
  return { status: 'idle' };
}

function rememberIdleLive(order: Order): OrderLiveState {
  const idle: OrderLiveState = { status: 'idle' };
  if (isTestOrder(order)) {
    const existing = getTestOrder(order.id) || (order as TestOrder);
    upsertTestOrder({
      ...existing,
      details: {
        ...(existing.details || { isTest: true }),
        isTest: true,
        live: idle,
      },
    });
  }
  return idle;
}

export function orderLiveNeedsUpdate(order: Order): boolean {
  const live = getOrderLiveState(order);
  if (live.status !== 'live') return false;
  const published = String(live.publishedContentKey || '');
  if (published) return published !== orderLiveContentKey(order);
  const planNames = sortedScreenKey(
    (order.details?.plan?.screenRows || []).map((row) => row.name).length
      ? (order.details?.plan?.screenRows || []).map((row) => row.name)
      : order.details?.plan?.screenNames
  );
  const sentNames = sortedScreenKey(live.screenNames);
  return Boolean(planNames && sentNames && planNames !== sentNames);
}

/**
 * Jei Live ON, bet nepatvirtinta / nėra klipų — idle.
 * Grotuvo nekviečia, kol kampanija ten realiai nusiųsta.
 * Atmestas raktas formos neatidaro klaidos langu.
 */
export async function reconcileOrderLiveState(order: Order): Promise<ReconcileOrderLiveResult> {
  const stored = order.details?.live;
  if (stored?.status !== 'live') return { state: { status: 'idle' } };

  let shouldTakeDown = !order.approved;
  if (!shouldTakeDown) {
    const current = getOrderLiveState(order);
    if (current.status !== 'live') return { state: { status: 'idle' } };
    try {
      const prepared = await prepareOrderLivePublish(order);
      if (prepared.canPublish) return { state: current };
    } catch {
      return { state: storedLiveState(order) };
    }
    shouldTakeDown = true;
  }

  if (!shouldTakeDown || !orderLiveWasSentToPlayer(stored)) {
    return { state: rememberIdleLive(order) };
  }

  try {
    await unpublishOrderFromPlayer(order.id);
  } catch (error) {
    return {
      state: storedLiveState(order),
      notice: liveReconcileNotice(error),
    };
  }
  return { state: rememberIdleLive(order) };
}

export async function prepareOrderLivePublish(order: Order): Promise<{
  screens: OrderClipScreen[];
  clips: OrderClipRecord[];
  clipCount: number;
  evaluation: ReturnType<typeof evaluateOrderClips>;
  canPublish: boolean;
  blockReason?: string;
}> {
  const screens = await resolveOrderClipScreens(order);
  const clips = await listOrderClips(order.id);
  const evaluation = evaluateOrderClips(screens, clips);

  if (evaluation.pikselScreens.length === 0) {
    return {
      screens,
      clips,
      clipCount: clips.length,
      evaluation,
      canPublish: false,
      blockReason: 'Nėra Piksel ekranų šiame orderyje.',
    };
  }
  if (evaluation.missingScreenResolutions) {
    return {
      screens,
      clips,
      clipCount: clips.length,
      evaluation,
      canPublish: false,
      blockReason:
        'Ekranams trūksta rezoliucijų duomenų — negalima sutapatinti klipų. Išsaugokite planą iš naujo.',
    };
  }
  if (clips.length === 0) {
    return {
      screens,
      clips,
      clipCount: 0,
      evaluation,
      canPublish: false,
      blockReason: 'Įkelkite bent vieną klipą skiltyje Klipai.',
    };
  }
  if (!evaluation.canPublish) {
    const bad = evaluation.unmatchedClips
      .map((c) => `${c.filename} (${c.resolutionLabel})`)
      .join(', ');
    return {
      screens,
      clips,
      clipCount: clips.length,
      evaluation,
      canPublish: false,
      blockReason: bad
        ? `Nėra klipo, atitinkančio plano ekranų rezoliucijas. Netiko: ${bad}.`
        : 'Nėra klipo, atitinkančio plano ekranų rezoliucijas.',
    };
  }

  return {
    screens,
    clips,
    clipCount: clips.length,
    evaluation,
    canPublish: true,
  };
}

/** Live: pažymi hub’e + siunčia klipus į lokalų Piksel Player. */
export async function publishOrderLive(order: Order): Promise<OrderLivePublishResult> {
  if (!order.approved) {
    throw new Error('Pirmiausia patvirtinkite užsakymą — Live galimas tik patvirtintiems.');
  }
  const prepared = await prepareOrderLivePublish(order);
  if (!prepared.canPublish) {
    throw new Error(prepared.blockReason || 'Negalima publikuoti.');
  }

  const { evaluation, clips } = prepared;
  const isPartial = !evaluation.result.isComplete;
  const screenNames = evaluation.publishableScreenNames;
  const clipIds = evaluation.publishableClipIds;
  const clipScreenMap: Record<string, string[]> = {};
  for (const item of evaluation.matchedAssignments) {
    clipScreenMap[item.clipId] = item.screenNames;
  }

  const publishedOrder = isTestOrder(order)
    ? { ...(getTestOrder(order.id) || order), ...order, approved: true }
    : order;
  const publishedSnapshot = buildOrderLiveSnapshot(
    publishedOrder,
    orderLiveClipStamp(clips)
  );

  const player = await publishOrderToPlayer(publishedOrder, screenNames, {
    clipIds,
    clipScreenMap,
  });

  const live: OrderLiveState = {
    status: 'live',
    publishedAt: new Date().toISOString(),
    partial: isPartial,
    clipCount: clipIds.length,
    screenNames,
    playerApi: player.base,
    playerScreen: player.playerScreen,
    playerItemCount: player.itemCount,
    publishedContentKey: orderLiveContentKey(publishedOrder),
    publishedSnapshot,
  };

  if (isTestOrder(order)) {
    const existing = getTestOrder(order.id) || (order as TestOrder);
    upsertTestOrder({
      ...existing,
      client: publishedOrder.client,
      from: publishedOrder.from,
      to: publishedOrder.to,
      approved: true,
      media_received: true,
      details: {
        ...(existing.details || { isTest: true }),
        isTest: true,
        live,
      },
    });
  }

  return {
    live,
    screens: evaluation.pikselScreens.filter((s) =>
      screenNames.some((n) => n.toLowerCase() === String(s.name || '').toLowerCase())
    ),
    clipCount: clipIds.length,
    requiredCount: evaluation.required.length,
    coveredCount: evaluation.result.coveredKeys.length,
    isPartial,
    player,
  };
}

export async function unpublishOrderLive(order: Order): Promise<OrderLiveState> {
  await unpublishOrderFromPlayer(order.id);
  const live: OrderLiveState = { status: 'idle' };
  if (isTestOrder(order)) {
    const existing = getTestOrder(order.id) || (order as TestOrder);
    upsertTestOrder({
      ...existing,
      approved: typeof order.approved === 'boolean' ? order.approved : existing.approved,
      details: {
        ...(existing.details || { isTest: true }),
        isTest: true,
        live,
      },
    });
  }
  return live;
}
