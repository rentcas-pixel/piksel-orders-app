import { getPlayerApiBase, playerAdminCallError, withPlayerAdminSecret } from '@/lib/player-bridge';

export type PlayerDevice = {
  id?: string;
  deviceCode: string;
  screenName: string;
  width: number;
  height: number;
  account?: string;
  lastSeenAt?: string;
  computerName?: string | null;
  /** Windows player shell, from heartbeat. Missing on old players. */
  shellVersion?: string | null;
  kioskUser?: string | null;
  kioskPassword?: string | null;
  kioskPasswordAt?: string | null;
};

/** Heartbeat version, or a dash when the player did not send one. */
export function formatDeviceShellVersion(value: string | null | undefined): string {
  const version = String(value ?? '').trim();
  return version || '—';
}

export type PlayerCampaignMedia = {
  id: string;
  path: string;
  kind?: string;
  duration?: number;
  width?: number | null;
  height?: number | null;
  forScreens?: string[];
  from?: string;
  to?: string;
};

export type PlayerCampaign = {
  id: string;
  client?: string;
  from?: string;
  to?: string;
  grid?: boolean[][];
  clipDuration?: number;
  screens?: string[];
  media?: PlayerCampaignMedia[];
  published?: boolean;
  publishedAt?: string;
  clockOverlay?: boolean;
  viaduct?: boolean;
  viaductFrequency?: number;
};

export type ScreenOrderToday = {
  orderId: string;
  client: string;
  from?: string;
  to?: string;
  clipCount: number;
  hoursToday: number[];
  activeNow: boolean;
  publishedAt?: string;
};

const ONLINE_MS = 60_000;

export function normalizePlayerScreenName(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('lt-LT');
}

function normalizeScreen(value: string | null | undefined): string {
  return normalizePlayerScreenName(value);
}

