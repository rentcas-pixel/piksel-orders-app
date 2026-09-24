import {
  listOrderClips,
  resolveClipDisplayRange,
  setOrderClipServer,
  type OrderClipRecord,
} from '@/lib/order-clips';
import type { Order } from '@/types';

/** Cloud piksel-api-server (playeriai traukia playlist iš čia). */
const DEFAULT_PLAYER_API = 'https://player.piksel.lt';
const STORAGE_KEY = 'pikselPlayerApiBase';

function isLegacyLocalApi(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes('127.0.0.1') ||
    u.includes('localhost') ||
    /https?:\/\/192\.168\.\d+\.\d+/.test(u) ||
    /https?:\/\/10\.\d+\.\d+\.\d+/.test(u)
  );
}

export function getPlayerApiBase(): string {
  if (typeof window === 'undefined') return DEFAULT_PLAYER_API;
  try {
    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    if (fromStorage?.trim()) {
      const cleaned = fromStorage.trim().replace(/\/$/, '');
      // Senas LAN / localhost — perjungiam į cloud (Windows player jau ten)
      if (isLegacyLocalApi(cleaned)) {
        window.localStorage.setItem(STORAGE_KEY, DEFAULT_PLAYER_API);
        return DEFAULT_PLAYER_API;
      }
      return cleaned;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_PLAYER_API;
}

export function setPlayerApiBase(url: string): string {
  const cleaned = (url || DEFAULT_PLAYER_API).trim().replace(/\/$/, '') || DEFAULT_PLAYER_API;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, cleaned);
    } catch {
      /* ignore */
    }
  }
  return cleaned;
}

export async function pingPlayerApi(base = getPlayerApiBase()): Promise<{
  ok: boolean;
  info?: { devices?: number; campaigns?: number };
  error?: string;
}> {
  try {
    const health = await fetch(`${base}/api/health`, { method: 'GET' });
    if (!health.ok) return { ok: false, error: `API health ${health.status}` };
    const body = await health.json().catch(() => ({}));
    // Teisingas serveris: piksel-api-server ({ ok, devices, campaigns })
    // Neteisingas: lokalus V2 player admin ({ service: 'piksel-player' })
    if (body?.service === 'piksel-player') {
      return {
        ok: false,
        error:
          'Šiuo adresu veikia lokalus Player V2 admin, ne piksel-api-server. Paleisk API Mac’e :8787.',
      };
    }
    if (body?.ok !== true) {
      return { ok: false, error: `API neatsako teisingai (${base})` };
    }
    return {
      ok: true,
      info: {
        devices: Number(body.devices) || 0,
        campaigns: Number(body.campaigns) || 0,
      },
    };
  } catch {
    return {
      ok: false,
      error: `Nepasiekia piksel-api-server (${base}). Mac’e: cd piksel-api-server && npm start`,
    };
  }
}

let cachedPlayerAdminSecret: string | null = null;

/** Raktas lieka play serveryje. Naršyklė jo neįsirašo į puslapio kodą. */
async function playerAdminSecret(): Promise<string> {
  if (typeof window === 'undefined') return '';
  if (cachedPlayerAdminSecret) return cachedPlayerAdminSecret;
  try {
    const response = await fetch('/api/play/player-admin-secret', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!response.ok) return '';
    const body = (await response.json().catch(() => ({}))) as { secret?: string };
    const secret = String(body.secret || '').trim();
    if (secret) cachedPlayerAdminSecret = secret;
    return secret;
  } catch {
    return '';
  }
}

async function withPlayerAdminSecret(
  headers: Record<string, string>
): Promise<Record<string, string>> {
  const secret = await playerAdminSecret();
  if (!secret) return headers;
  return { ...headers, 'x-piksel-secret': secret };
}

function playerLockedMessage(response: Response, fallback: string, result?: { error?: string }): string {
  if (response.status === 401) return 'Grotuvo serveris užrakintas. Live raktas nepriimtas.';
  return result?.error || fallback;
}

