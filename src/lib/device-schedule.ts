import type { PlayerCampaign, PlayerCampaignMedia } from '@/lib/player-devices';

/** Valandos 6–22 (iki 22:59:59), kaip player grid. */
export const SCHEDULE_HOURS = Array.from({ length: 17 }, (_, i) => 6 + i);

export type ScheduleOverrideValue = 'on' | 'off';
/** overrides[campaignId][mediaId][dateIso]["day" | hour] */
export type DeviceScheduleOverrides = Record<
  string,
  Record<string, Record<string, Record<string, ScheduleOverrideValue>>>
>;

export type CellKind = 'on' | 'forced' | 'off-override' | 'off';

export type ScheduleMediaEntry = {
  campaign: PlayerCampaign;
  media: PlayerCampaignMedia;
  key: string;
};

function normalizeScreen(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('lt-LT');
}

export function dateIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Mon=0 … Sun=6 */
export function gridDayIndexForDate(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function mediaKey(campaignId: string, mediaId: string): string {
  return `${campaignId}:${mediaId}`;
}

/** Stabilus media id (API kartais be id). */
export function stableMediaId(media: PlayerCampaignMedia): string {
  return String(media.id || media.path || 'media');
}

export function mediaFileName(media: PlayerCampaignMedia): string {
  const raw = media.path || media.id || '';
  const parts = raw.split(/[/\\]/);
  return parts[parts.length - 1] || raw || 'media';
}

export function campaignOnScreen(campaign: PlayerCampaign, screenName: string): boolean {
  const screen = normalizeScreen(screenName);
  return (campaign.screens || []).some((name) => normalizeScreen(name) === screen);
}

export function campaignInDateRange(campaign: PlayerCampaign, dateIso: string): boolean {
  if (campaign.from && dateIso < campaign.from) return false;
  if (campaign.to && dateIso > campaign.to) return false;
  return true;
}

export function campaignOverlapsMonth(
  campaign: PlayerCampaign,
  year: number,
  month: number
): boolean {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  if (campaign.from && campaign.from > monthEnd) return false;
  if (campaign.to && campaign.to < monthStart) return false;
  return true;
}

/** Bazinis grid: ar klipas plane tą valandą (be override). */
export function baseHourOn(
  campaign: PlayerCampaign,
  dateIso: string,
  hour: number
): boolean {
  if (!campaignInDateRange(campaign, dateIso)) return false;
  if (hour < 6 || hour > 22) return false;
  const grid = campaign.grid;
  if (!Array.isArray(grid) || grid.length !== 7) return true;
  const day = gridDayIndexForDate(dateIso);
  const hourIndex = hour - 6;
  return Boolean(grid[day]?.[hourIndex]);
}

export function campaignsForScreen(
  campaigns: PlayerCampaign[],
  screenName: string
): PlayerCampaign[] {
  return campaigns.filter(
    (c) => c.published !== false && campaignOnScreen(c, screenName)
  );
}

export function campaignsForScreenOnDay(
  campaigns: PlayerCampaign[],
  screenName: string,
  dateIso: string
): PlayerCampaign[] {
  return campaignsForScreen(campaigns, screenName).filter((c) =>
    campaignInDateRange(c, dateIso)
  );
}

export function campaignsForScreenInMonth(
  campaigns: PlayerCampaign[],
  screenName: string,
  year: number,
  month: number
): PlayerCampaign[] {
  return campaignsForScreen(campaigns, screenName).filter((c) =>
    campaignOverlapsMonth(c, year, month)
  );
}

function ovStorageKey(deviceCode: string): string {
  return `piksel-device-schedule-ov:${deviceCode}`;
}

function orderStorageKey(deviceCode: string): string {
  return `piksel-device-play-order:${deviceCode}`;
}

export function loadOverrides(deviceCode: string): DeviceScheduleOverrides {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(ovStorageKey(deviceCode)) || '{}') || {};
  } catch {
    return {};
  }
}

export function saveOverrides(deviceCode: string, overrides: DeviceScheduleOverrides): void {
  localStorage.setItem(ovStorageKey(deviceCode), JSON.stringify(overrides));
}

export function loadPlayOrder(deviceCode: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(orderStorageKey(deviceCode)) || '[]');
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
}