function localDateStr(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Mon=0 … Sun=6 — kaip API serveris. */
function gridDayIndex(now = new Date()): number {
  const jsDay = now.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function hoursOnToday(campaign: PlayerCampaign, now = new Date()): number[] {
  const grid = campaign.grid;
  if (!Array.isArray(grid) || grid.length !== 7) {
    return Array.from({ length: 17 }, (_, i) => 6 + i);
  }
  const day = gridDayIndex(now);
  const row = grid[day] || [];
  const hours: number[] = [];
  for (let i = 0; i < 17; i += 1) {
    if (row[i]) hours.push(6 + i);
  }
  return hours;
}

function isActiveNow(campaign: PlayerCampaign, now = new Date()): boolean {
  const date = localDateStr(now);
  if (campaign.from && date < campaign.from) return false;
  if (campaign.to && date > campaign.to) return false;
  const hourIndex = now.getHours() - 6;
  if (!Array.isArray(campaign.grid) || campaign.grid.length !== 7) return true;
  if (hourIndex < 0 || hourIndex > 16) return false;
  return Boolean(campaign.grid[gridDayIndex(now)]?.[hourIndex]);
}

function isScheduledToday(campaign: PlayerCampaign, now = new Date()): boolean {
  const date = localDateStr(now);
  if (campaign.from && date < campaign.from) return false;
  if (campaign.to && date > campaign.to) return false;
  return hoursOnToday(campaign, now).length > 0;
}

export function isDeviceOnline(device: PlayerDevice, now = Date.now()): boolean {
  if (!device.lastSeenAt) return false;
  const seen = Date.parse(device.lastSeenAt);
  if (!Number.isFinite(seen)) return false;
  return now - seen <= ONLINE_MS;
}

export type ScreenPlayerStatus = 'online' | 'offline' | 'missing';

export function findPlayerDeviceForScreen(
  devices: PlayerDevice[],
  screenName: string
): PlayerDevice | undefined {
  const key = normalizeScreen(screenName);
  if (!key) return undefined;
  return devices.find((device) => normalizeScreen(device.screenName) === key);
}

export function screenPlayerStatus(
  devices: PlayerDevice[],
  screenName: string,
  now = Date.now()
): ScreenPlayerStatus {
  const device = findPlayerDeviceForScreen(devices, screenName);
  if (!device) return 'missing';
  return isDeviceOnline(device, now) ? 'online' : 'offline';
}

/** Live orderiai (kampanijos), kurie šiandien rodomi šiame ekrane. */
export function ordersForScreenToday(
  campaigns: PlayerCampaign[],
  screenName: string,
  opts?: { now?: Date }
): ScreenOrderToday[] {
  const now = opts?.now || new Date();
  const screen = normalizeScreen(screenName);
  const out: ScreenOrderToday[] = [];

  for (const campaign of campaigns) {
    if (campaign.published === false) continue;
    if (!(campaign.screens || []).some((name) => normalizeScreen(name) === screen)) continue;
    if (!isScheduledToday(campaign, now)) continue;

    out.push({
      orderId: campaign.id,
      client: campaign.client || campaign.id,
      from: campaign.from,
      to: campaign.to,
      clipCount: (campaign.media || []).length,
      hoursToday: hoursOnToday(campaign, now),
      activeNow: isActiveNow(campaign, now),
      publishedAt: campaign.publishedAt,
    });
  }

  out.sort((a, b) => {
    if (a.activeNow !== b.activeNow) return a.activeNow ? -1 : 1;
    const ta = Date.parse(a.publishedAt || '') || 0;
    const tb = Date.parse(b.publishedAt || '') || 0;
    if (ta !== tb) return ta - tb;
    return a.client.localeCompare(b.client, 'lt');
  });

  return out;
}

export function formatHoursCompact(hours: number[]): string {
  if (!hours.length) return '—';
  if (hours.length >= 17) return '6–22';
  const ranges: string[] = [];
  let start = hours[0];
  let prev = hours[0];
  for (let i = 1; i <= hours.length; i += 1) {
    const h = hours[i];
    if (h === prev + 1) {
      prev = h;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = h;
    prev = h;
  }
  return ranges.join(', ') + ' h';
}

const PLAYER_FETCH_TIMEOUT_MS = 8000;

type AdminStateResult = {
  ok: boolean;
  devices: PlayerDevice[];
  campaigns: PlayerCampaign[];
  error?: string;
};

let adminStateInflight: Promise<AdminStateResult> | null = null;

export async function fetchAdminState(): Promise<AdminStateResult> {
  if (adminStateInflight) return adminStateInflight;
  const base = getPlayerApiBase();
  adminStateInflight = (async () => {
    try {
      const res = await fetch(`${base}/api/admin/state?light=1`, {
        method: 'GET',
        headers: await withPlayerAdminSecret(),
        signal: AbortSignal.timeout(PLAYER_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        return {
          ok: false,
          devices: [],
          campaigns: [],
          error: playerAdminCallError(res.status, `API ${res.status}`),
        };
      }
      const body = await res.json();
      const devices = Array.isArray(body?.devices) ? (body.devices as PlayerDevice[]) : [];
      const campaigns = Array.isArray(body?.campaigns)
        ? (body.campaigns as PlayerCampaign[])
        : [];
      return { ok: true, devices, campaigns };
    } catch {
      return {
        ok: false,
        devices: [],
        campaigns: [],
        error: `Nepasiekia piksel-api-server (${base})`,
      };
    } finally {
      adminStateInflight = null;
    }
  })();
  return adminStateInflight;
}

export async function listDevices(): Promise<{
  ok: boolean;
  devices: PlayerDevice[];
  error?: string;
}> {
  const result = await fetchAdminState();
  return { ok: result.ok, devices: result.devices, error: result.error };
}

export async function updateDevice(input: {
  deviceCode: string;
  screenName?: string;
  width?: number;
  height?: number;
}): Promise<{ ok: boolean; device?: PlayerDevice; error?: string }> {
  const base = getPlayerApiBase();
  try {
    const res = await fetch(`${base}/api/admin/devices/update`, {
      method: 'POST',
      headers: await withPlayerAdminSecret({ 'content-type': 'application/json' }),
      body: JSON.stringify(input),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: playerAdminCallError(res.status, `API ${res.status}`, body) };
    return { ok: true, device: body.device };
  } catch {
    return { ok: false, error: `Nepasiekia API (${base})` };
  }
}

export async function deleteDevice(
  deviceCode: string
): Promise<{ ok: boolean; error?: string }> {
  const base = getPlayerApiBase();
  try {
    const res = await fetch(`${base}/api/admin/devices/delete`, {
      method: 'POST',
      headers: await withPlayerAdminSecret({ 'content-type': 'application/json' }),
      body: JSON.stringify({ deviceCode }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: playerAdminCallError(res.status, `API ${res.status}`, body) };
    return { ok: true };
  } catch {
    return { ok: false, error: `Nepasiekia API (${base})` };
  }
}

/** Nuotolinis player restart — playeris pasiima per heartbeat (~30 s). */
export async function requestDeviceRelaunch(
  deviceCode: string
): Promise<{ ok: boolean; error?: string; note?: string }> {
  const base = getPlayerApiBase();
  try {
    const res = await fetch(`${base}/api/admin/devices/command`, {
      method: 'POST',
      headers: await withPlayerAdminSecret({ 'content-type': 'application/json' }),
      body: JSON.stringify({ deviceCode, action: 'relaunch' }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: playerAdminCallError(res.status, `API ${res.status}`, body) };
    return {
      ok: true,
      note: typeof body.note === 'string' ? body.note : undefined,
    };
  } catch {
    return { ok: false, error: `Nepasiekia API (${base})` };
  }
}

export type DeviceSchedulePayload = {
  overrides: Record<
    string,
    Record<string, Record<string, Record<string, 'on' | 'off'>>>
  >;
  playOrder: string[];
};

export async function fetchDeviceSchedule(
  deviceCode: string
): Promise<{ ok: boolean; schedule?: DeviceSchedulePayload; error?: string }> {
  const base = getPlayerApiBase();
  try {
    const res = await fetch(
      `${base}/api/admin/devices/schedule?deviceCode=${encodeURIComponent(deviceCode)}`,
      { method: 'GET', headers: await withPlayerAdminSecret() }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: playerAdminCallError(res.status, `API ${res.status}`, body) };
    return {
      ok: true,
      schedule: {
        overrides: body.overrides && typeof body.overrides === 'object' ? body.overrides : {},
        playOrder: Array.isArray(body.playOrder) ? body.playOrder.map(String) : [],
      },
    };
  } catch {
    return { ok: false, error: `Nepasiekia API (${base})` };
  }
}

export async function saveDeviceSchedule(
  deviceCode: string,
  schedule: DeviceSchedulePayload
): Promise<{ ok: boolean; error?: string }> {
  const base = getPlayerApiBase();
  try {
    const res = await fetch(`${base}/api/admin/devices/schedule`, {
      method: 'POST',
      headers: await withPlayerAdminSecret({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        deviceCode,
        overrides: schedule.overrides,
        playOrder: schedule.playOrder,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: playerAdminCallError(res.status, `API ${res.status}`, body) };
    return { ok: true };
  } catch {
    return { ok: false, error: `Nepasiekia API (${base})` };
  }
}

export type MonitorStatus = 'online' | 'warning' | 'offline';

export type MonitorNowPlaying = {
  id: string;
  campaignId?: string;
  campaign?: string;
  kind?: string;
  duration?: number;
  width?: number | null;
  height?: number | null;
  url?: string;
};

export type MonitorIncident = {
  id: string;
  deviceCode: string;
  screenName: string;
  type: string;
  detail?: string | null;
  openedAt: string;
  closedAt?: string | null;
  notifiedAt?: string | null;
};

export type MonitorScreen = {
  device: PlayerDevice;
  status: MonitorStatus;
  ageMs: number | null;
  playlistCount: number;
  campaignCount: number;
  campaigns: string[];
  /** Pirma kiekvienos kampanijos pozicija playliste (rotacijos tvarka). */
  rotation?: MonitorNowPlaying[];
  nowPlaying: MonitorNowPlaying | null;
  reportedNowPlaying?: MonitorNowPlaying | null;
  stuck?: boolean;
  stuckReason?: string | null;
  screenshotUrl?: string | null;
  screenshotAt?: string | null;
  lastHeartbeatAt?: string | null;
  previewUrl: string | null;
  openIncidents?: MonitorIncident[];
};

export type MonitoringSnapshot = {
  syncedAt: string;
  counts: { all: number; online: number; warning: number; offline: number };
  screens: MonitorScreen[];
  incidents?: MonitorIncident[];
  alertSettings?: {
    enabled: boolean;
    hasWebhook: boolean;
    offlineAfterMs: number;
  };
};

type MonitoringResult = {
  ok: boolean;
  data?: MonitoringSnapshot;
  error?: string;
};

let monitoringInflight: Promise<MonitoringResult> | null = null;

export async function fetchMonitoring(): Promise<MonitoringResult> {
  if (monitoringInflight) return monitoringInflight;
  const base = getPlayerApiBase();
  monitoringInflight = (async () => {
    try {
      const res = await fetch(`${base}/api/admin/monitoring`, {
        method: 'GET',
        headers: await withPlayerAdminSecret(),
        signal: AbortSignal.timeout(PLAYER_FETCH_TIMEOUT_MS),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: playerAdminCallError(res.status, `API ${res.status}`, body) };
      }
      return {
        ok: true,
        data: {
          syncedAt: String(body.syncedAt || new Date().toISOString()),
          counts: {
            all: Number(body.counts?.all) || 0,
            online: Number(body.counts?.online) || 0,
            warning: Number(body.counts?.warning) || 0,
            offline: Number(body.counts?.offline) || 0,
          },
          screens: Array.isArray(body.screens) ? (body.screens as MonitorScreen[]) : [],
          incidents: Array.isArray(body.incidents)
            ? (body.incidents as MonitorIncident[])
            : [],
          alertSettings: body.alertSettings,
        },
      };
    } catch {
      return { ok: false, error: `Nepasiekia API (${base})` };
    } finally {
      monitoringInflight = null;
    }
  })();
  return monitoringInflight;
}

export type CampaignPlayEvent = {
  at: string;
  mediaId?: string;
};

export type CampaignScreenPlays = {
  total: number;
  byDay: Record<string, number>;
  /** mediaId → parodymai (kai playeris skaičiuoja per klipą) */
  byMedia?: Record<string, number>;
  /** mediaId → pirmas play ISO (kai playeris skaičiuoja per klipą) */
  byMediaFirstPlayAt?: Record<string, string>;
  firstPlayAt?: string | null;
  lastPlayAt?: string | null;
  /** Visi play laikai šiame ekrane (chronologija) */
  events?: CampaignPlayEvent[];
};

export type CampaignPlaysSnapshot = {
  campaignId: string;
  /** normalized screenName → counts */
  screens: Record<string, CampaignScreenPlays>;
  /** registered player screen names (normalized) */
  liveScreens: string[];
};

export async function fetchCampaignPlays(campaignId: string): Promise<{
  ok: boolean;
  data?: CampaignPlaysSnapshot;
  error?: string;
}> {
  const base = getPlayerApiBase();
  const id = String(campaignId || '').trim();
  if (!id) return { ok: false, error: 'Trūksta campaignId' };
  try {
    const res = await fetch(
      `${base}/api/admin/plays?campaignId=${encodeURIComponent(id)}`,
      { method: 'GET', headers: await withPlayerAdminSecret() }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: playerAdminCallError(res.status, `API ${res.status}`, body) };
    }
    const screensRaw =
      body.screens && typeof body.screens === 'object' ? body.screens : {};
    const screens: Record<string, CampaignScreenPlays> = {};
    for (const [key, value] of Object.entries(screensRaw as Record<string, unknown>)) {
      const entry = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      const byMediaRaw =
        entry.byMedia && typeof entry.byMedia === 'object'
          ? (entry.byMedia as Record<string, unknown>)
          : {};
      const byMedia: Record<string, number> = {};
      for (const [mediaId, count] of Object.entries(byMediaRaw)) {
        const n = Number(count) || 0;
        if (n > 0) byMedia[mediaId] = n;
      }
      const firstPlayRaw =
        entry.byMediaFirstPlayAt && typeof entry.byMediaFirstPlayAt === 'object'
          ? (entry.byMediaFirstPlayAt as Record<string, unknown>)
          : {};
      const byMediaFirstPlayAt: Record<string, string> = {};
      for (const [mediaId, at] of Object.entries(firstPlayRaw)) {
        const iso = String(at || '').trim();
        if (iso) byMediaFirstPlayAt[mediaId] = iso;
      }
      const eventsRaw = Array.isArray(entry.events) ? entry.events : [];
      const events: CampaignPlayEvent[] = [];
      for (const raw of eventsRaw) {
        if (!raw || typeof raw !== 'object') continue;
        const ev = raw as Record<string, unknown>;
        const at = String(ev.at || '').trim();
        if (!at) continue;
        const mediaId = String(ev.mediaId || '').trim();
        events.push(mediaId ? { at, mediaId } : { at });
      }
      const screenKey = String(key || '')
        .trim()
        .toLocaleLowerCase('lt-LT');
      if (!screenKey) continue;
      screens[screenKey] = {
        total: Number(entry.total) || 0,
        byDay:
          entry.byDay && typeof entry.byDay === 'object'
            ? (entry.byDay as Record<string, number>)
            : {},
        ...(Object.keys(byMedia).length ? { byMedia } : {}),
        ...(Object.keys(byMediaFirstPlayAt).length
          ? { byMediaFirstPlayAt }
          : {}),
        firstPlayAt: entry.firstPlayAt ? String(entry.firstPlayAt) : null,
        lastPlayAt: entry.lastPlayAt ? String(entry.lastPlayAt) : null,
        ...(events.length ? { events } : {}),
      };
    }
    return {
      ok: true,
      data: {
        campaignId: String(body.campaignId || id),
        screens,
        liveScreens: Array.isArray(body.liveScreens)
          ? body.liveScreens.map((s: unknown) => String(s))
          : [],
      },
    };
  } catch {
    return { ok: false, error: `Nepasiekia API (${base})` };
  }
}
