import {
  clipHasCustomDisplayScreens,
  type OrderClipRecord,
} from '@/lib/order-clips';
import {
  normalizeScreenKey,
  orderClipMediaId,
} from '@/lib/post-campaign-report';
import type {
  CampaignScreenPlays,
  PlayerCampaign,
  PlayerCampaignMedia,
} from '@/lib/player-devices';

export type DeviceOrderTimelineKind =
  | 'upload'
  | 'publish'
  | 'play'
  | 'first_play'
  | 'last_play';

export type DeviceOrderTimelineEvent = {
  id: string;
  at: string;
  kind: DeviceOrderTimelineKind;
  label: string;
  detail?: string;
  mediaId?: string;
};

export type BuildDeviceOrderTimelineInput = {
  screenName: string;
  campaign: Pick<
    PlayerCampaign,
    'id' | 'client' | 'published' | 'publishedAt' | 'screens' | 'media'
  >;
  /** PocketBase / test order live.publishedAt (jei yra) */
  orderPublishedAt?: string | null;
  clips?: Array<
    Pick<
      OrderClipRecord,
      'id' | 'filename' | 'createdAt' | 'displayScreenNames'
    >
  >;
  screenPlays?: CampaignScreenPlays | null;
};

function mediaLabel(
  mediaId: string,
  mediaLabels: Record<string, string>,
  mediaList: PlayerCampaignMedia[] | undefined
): string {
  const fromMap = mediaLabels[mediaId];
  if (fromMap) return fromMap;
  const fromCampaign = (mediaList || []).find((m) => m.id === mediaId);
  if (fromCampaign?.path) {
    const base = String(fromCampaign.path).split(/[/\\]/).pop();
    if (base) return base;
  }
  if (mediaId.length <= 28) return mediaId || 'Klipas';
  return `…${mediaId.slice(-24)}`;
}

function clipTargetsScreen(
  clip: Pick<OrderClipRecord, 'displayScreenNames'>,
  screenKey: string
): boolean {
  if (!clipHasCustomDisplayScreens(clip)) return true;
  return (clip.displayScreenNames || []).some(
    (name) => normalizeScreenKey(name) === screenKey
  );
}

function campaignTargetsScreen(
  campaign: Pick<PlayerCampaign, 'screens'>,
  screenKey: string
): boolean {
  const screens = campaign.screens;
  if (!Array.isArray(screens) || screens.length === 0) return true;
  return screens.some((name) => normalizeScreenKey(name) === screenKey);
}

/** Formatas: 2026-07-28 11:52:05 (Europe/Vilnius) */
export function formatTimelineTimestamp(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return String(iso || '').trim() || '—';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Vilnius',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export function buildDeviceOrderTimeline(
  input: BuildDeviceOrderTimelineInput
): DeviceOrderTimelineEvent[] {
  const screenKey = normalizeScreenKey(input.screenName);
  if (!screenKey) return [];

  const events: DeviceOrderTimelineEvent[] = [];
  const campaignId = String(input.campaign.id || '').trim();
  const mediaLabels: Record<string, string> = {};
  for (const clip of input.clips || []) {
    const mediaId = orderClipMediaId(campaignId, clip.id);
    const name = String(clip.filename || '').trim();
    if (mediaId && name) mediaLabels[mediaId] = name;
  }

  for (const clip of input.clips || []) {
    if (!clipTargetsScreen(clip, screenKey)) continue;
    const at = String(clip.createdAt || '').trim();
    if (!at) continue;
    const name = String(clip.filename || '').trim() || clip.id;
    events.push({
      id: `upload:${clip.id}`,
      at,
      kind: 'upload',
      label: 'Įkeltas',
      detail: name,
      mediaId: orderClipMediaId(campaignId, clip.id),
    });
  }

  const publishedAt =
    String(input.orderPublishedAt || '').trim() ||
    String(input.campaign.publishedAt || '').trim();
  if (
    publishedAt &&
    input.campaign.published !== false &&
    campaignTargetsScreen(input.campaign, screenKey)
  ) {
    const clipCount = (input.campaign.media || []).length;
    events.push({
      id: `publish:${campaignId}:${publishedAt}`,
      at: publishedAt,
      kind: 'publish',
      label: 'Live ON',
      detail:
        clipCount > 0
          ? `${clipCount} ${clipCount === 1 ? 'klipas' : 'klipai'} → ${input.screenName}`
          : input.screenName,
    });
  }

  const plays = input.screenPlays;
  const playLog = plays?.events || [];
  if (playLog.length > 0) {
    playLog.forEach((ev, index) => {
      const at = String(ev.at || '').trim();
      if (!at) return;
      const mediaId = String(ev.mediaId || '').trim();
      events.push({
        id: `play:${index}:${at}:${mediaId || '-'}`,
        at,
        kind: 'play',
        label: 'Pasirodė',
        detail: mediaId
          ? mediaLabel(mediaId, mediaLabels, input.campaign.media)
          : input.screenName,
        ...(mediaId ? { mediaId } : {}),
      });
    });
  } else {
    // Seniems duomenims be events[] — fallback į first / last
    const firstByMedia = plays?.byMediaFirstPlayAt || {};
    const firstMediaIds = Object.keys(firstByMedia);
    if (firstMediaIds.length > 0) {
      for (const mediaId of firstMediaIds) {
        const at = String(firstByMedia[mediaId] || '').trim();
        if (!at) continue;
        events.push({
          id: `first_play:${mediaId}`,
          at,
          kind: 'first_play',
          label: 'Pirmas play',
          detail: mediaLabel(mediaId, mediaLabels, input.campaign.media),
          mediaId,
        });
      }
    } else if (plays?.firstPlayAt) {
      events.push({
        id: `first_play:screen`,
        at: String(plays.firstPlayAt),
        kind: 'first_play',
        label: 'Pirmas play',
        detail: input.screenName,
      });
    } else if (plays?.lastPlayAt) {
      events.push({
        id: `last_play:screen`,
        at: String(plays.lastPlayAt),
        kind: 'last_play',
        label: 'Paskutinis play',
        detail: input.screenName,
      });
    }
  }

  return events.sort((a, b) => {
    const ta = Date.parse(a.at) || 0;
    const tb = Date.parse(b.at) || 0;
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

/** Excel eilutės: Laikas | Įvykis | Detalė | Ekranas | Device | Order */
export function buildDeviceOrderTimelineExcelRows(input: {
  events: DeviceOrderTimelineEvent[];
  screenName: string;
  deviceCode: string;
  campaignId: string;
  client?: string | null;
}): unknown[][] {
  const header = [
    'Laikas',
    'Įvykis',
    'Detalė',
    'Ekranas',
    'Device',
    'Order ID',
    'Klientas',
  ];
  const client = String(input.client || '').trim();
  const rows = input.events.map((event) => [
    formatTimelineTimestamp(event.at),
    event.label,
    event.detail || '',
    input.screenName,
    input.deviceCode,
    input.campaignId,
    client,
  ]);
  return [header, ...rows];
}

export function deviceOrderTimelineExportFilename(input: {
  screenName: string;
  deviceCode: string;
  campaignId: string;
  client?: string | null;
}): string {
  const safe = (value: string) =>
    String(value || '')
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'x';
  const client = safe(String(input.client || '').trim());
  const screen = safe(input.screenName);
  const device = safe(input.deviceCode);
  const order = safe(input.campaignId);
  const parts = ['Isklotine', screen, device, client || order].filter(Boolean);
  return parts.join('_');
}