export function savePlayOrder(deviceCode: string, order: string[]): void {
  localStorage.setItem(orderStorageKey(deviceCode), JSON.stringify(order));
}

export function getOverride(
  overrides: DeviceScheduleOverrides,
  campaignId: string,
  mediaId: string,
  dateIso: string,
  key: string | number
): ScheduleOverrideValue | null {
  return overrides?.[campaignId]?.[mediaId]?.[dateIso]?.[String(key)] || null;
}

export function setOverride(
  overrides: DeviceScheduleOverrides,
  campaignId: string,
  mediaId: string,
  dateIso: string,
  key: string | number,
  value: ScheduleOverrideValue | null
): DeviceScheduleOverrides {
  const camp = { ...(overrides[campaignId] || {}) };
  const media = { ...(camp[mediaId] || {}) };
  const dayMap = { ...(media[dateIso] || {}) };
  if (value == null) delete dayMap[String(key)];
  else dayMap[String(key)] = value;
  media[dateIso] = dayMap;
  camp[mediaId] = media;
  return { ...overrides, [campaignId]: camp };
}

/** Vienas paspaudimas: kas matoma ON → OFF, kas OFF → ON (su grįžimu į planą). */
export function nextHourOverride(
  campaign: PlayerCampaign,
  mediaId: string,
  dateIso: string,
  hour: number,
  overrides: DeviceScheduleOverrides
): { value: ScheduleOverrideValue | null; message: string } {
  const cur = getOverride(overrides, campaign.id, mediaId, dateIso, hour);
  const eff = effectiveHour(campaign, mediaId, dateIso, hour, overrides);

  if (eff.on) {
    if (cur === 'on') {
      return { value: null, message: `${hour}:00 grąžinta į planą` };
    }
    return { value: 'off', message: `${hour}:00 išjungta (forceOff)` };
  }
  if (cur === 'off') {
    return { value: null, message: `${hour}:00 grąžinta į planą` };
  }
  return { value: 'on', message: `${hour}:00 įjungta papildomai (forceOn)` };
}

export function effectiveDay(
  campaign: PlayerCampaign,
  mediaId: string,
  dateIso: string,
  overrides: DeviceScheduleOverrides
): { on: boolean; kind: CellKind } {
  const ov = getOverride(overrides, campaign.id, mediaId, dateIso, 'day');
  const base = campaignInDateRange(campaign, dateIso);
  if (ov === 'on') return { on: true, kind: 'forced' };
  if (ov === 'off') return { on: false, kind: 'off-override' };
  return { on: base, kind: base ? 'on' : 'off' };
}

export function effectiveHour(
  campaign: PlayerCampaign,
  mediaId: string,
  dateIso: string,
  hour: number,
  overrides: DeviceScheduleOverrides
): { on: boolean; kind: CellKind } {
  const dayOv = getOverride(overrides, campaign.id, mediaId, dateIso, 'day');
  const ov = getOverride(overrides, campaign.id, mediaId, dateIso, hour);
  let base = baseHourOn(campaign, dateIso, hour);
  if (dayOv === 'off') base = false;
  if (dayOv === 'on') base = true;
  if (ov === 'on') return { on: true, kind: 'forced' };
  if (ov === 'off') return { on: false, kind: 'off-override' };
  if (dayOv === 'on' && base) return { on: true, kind: 'forced' };
  if (dayOv === 'off') return { on: false, kind: 'off-override' };
  return { on: base, kind: base ? 'on' : 'off' };
}

export function flattenMediaEntries(campaigns: PlayerCampaign[]): ScheduleMediaEntry[] {
  return campaigns.flatMap((campaign) =>
    (campaign.media || []).map((media) => {
      const id = stableMediaId(media);
      return {
        campaign,
        media: { ...media, id },
        key: mediaKey(campaign.id, id),
      };
    })
  );
}

export function campaignMediaIds(campaign: PlayerCampaign): string[] {
  const medias = campaign.media || [];
  if (!medias.length) return ['__campaign__'];
  return medias.map((m) => stableMediaId(m));
}

