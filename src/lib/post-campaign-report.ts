import {
  createCampaignCalculator,
  type CampaignBundle,
  type CampaignOrderInput,
  type CampaignScreen,
} from '@/lib/campaign-calculator';
import {
  computePostCampaignDifference,
  computePostCampaignShownViews,
} from '@/lib/reklamos-planas-post-campaign';
import type { CampaignPlaysSnapshot } from '@/lib/player-devices';

export type PostCampaignClipReportRow = {
  mediaId: string;
  name: string;
  shownViews: number;
};

export type PostCampaignScreenReportRow = {
  screenId: string;
  name: string;
  city: string;
  plannedViews: number;
  shownViews: number;
  difference: number;
  /** realūs parodymai iš playerio (Panorama ir kt.) */
  source: 'live' | 'estimated';
  /** Live byMedia skaidymas — UI išskleidžia kai ≥2 */
  clips?: PostCampaignClipReportRow[];
};

/** Sutampa su player-bridge / player-sync mediaId formatu. */
export function orderClipMediaId(orderId: string, clipId: string): string {
  return `${orderId}-${clipId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function buildMediaLabelsFromClips(
  orderId: string,
  clips: Array<{ id: string; filename: string }>
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const clip of clips) {
    const mediaId = orderClipMediaId(orderId, clip.id);
    const name = String(clip.filename || '').trim();
    if (mediaId && name) labels[mediaId] = name;
  }
  return labels;
}

function shortenMediaId(mediaId: string): string {
  const cleaned = String(mediaId || '').trim();
  if (cleaned.length <= 28) return cleaned || 'Klipas';
  return `…${cleaned.slice(-24)}`;
}

function clipsFromByMedia(
  byMedia: Record<string, number> | undefined,
  mediaLabels?: Record<string, string> | null
): PostCampaignClipReportRow[] | undefined {
  if (!byMedia || typeof byMedia !== 'object') return undefined;
  const clips = Object.entries(byMedia)
    .map(([mediaId, count]) => ({
      mediaId,
      name: mediaLabels?.[mediaId] || shortenMediaId(mediaId),
      shownViews: Number(count) || 0,
    }))
    .filter((c) => c.shownViews > 0)
    .sort((a, b) => b.shownViews - a.shownViews || a.name.localeCompare(b.name, 'lt'));
  return clips.length ? clips : undefined;
}

type PlanScreenRowHint = {
  name?: string | null;
  catalogId?: string | null;
  impressions?: number | null;
  city?: string | null;
};

type OrderScreenHints = {
  screens?: string[] | null;
  details?: {
    live?: { screenNames?: string[] | null } | null;
    plan?: {
      screenNames?: string[] | null;
      screenRows?: PlanScreenRowHint[] | null;
    } | null;
  } | null;
};

/** Piksel ekranai — be partnerio ID (partnerių ekranai turi partner lauką). */
export function isPikselCampaignScreen(screen: CampaignScreen): boolean {
  return !String(screen.partner || '').trim();
}

export function normalizeScreenKey(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('lt-LT');
}

function buildPlannedImpressionsByKey(order: OrderScreenHints): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of order.details?.plan?.screenRows || []) {
    if (typeof row.impressions !== 'number' || !(row.impressions > 0)) continue;
    const value = Math.round(row.impressions);
    const byName = normalizeScreenKey(row.name);
    if (byName) map.set(byName, value);
    const byId = String(row.catalogId || '').trim();
    if (byId) map.set(byId, value);
  }
  return map;
}

/**
 * Test / Live orderiai dažnai turi tik screenNames, ne PB catalog ID.
 * Surenkame ID iš screens, plan.screenRows, vardų ir live plays.
 */
export function resolveCampaignScreenIds(
  order: OrderScreenHints,
  catalog: CampaignScreen[],
  livePlays?: CampaignPlaysSnapshot | null
): string[] {
  const catalogById = new Map(catalog.map((s) => [s.id, s]));
  const catalogByName = new Map(
    catalog.map((s) => [normalizeScreenKey(s.name), s.id])
  );
  const ids = new Set<string>();

  const addId = (id: string | null | undefined) => {
    const cleaned = String(id || '').trim();
    if (cleaned && catalogById.has(cleaned)) ids.add(cleaned);
  };
  const addName = (name: string | null | undefined) => {
    const key = normalizeScreenKey(name);
    if (!key) return;
    const id = catalogByName.get(key);
    if (id) ids.add(id);
  };

  for (const id of order.screens || []) addId(id);
  for (const row of order.details?.plan?.screenRows || []) {
    addId(row.catalogId);
    addName(row.name);
  }
  for (const name of order.details?.plan?.screenNames || []) addName(name);
  for (const name of order.details?.live?.screenNames || []) addName(name);

  if (livePlays) {
    for (const key of livePlays.liveScreens || []) addName(key);
    for (const key of Object.keys(livePlays.screens || {})) addName(key);
  }

  return [...ids];
}

function resolvePlannedViews(
  calcViews: number,
  screen: CampaignScreen,
  plannedByKey: Map<string, number>
): number {
  if (calcViews > 0) return Math.round(calcViews);
  return (
    plannedByKey.get(screen.id) ||
    plannedByKey.get(normalizeScreenKey(screen.name)) ||
    0
  );
}

export function buildPikselPostCampaignReportRows(params: {
  order: CampaignOrderInput & OrderScreenHints;
  screens: CampaignScreen[];
  bundles: CampaignBundle[];
  /** Jei pateikta — live ekranams naudojami realūs parodymai. */
  livePlays?: CampaignPlaysSnapshot | null;
  /** mediaId → failo vardas (iš order clips) */
  mediaLabels?: Record<string, string> | null;
}): PostCampaignScreenReportRow[] {
  const { order, screens, bundles, livePlays, mediaLabels } = params;
  const resolvedIds = resolveCampaignScreenIds(order, screens, livePlays);
  const orderForCalc: CampaignOrderInput = {
    ...order,
    screens: resolvedIds.length ? resolvedIds : order.screens || [],
  };
  const calc = createCampaignCalculator(orderForCalc, screens, bundles, null);
  const plannedByKey = buildPlannedImpressionsByKey(order);
  const liveKeys = new Set(
    (livePlays?.liveScreens || []).map((k) => normalizeScreenKey(k))
  );
  for (const key of Object.keys(livePlays?.screens || {})) {
    liveKeys.add(normalizeScreenKey(key));
  }
  const catalogByName = new Map(
    screens.map((s) => [normalizeScreenKey(s.name), s])
  );

  const rows = calc.orderedAllScreens
    .filter((screen) => {
      if (calc.isInactive(screen)) return false;
      const key = normalizeScreenKey(screen.name);
      // Live playerio ekranus rodom visada (net jei PB partner laukas užpildytas).
      if (liveKeys.has(key)) return true;
      return isPikselCampaignScreen(screen);
    })
    .map((screen) => {
      const plannedViews = resolvePlannedViews(
        calc.views(screen),
        screen,
        plannedByKey
      );
      const screenKey = normalizeScreenKey(screen.name);
      const isLive = liveKeys.has(screenKey);
      const liveTotal = livePlays?.screens?.[screenKey]?.total;

      if (isLive) {
        const shownViews = Number(liveTotal) || 0;
        const clips = clipsFromByMedia(
          livePlays?.screens?.[screenKey]?.byMedia,
          mediaLabels
        );
        return {
          screenId: screen.id,
          name: screen.name,
          city: screen.city_display || screen.city || '',
          plannedViews,
          shownViews,
          difference: computePostCampaignDifference(plannedViews, shownViews),
          source: 'live' as const,
          ...(clips ? { clips } : {}),
        };
      }

      const shownViews = computePostCampaignShownViews(
        plannedViews,
        order.id,
        screen.id,
        order.from,
        order.to
      );
      return {
        screenId: screen.id,
        name: screen.name,
        city: screen.city_display || screen.city || '',
        plannedViews,
        shownViews,
        difference: computePostCampaignDifference(plannedViews, shownViews),
        source: 'estimated' as const,
      };
    });

  // Jei kataloge nerasta, bet playeris jau skaičiuoja — vis tiek parodyk Live eilutę.
  const seenKeys = new Set(rows.map((r) => normalizeScreenKey(r.name)));
  for (const [screenKey, entry] of Object.entries(livePlays?.screens || {})) {
    const key = normalizeScreenKey(screenKey);
    if (!key || seenKeys.has(key)) continue;
    const catalog = catalogByName.get(key);
    const plannedViews = catalog
      ? resolvePlannedViews(0, catalog, plannedByKey)
      : plannedByKey.get(key) || 0;
    const shownViews = Number(entry?.total) || 0;
    const clips = clipsFromByMedia(entry?.byMedia, mediaLabels);
    rows.push({
      screenId: catalog?.id || `live:${key}`,
      name: catalog?.name || screenKey,
      city: catalog?.city_display || catalog?.city || '',
      plannedViews,
      shownViews,
      difference: computePostCampaignDifference(plannedViews, shownViews),
      source: 'live',
      ...(clips ? { clips } : {}),
    });
  }

  return rows;
}

export function formatReportViews(value: number): string {
  return new Intl.NumberFormat('lt-LT').format(value);
}

/** screenId → realūs parodymai (XLS override). */
export function liveShownViewsByScreenId(
  rows: PostCampaignScreenReportRow[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (row.source === 'live') out[row.screenId] = row.shownViews;
  }
  return out;
}