export function orderClipMediaId(orderId: string, clipId: string): string {
  return `${orderId}-${clipId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function clipKind(clip: Pick<OrderClipRecord, 'mimeType'>): 'image' | 'video' {
  return clip.mimeType?.startsWith('image/') ? 'image' : 'video';
}

function uploadedFromClip(
  orderId: string,
  clip: OrderClipRecord
): {
  id: string;
  path: string;
  width?: number;
  height?: number;
  kind: string;
  duration?: number;
} | null {
  if (!clip.serverPath) return null;
  const kind = clipKind(clip);
  return {
    id: clip.serverMediaId || orderClipMediaId(orderId, clip.id),
    path: clip.serverPath,
    kind,
    width: clip.width || undefined,
    height: clip.height || undefined,
    duration: kind === 'image' ? 10 : undefined,
  };
}

async function uploadClip(
  base: string,
  orderId: string,
  clip: OrderClipRecord & { blob?: Blob }
): Promise<{
  id: string;
  path: string;
  width?: number;
  height?: number;
  kind: string;
  duration?: number;
  forScreens?: string[];
}> {
  if (!clip.blob) throw new Error(`Klipas be failo: ${clip.filename}`);
  const mediaId = orderClipMediaId(orderId, clip.id);
  const response = await fetch(`${base}/api/admin/media/${encodeURIComponent(mediaId)}`, {
    method: 'PUT',
    headers: await withPlayerAdminSecret({
      'content-type': clip.mimeType || 'application/octet-stream',
      'x-file-name': encodeURIComponent(clip.filename),
    }),
    body: clip.blob,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(playerLockedMessage(response, `Nepavyko įkelti ${clip.filename}`, result));
  }
  const kind = clipKind(clip);
  const uploaded = {
    id: mediaId,
    path: String(result.path || ''),
    kind,
    width: clip.width || undefined,
    height: clip.height || undefined,
    duration: kind === 'image' ? 10 : undefined,
  };
  await setOrderClipServer(clip.id, { mediaId: uploaded.id, path: uploaded.path });
  return uploaded;
}

/** Įkelia failą į player.piksel.lt iškart (ne per Live). */
export async function pushClipToPlayer(
  orderId: string,
  clip: OrderClipRecord & { blob?: Blob }
): Promise<{ id: string; path: string }> {
  const existing = uploadedFromClip(orderId, clip);
  if (existing) return existing;
  const uploaded = await uploadClip(getPlayerApiBase(), orderId, clip);
  return { id: uploaded.id, path: uploaded.path };
}

/** Publikuoti kampaniją į piksel-api-server — Windows playeriai patys pasiima playlist. */
export async function publishOrderToPlayer(
  order: Order,
  screenNames: string[],
  options?: {
    clipIds?: string[];
    /** clipId → ekranų vardai (rezoliucija + tipas) */
    clipScreenMap?: Record<string, string[]>;
  }
): Promise<{
  base: string;
  playerScreen?: string;
  itemCount: number;
  received: boolean;
  onlineDevices?: string[];
}> {
  const base = getPlayerApiBase();

  const allClips = await listOrderClips(order.id);
  const allowed = options?.clipIds?.length
    ? new Set(options.clipIds.map(String))
    : null;
  const clips = allowed
    ? allClips.filter((clip) => allowed.has(String(clip.id)))
    : allClips;
  if (!clips.length) throw new Error('Nėra tinkamos rezoliucijos klipų siuntimui');
  if (!screenNames.length) throw new Error('Nėra ekranų, kuriems tinka įkelti klipai');

  const media = await Promise.all(
    clips.map(async (clip) => {
      const uploaded =
        uploadedFromClip(order.id, clip) || (await uploadClip(base, order.id, clip));
      const forScreens = options?.clipScreenMap?.[clip.id];
      const range = resolveClipDisplayRange(clip, order);
      return {
        ...uploaded,
        ...(forScreens?.length ? { forScreens } : {}),
        ...(range.from ? { from: range.from } : {}),
        ...(range.to ? { to: range.to } : {}),
      };
    })
  );

  const clockOverlay = order.details?.clockOverlay?.enabled === true;
  const viaduct = order.viaduct === true;
  const viaductFrequency =
    Number(order.viaduct_frequency) ||
    Number(order.details?.plan?.viaductFrequency) ||
    1;

  const response = await fetch(`${base}/api/admin/campaigns/publish`, {
    method: 'POST',
    headers: await withPlayerAdminSecret({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      id: order.id,
      client: order.client,
      from: order.from,
      to: order.to,
      clipDuration: order.details?.plan?.clip_duration || order.clip_duration || 10,
      grid: order.details?.plan?.grid || order.grid,
      screens: screenNames,
      media: media.map((item) => ({ ...item, clockOverlay })),
      clockOverlay,
      viaduct,
      viaductFrequency: viaduct ? viaductFrequency : 1,
      mode: viaduct ? 'viaducts' : 'screens',
      replaceAll: false,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(playerLockedMessage(response, 'API nepriėmė kampanijos', result));
  }

  return {
    base,
    playerScreen: screenNames[0],
    itemCount: media.length,
    received: true,
    onlineDevices: [],
  };
}

export async function unpublishOrderFromPlayer(orderId?: string): Promise<void> {
  const base = getPlayerApiBase();
  if (!orderId) return;
  let response: Response;
  try {
    response = await fetch(`${base}/api/admin/campaigns/unpublish`, {
      method: 'POST',
      headers: await withPlayerAdminSecret({ 'content-type': 'application/json' }),
      body: JSON.stringify({ id: orderId }),
    });
  } catch {
    throw new Error(`Nepavyko susisiekti su player API (${base})`);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(
      playerLockedMessage(response, `API nepriėmė atšaukimo (${response.status})`, result)
    );
  }
}