/** Kampanijos eilutės langelis: agreguota per visus klipus. */
export function effectiveCampaignHour(
  campaign: PlayerCampaign,
  dateIso: string,
  hour: number,
  overrides: DeviceScheduleOverrides
): { on: boolean; kind: CellKind } {
  const ids = campaignMediaIds(campaign);
  const results = ids.map((id) => effectiveHour(campaign, id, dateIso, hour, overrides));
  if (results.some((r) => r.on && r.kind === 'forced')) return { on: true, kind: 'forced' };
  if (results.some((r) => r.on)) return { on: true, kind: 'on' };
  if (results.some((r) => r.kind === 'off-override')) return { on: false, kind: 'off-override' };
  return { on: false, kind: 'off' };
}

export function effectiveCampaignDay(
  campaign: PlayerCampaign,
  dateIso: string,
  overrides: DeviceScheduleOverrides
): { on: boolean; kind: CellKind } {
  const ids = campaignMediaIds(campaign);
  const results = ids.map((id) => effectiveDay(campaign, id, dateIso, overrides));
  if (results.some((r) => r.on && r.kind === 'forced')) return { on: true, kind: 'forced' };
  if (results.some((r) => r.on)) return { on: true, kind: 'on' };
  if (results.some((r) => r.kind === 'off-override')) return { on: false, kind: 'off-override' };
  return { on: false, kind: 'off' };
}

export function setOverrideAllMedia(
  overrides: DeviceScheduleOverrides,
  campaign: PlayerCampaign,
  dateIso: string,
  key: string | number,
  value: ScheduleOverrideValue | null
): DeviceScheduleOverrides {
  let next = overrides;
  for (const mediaId of campaignMediaIds(campaign)) {
    next = setOverride(next, campaign.id, mediaId, dateIso, key, value);
  }
  return next;
}

export function nextCampaignHourOverride(
  campaign: PlayerCampaign,
  dateIso: string,
  hour: number,
  overrides: DeviceScheduleOverrides
): { value: ScheduleOverrideValue | null; message: string } {
  const mediaId = campaignMediaIds(campaign)[0];
  return nextHourOverride(campaign, mediaId, dateIso, hour, overrides);
}

export function orderCampaigns(
  campaigns: PlayerCampaign[],
  playOrder: string[]
): PlayerCampaign[] {
  const rank = new Map(playOrder.map((k, i) => [k, i]));
  const score = (c: PlayerCampaign) => {
    if (rank.has(c.id)) return rank.get(c.id) as number;
    let best = Number.MAX_SAFE_INTEGER;
    for (const mid of campaignMediaIds(c)) {
      const k = mediaKey(c.id, mid);
      if (rank.has(k)) best = Math.min(best, rank.get(k) as number);
    }
    return best;
  };
  return [...campaigns].sort((a, b) => {
    const d = score(a) - score(b);
    if (d !== 0) return d;
    return String(a.client || a.id).localeCompare(String(b.client || b.id), 'lt');
  });
}

/** Kiek dabartinių kampanijų turi bent vieną playOrder raktą. */
export function playOrderCoverage(
  playOrder: string[],
  campaigns: PlayerCampaign[]
): number {
  if (!playOrder.length || !campaigns.length) return 0;
  const rank = new Set(playOrder);
  let n = 0;
  for (const c of campaigns) {
    if (rank.has(c.id)) {
      n += 1;
      continue;
    }
    if (campaignMediaIds(c).some((mid) => rank.has(mediaKey(c.id, mid)))) n += 1;
  }
  return n;
}

/**
 * Sutapatina playOrder su dabartinėmis kampanijomis.
 * - Išmeta senus ID po republish
 * - Jei nė viena dabartinė kampanija nebedengia — seed pagal Scheduling tvarką (abėcėlė / esama)
 * - Naujas kampanijas (be rakto) prideda gale
 */
export function reconcilePlayOrder(
  playOrder: string[],
  campaigns: PlayerCampaign[]
): string[] {
  if (!campaigns.length) return playOrder;
  const validKeys = new Set(
    campaigns.flatMap((c) => [
      c.id,
      ...campaignMediaIds(c).map((mid) => mediaKey(c.id, mid)),
    ])
  );
  const pruned = playOrder.filter((k) => validKeys.has(k));

  if (playOrderCoverage(pruned, campaigns) === 0) {
    return expandCampaignPlayOrder(orderCampaigns(campaigns, []), []);
  }

  const covered = new Set<string>();
  for (const c of campaigns) {
    if (pruned.includes(c.id)) {
      covered.add(c.id);
      continue;
    }
    if (campaignMediaIds(c).some((mid) => pruned.includes(mediaKey(c.id, mid)))) {
      covered.add(c.id);
    }
  }
  const missing = campaigns.filter((c) => !covered.has(c.id));
  if (!missing.length) return pruned;

  const append = expandCampaignPlayOrder(orderCampaigns(missing, []), []);
  const seen = new Set(pruned);
  return [...pruned, ...append.filter((k) => !seen.has(k))];
}

/** Kampanijų tvarka → media playOrder raktai playeriui. */
export function expandCampaignPlayOrder(
  orderedCampaigns: PlayerCampaign[],
  previous: string[]
): string[] {
  const viewKeys = orderedCampaigns.flatMap((c) =>
    campaignMediaIds(c).map((mid) => mediaKey(c.id, mid))
  );
  return mergePlayOrder(viewKeys, previous);
}

export function orderMediaEntries(
  entries: ScheduleMediaEntry[],
  playOrder: string[]
): ScheduleMediaEntry[] {
  const rank = new Map(playOrder.map((k, i) => [k, i]));
  const withRank: ScheduleMediaEntry[] = [];
  const without: ScheduleMediaEntry[] = [];
  for (const e of entries) {
    if (rank.has(e.key)) withRank.push(e);
    else without.push(e);
  }
  withRank.sort((a, b) => (rank.get(a.key) || 0) - (rank.get(b.key) || 0));
  return [...withRank, ...without];
}

export function movePlayOrderKey(keys: string[], fromKey: string, toKey: string): string[] {
  const next = keys.slice();
  const from = next.indexOf(fromKey);
  if (from < 0) return keys;
  next.splice(from, 1);
  const insertAt = next.indexOf(toKey);
  if (insertAt < 0) return keys;
  next.splice(insertAt, 0, fromKey);
  return next;
}

export function mergePlayOrder(viewKeys: string[], previous: string[]): string[] {
  const seen = new Set(viewKeys);
  return [...viewKeys, ...previous.filter((k) => !seen.has(k))];
}

export function clipsOnHour(
  entries: ScheduleMediaEntry[],
  dateIso: string,
  hour: number,
  overrides: DeviceScheduleOverrides
): number {
  let n = 0;
  for (const { campaign, media } of entries) {
    if (effectiveHour(campaign, media.id, dateIso, hour, overrides).on) n += 1;
  }
  return n;
}

/** Kiek kampanijų užimta tą valandą (ne klipų — rotacija viduje neskaičiuojama). */
export function campaignsOnHour(
  campaigns: PlayerCampaign[],
  dateIso: string,
  hour: number,
  overrides: DeviceScheduleOverrides
): number {
  let n = 0;
  for (const campaign of campaigns) {
    if (effectiveCampaignHour(campaign, dateIso, hour, overrides).on) n += 1;
  }
  return n;
}

export function avgClipsPerHour(
  entries: ScheduleMediaEntry[],
  dateIso: string,
  overrides: DeviceScheduleOverrides
): number {
  const sum = SCHEDULE_HOURS.reduce(
    (s, h) => s + clipsOnHour(entries, dateIso, h, overrides),
    0
  );
  return sum / SCHEDULE_HOURS.length;
}

export function avgCampaignsPerHour(
  campaigns: PlayerCampaign[],
  dateIso: string,
  overrides: DeviceScheduleOverrides
): number {
  const sum = SCHEDULE_HOURS.reduce(
    (s, h) => s + campaignsOnHour(campaigns, dateIso, h, overrides),
    0
  );
  return sum / SCHEDULE_HOURS.length;
}

export function formatAvgClips(n: number): string {
  if (n <= 0) return '—';
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function formatDayTitle(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date
    .toLocaleDateString('lt-LT', { month: 'long', day: 'numeric' })
    .replace(/\s*d\.\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export function formatMonthTitle(viewDate: Date): string {
  return viewDate
    .toLocaleDateString('lt-LT', { month: 'long' })
    .replace(/^./, (c) => c.toUpperCase());
}
