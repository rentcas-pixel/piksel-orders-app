import {
  collectRequiredResolutions,
  evaluateMediaResolutions,
  formatResolution,
  parseResolution,
  readFileResolution,
  resolutionKey,
  type RequiredResolution,
} from '@/lib/media-resolution-check';
import { PocketBaseService } from '@/lib/pocketbase';
import { supabase } from '@/lib/supabase';
import { isTestOrder } from '@/lib/test-orders';
import type { Order } from '@/types';

const DB_NAME = 'piksel-order-clips';
const DB_VERSION = 1;
const STORE = 'clips';
const PLAYER_MEDIA_ORIGIN = 'https://player.piksel.lt';

/** Kur operatorius įkėlė klipą — ne failo mime. */
export type ClipUploadKind = 'static' | 'video';

export type ScreenMediaKind = ClipUploadKind | 'unknown';

export type OrderClipScreen = {
  id?: string;
  name: string;
  city?: string;
  resolution?: string | null;
  owner?: string | null;
  partnerName?: string | null;
  /** Skaičiuoklė: Statinis | Video */
  type?: string | null;
};

export type OrderClipRecord = {
  id: string;
  orderId: string;
  filename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  resolutionKey: string | null;
  resolutionLabel: string | null;
  /** Video zona vs Statinis zona */
  uploadKind: ClipUploadKind;
  createdAt: string;
  /** Optional override — jei nėra, Live naudoja order.from / order.to */
  displayFrom?: string;
  displayTo?: string;
  /**
   * Optional override — kuriems plano ekranams rodyti (tik match’inantys).
   * Jei nėra — visi auto-match’inti pagal rezoliuciją/tipą.
   */
  displayScreenNames?: string[];
  /** Po įkėlimo į player.piksel.lt — Live tik playlist, be pakartotinio upload. */
  serverPath?: string;
  serverMediaId?: string;
  blob?: Blob;
  previewUrl?: string;
};

export type ClipDisplayRange = {
  from: string;
  to: string;
};

/** Efektyvus klipo rodymo langas (override arba kampanijos periodas). */
export function resolveClipDisplayRange(
  clip: Pick<OrderClipRecord, 'displayFrom' | 'displayTo'>,
  order: { from?: string | null; to?: string | null }
): ClipDisplayRange {
  return {
    from: String(clip.displayFrom || order.from || '').trim(),
    to: String(clip.displayTo || order.to || '').trim(),
  };
}

export function clipHasCustomDisplayRange(
  clip: Pick<OrderClipRecord, 'displayFrom' | 'displayTo'>
): boolean {
  return Boolean(
    String(clip.displayFrom || '').trim() || String(clip.displayTo || '').trim()
  );
}

export function clipHasCustomDisplayScreens(
  clip: Pick<OrderClipRecord, 'displayScreenNames'>
): boolean {
  return Array.isArray(clip.displayScreenNames) && clip.displayScreenNames.length > 0;
}

/** Ar klipas turi custom datas ir/ar ekranus. */
export function clipHasCustomSchedule(
  clip: Pick<OrderClipRecord, 'displayFrom' | 'displayTo' | 'displayScreenNames'>
): boolean {
  return clipHasCustomDisplayRange(clip) || clipHasCustomDisplayScreens(clip);
}

export function clipRemotePreviewUrl(
  clip: Pick<OrderClipRecord, 'serverPath'>
): string | undefined {
  const path = String(clip.serverPath || '').trim();
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${PLAYER_MEDIA_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Plano ekranai, kuriems šis klipas tinka (rezoliucija + tipas). */
export function compatibleScreensForClip(
  clip: Pick<OrderClipRecord, 'resolutionKey' | 'uploadKind' | 'mimeType'>,
  screens: OrderClipScreen[]
): OrderClipScreen[] {
  const clipKind = resolveClipUploadKind(clip);
  if (!clip.resolutionKey) return [];
  const out: OrderClipScreen[] = [];
  const seen = new Set<string>();
  for (const screen of screens) {
    const size = parseResolution(screen.resolution);
    if (!size) continue;
    if (resolutionKey(size) !== clip.resolutionKey) continue;
    if (!clipFitsScreen(clipKind, screenMediaKind(screen))) continue;
    const name = String(screen.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(screen);
  }
  return out;
}

/** Efektyvūs ekranai: override ∩ auto-match, arba visi auto-match. */
export function resolveClipDisplayScreens(
  clip: Pick<OrderClipRecord, 'displayScreenNames'>,
  matchedScreenNames: string[]
): string[] {
  if (!clipHasCustomDisplayScreens(clip)) return matchedScreenNames;
  const wanted = new Set(
    (clip.displayScreenNames || []).map((n) => String(n || '').trim().toLowerCase()).filter(Boolean)
  );
  return matchedScreenNames.filter((n) => wanted.has(String(n).trim().toLowerCase()));
}

/** Trumpas hintas UI: 03-01–03-07 (mm-dd) */
export function formatClipDisplayRangeHint(range: ClipDisplayRange): string {
  const fmt = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return `${m[2]}-${m[3]}`;
  };
  if (!range.from && !range.to) return '';
  if (range.from && range.to) return `${fmt(range.from)}–${fmt(range.to)}`;
  return fmt(range.from || range.to);
}

export function isPikselOwnedScreen(screen: OrderClipScreen): boolean {
  const owner = String(screen.owner || screen.partnerName || '').trim().toLowerCase();
  if (!owner) return true;
  return owner === 'piksel' || owner.includes('piksel');
}

export function pikselScreensOnly(screens: OrderClipScreen[]): OrderClipScreen[] {
  return screens.filter(isPikselOwnedScreen);
}

export function screenMediaKind(screen: {
  type?: string | null;
}): ScreenMediaKind {
  const t = String(screen.type || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (
    t.includes('statin') ||
    t.includes('viaduk') ||
    t === 'static' ||
    t === 'image' ||
    t === 'jpg'
  ) {
    return 'static';
  }
  // Kataloge video = Horizontalus / Vertikalus (orientacija), skaičiuoklėje = Video.
  if (
    t.includes('video') ||
    t.includes('horizontal') ||
    t.includes('vertikal') ||
    t.includes('vertical') ||
    t === 'moving' ||
    t === 'mp4'
  ) {
    return 'video';
  }
  return 'unknown';
}

export function canonicalClipScreenType(raw: string | null | undefined): string | null {
  const kind = screenMediaKind({ type: raw });
  if (kind === 'static') return 'Statinis';
  if (kind === 'video') return 'Video';
  return String(raw || '').trim() || null;
}

export function screenMediaKindLabel(kind: ScreenMediaKind): string {
  if (kind === 'static') return 'statinis';
  if (kind === 'video') return 'video';
  return 'nežinomas';
}

export function resolveClipUploadKind(
  clip: Pick<OrderClipRecord, 'uploadKind' | 'mimeType'> &
    Partial<Pick<OrderClipRecord, 'filename'>>
): ClipUploadKind {
  if (clip.uploadKind === 'static' || clip.uploadKind === 'video') {
    return clip.uploadKind;
  }
  const mime = String(clip.mimeType || '').toLowerCase();
  const name = String(clip.filename || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(name)) {
    return 'static';
  }
  return 'video';
}

export function clipFitsScreen(
  clipKind: ClipUploadKind,
  screenKind: ScreenMediaKind
): boolean {
  if (screenKind === 'unknown') return true;
  return clipKind === screenKind;
}

function normalizeName(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export type ClipCatalogRow = {
  id: string;
  name?: string;
  city?: string;
  resolution?: string;
  owner?: string;
  type?: string;
};

function screenNameKeys(name: string | null | undefined, city?: string | null): string[] {
  const n = normalizeName(name);
  const keys = new Set<string>();
  if (n) keys.add(n);
  const c = normalizeName(city);
  if (c && n.endsWith(` ${c}`)) keys.add(n.slice(0, n.length - c.length - 1).trim());
  if (c && n.startsWith(`${c} `)) keys.add(n.slice(c.length + 1).trim());
  return [...keys].filter(Boolean);
}

export function findCatalogMatch(
  screen: Pick<OrderClipScreen, 'id' | 'name' | 'city'>,
  catalog: ClipCatalogRow[]
): ClipCatalogRow | undefined {
  if (screen.id) {
    const byId = catalog.find((row) => String(row.id) === String(screen.id));
    if (byId) return byId;
  }

  const keys = screenNameKeys(screen.name, screen.city);
  const city = normalizeName(screen.city);
  const nameMatches = catalog.filter((row) => {
    const catalogName = normalizeName(row.name);
    if (!catalogName) return false;
    if (keys.includes(catalogName)) return true;
    return keys.some(
      (key) => key.startsWith(`${catalogName} `) || catalogName.startsWith(`${key} `)
    );
  });
  if (nameMatches.length === 0) return undefined;
  if (nameMatches.length === 1) return nameMatches[0];
  if (city) {
    const byCity = nameMatches.filter((row) => normalizeName(row.city) === city);
    if (byCity.length > 0) return byCity[0];
  }
  return nameMatches[0];
}

/** Katalogo owner visada laimi — plane kartais klaidingai būna Piksel. */
export function applyCatalogToScreens(
  screens: OrderClipScreen[],
  catalog: ClipCatalogRow[]
): OrderClipScreen[] {
  if (screens.length === 0 || catalog.length === 0) return screens;
  return screens.map((screen) => {
    const match = findCatalogMatch(screen, catalog);
    if (!match) return screen;
    return {
      ...screen,
      id: screen.id || match.id,
      resolution: screen.resolution || match.resolution || null,
      owner: match.owner || screen.owner || null,
      type: canonicalClipScreenType(screen.type || match.type),
    };
  });
}

const CATALOG_TTL_MS = 5 * 60 * 1000;
const CATALOG_TIMEOUT_MS = 4000;
let catalogCache: { at: number; rows: ClipCatalogRow[] } | null = null;
let catalogInflight: Promise<ClipCatalogRow[]> | null = null;

async function loadClipCatalog(): Promise<ClipCatalogRow[]> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) {
    return catalogCache.rows;
  }
  if (catalogInflight) return catalogInflight;

  catalogInflight = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
      const { data, error } = await supabase
        .from('screens')
        .select('id,name,city,resolution,owner,type')
        .eq('is_active', true)
        .abortSignal(controller.signal);
      clearTimeout(timer);
      if (error || !Array.isArray(data)) return catalogCache?.rows || [];
      const rows = data as ClipCatalogRow[];
      catalogCache = { at: Date.now(), rows };
      return rows;
    } catch {
      return catalogCache?.rows || [];
    } finally {
      catalogInflight = null;
    }
  })();

  return catalogInflight;
}

/** Papildo ekranus owner/resolution/type iš Supabase katalogo. */
export async function enrichScreensFromCatalog(
  screens: OrderClipScreen[]
): Promise<OrderClipScreen[]> {
  if (screens.length === 0) return screens;
  const catalog = await loadClipCatalog();
  if (catalog.length === 0) return screens;
  return applyCatalogToScreens(screens, catalog);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB nepasiekiamas'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error('IndexedDB klaida'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('orderId', 'orderId', { unique: false });
      }
    };
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB klaida'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB aborted'));
  });
}

function guessClipMime(file: File): string {
  if (file.type) return file.type;
  if (/\.(mp4|m4v)$/i.test(file.name)) return 'video/mp4';
  if (/\.mov$/i.test(file.name)) return 'video/quicktime';
  if (/\.webm$/i.test(file.name)) return 'video/webm';
  if (/\.jpe?g$/i.test(file.name)) return 'image/jpeg';
  if (/\.png$/i.test(file.name)) return 'image/png';
  if (/\.webp$/i.test(file.name)) return 'image/webp';
  if (/\.gif$/i.test(file.name)) return 'image/gif';
  return 'application/octet-stream';
}

export async function listOrderClips(orderId: string): Promise<OrderClipRecord[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const index = tx.objectStore(STORE).index('orderId');
    const rows = (await idbRequest(index.getAll(String(orderId)))) as Array<
      OrderClipRecord & { blob: Blob }
    >;
    return rows
      .map((row) => {
        const uploadKind = resolveClipUploadKind(row);
        const remote = clipRemotePreviewUrl(row);
        const { blob, ...rest } = row;
        return {
          ...rest,
          uploadKind,
          previewUrl:
            remote || (blob ? URL.createObjectURL(blob) : undefined),
        };
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  } finally {
    db.close();
  }
}

async function putClipRecord(record: OrderClipRecord & { blob: Blob }): Promise<void> {
  await putOrderClipRecord(record);
}

/** Išsaugo klipą be blob (pvz. jau guli player.piksel.lt). */
export async function putOrderClipRecord(
  record: OrderClipRecord & { blob?: Blob }
): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const done = waitForTransaction(tx);
    tx.objectStore(STORE).put(record);
    await done;
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      throw new Error('Naršyklėje nebetelpa tiek klipų. Ištrink senus arba kelk po kelis.');
    }
    throw error;
  } finally {
    db.close();
  }
}

export async function addOrderClip(
  orderId: string,
  file: File,
  uploadKind: ClipUploadKind
): Promise<OrderClipRecord & { blob: Blob }> {
  const mimeType = guessClipMime(file);
  const owned = new Blob([await file.arrayBuffer()], { type: mimeType });
  const record: OrderClipRecord & { blob: Blob } = {
    id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    orderId: String(orderId),
    filename: file.name,
    mimeType,
    width: null,
    height: null,
    resolutionKey: null,
    resolutionLabel: null,
    uploadKind,
    createdAt: new Date().toISOString(),
    blob: owned,
  };

  await putClipRecord(record);
  return {
    ...record,
    previewUrl: URL.createObjectURL(owned),
  };
}

/** Papildo ką tik įkelto klipo rezoliuciją — video metaduomenys gali užtrukti. */
export async function measureOrderClip(
  clip: OrderClipRecord & { blob?: Blob }
): Promise<OrderClipRecord & { blob?: Blob }> {
  if (!clip.blob) return clip;
  const resolution = await readFileResolution(clip.blob as File);
  const next: OrderClipRecord & { blob: Blob } = {
    ...clip,
    blob: clip.blob,
    width: resolution.width,
    height: resolution.height,
    resolutionKey: resolution.key,
    resolutionLabel: resolution.label,
  };
  await putClipRecord(next);
  return { ...next, previewUrl: clip.previewUrl || URL.createObjectURL(clip.blob) };
}

export async function removeOrderClip(clipId: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const done = waitForTransaction(tx);
    tx.objectStore(STORE).delete(clipId);
    await done;
  } finally {
    db.close();
  }
}

/** Atnaujina klipo metaduomenis (pvz. rodymo datas), blob lieka. */
export async function updateOrderClip(
  clipId: string,
  patch: {
    displayFrom?: string | null;
    displayTo?: string | null;
    displayScreenNames?: string[] | null;
  }
): Promise<OrderClipRecord> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const existing = (await idbRequest(store.get(String(clipId)))) as
      | (OrderClipRecord & { blob?: Blob })
      | undefined;
    if (!existing) throw new Error('Klipas nerastas');

    const next: OrderClipRecord & { blob?: Blob } = { ...existing };

    if (patch.displayFrom !== undefined) {
      const value = String(patch.displayFrom || '').trim();
      if (value) next.displayFrom = value;
      else delete next.displayFrom;
    }
    if (patch.displayTo !== undefined) {
      const value = String(patch.displayTo || '').trim();
      if (value) next.displayTo = value;
      else delete next.displayTo;
    }
    if (patch.displayScreenNames !== undefined) {
      const names = Array.isArray(patch.displayScreenNames)
        ? [
            ...new Set(
              patch.displayScreenNames
                .map((n) => String(n || '').trim())
                .filter(Boolean)
            ),
          ]
        : [];
      if (names.length) next.displayScreenNames = names;
      else delete next.displayScreenNames;
    }

    await idbRequest(store.put(next));

    return {
      ...next,
      uploadKind: resolveClipUploadKind(next),
      previewUrl: next.blob ? URL.createObjectURL(next.blob) : undefined,
    };
  } finally {
    db.close();
  }
}

/** Pažymi, kad failas jau guli player.piksel.lt. */
export async function setOrderClipServer(
  clipId: string,
  server: { mediaId: string; path: string }
): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const existing = (await idbRequest(store.get(String(clipId)))) as
      | (OrderClipRecord & { blob?: Blob })
      | undefined;
    if (!existing) return;
    await idbRequest(
      store.put({
        ...existing,
        serverMediaId: server.mediaId,
        serverPath: server.path,
      })
    );
  } finally {
    db.close();
  }
}

export function revokeClipPreviewUrls(clips: OrderClipRecord[]): void {
  for (const clip of clips) {
    if (clip.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(clip.previewUrl);
  }
}

export function buildPikselRequirements(screens: OrderClipScreen[]): RequiredResolution[] {
  return collectRequiredResolutions(pikselScreensOnly(screens));
}

export function buildPlanRequirements(screens: OrderClipScreen[]): RequiredResolution[] {
  return collectRequiredResolutions(screens);
}

export type MissingMediaRequirement = {
  key: string;
  label: string;
  mediaKind: ScreenMediaKind;
  screenNames: string[];
};

type ClipMatchAssignment = {
  clipId: string;
  filename: string;
  resolutionKey: string;
  resolutionLabel: string;
  uploadKind: ClipUploadKind;
  screenNames: string[];
};

type ClipMismatch = {
  clipId: string;
  filename: string;
  resolutionLabel: string;
  reason: string;
};

function evaluateClipsAgainstScreens(
  targetScreens: OrderClipScreen[],
  clips: OrderClipRecord[]
) {
  const screensWithRes = targetScreens.filter((s) => parseResolution(s.resolution));
  const missingScreenResolutions =
    targetScreens.length > 0 && screensWithRes.length === 0;

  const matchedAssignments: ClipMatchAssignment[] = [];
  const coveredScreenNames = new Set<string>();

  for (const clip of clips) {
    const clipKind = resolveClipUploadKind(clip);
    if (!clip.resolutionKey) continue;
    const autoNames: string[] = [];
    for (const screen of screensWithRes) {
      const size = parseResolution(screen.resolution);
      if (!size) continue;
      if (resolutionKey(size) !== clip.resolutionKey) continue;
      if (!clipFitsScreen(clipKind, screenMediaKind(screen))) continue;
      const name = String(screen.name || '').trim();
      if (name) autoNames.push(name);
    }
    const screenNames = resolveClipDisplayScreens(clip, autoNames);
    for (const name of screenNames) coveredScreenNames.add(name);
    if (screenNames.length) {
      matchedAssignments.push({
        clipId: clip.id,
        filename: clip.filename,
        resolutionKey: clip.resolutionKey,
        resolutionLabel: clip.resolutionLabel || clip.resolutionKey,
        uploadKind: clipKind,
        screenNames,
      });
    }
  }

  const unmatchedClips: ClipMismatch[] = clips
    .filter((clip) => !matchedAssignments.some((m) => m.clipId === clip.id))
    .map((clip) => {
      const clipKind = resolveClipUploadKind(clip);
      let reason = 'Neatitinka nė vieno plano ekrano';
      if (!clip.resolutionKey) {
        reason = 'Nepavyko nuskaityti rezoliucijos';
      } else {
        const sameRes = screensWithRes.filter((screen) => {
          const size = parseResolution(screen.resolution);
          return size && resolutionKey(size) === clip.resolutionKey;
        });
        if (sameRes.length && !sameRes.some((s) => clipFitsScreen(clipKind, screenMediaKind(s)))) {
          reason =
            clipKind === 'static'
              ? 'Yra ta rezoliucija, bet tik Video ekranams'
              : 'Yra ta rezoliucija, bet tik Statiniams ekranams';
        }
      }
      return {
        clipId: clip.id,
        filename: clip.filename,
        resolutionLabel: clip.resolutionLabel || 'nežinoma',
        reason,
      };
    });

  /** Trūkumai grupuojami rezoliucija + tipas */
  const missingMap = new Map<string, MissingMediaRequirement>();
  for (const screen of screensWithRes) {
    const name = String(screen.name || '').trim();
    if (!name || coveredScreenNames.has(name)) continue;
    const size = parseResolution(screen.resolution)!;
    const resKey = resolutionKey(size);
    const mediaKind = screenMediaKind(screen);
    const key = `${resKey}|${mediaKind}`;
    const existing = missingMap.get(key);
    if (existing) {
      if (!existing.screenNames.includes(name)) existing.screenNames.push(name);
    } else {
      missingMap.set(key, {
        key,
        label: `${formatResolution(size)} · ${screenMediaKindLabel(mediaKind)}`,
        mediaKind,
        screenNames: [name],
      });
    }
  }
  const missing = [...missingMap.values()];

  const coveredClipIds = [...new Set(matchedAssignments.map((item) => item.clipId))];
  const hasMatchingClips = coveredClipIds.length > 0 && coveredScreenNames.size > 0;
  const isComplete =
    screensWithRes.length > 0 &&
    screensWithRes.every((s) => coveredScreenNames.has(String(s.name || '').trim()));

  /** Senas result shape — UI / Live coveredCount */
  const legacyRequired = collectRequiredResolutions(targetScreens);
  const clipResults = clips.map((clip) => ({
    fileName: clip.filename,
    width: clip.width,
    height: clip.height,
    key: clip.resolutionKey,
    label: clip.resolutionLabel,
  }));
  const legacyEval = evaluateMediaResolutions(legacyRequired, clipResults);
  const coveredKeys = legacyRequired
    .map((r) => r.key)
    .filter((key) =>
      screensWithRes.some((screen) => {
        const size = parseResolution(screen.resolution);
        if (!size || resolutionKey(size) !== key) return false;
        return coveredScreenNames.has(String(screen.name || '').trim());
      })
    );

  const result = {
    ...legacyEval,
    coveredKeys,
    missing: missing.map((m) => ({
      key: m.key,
      label: m.label,
      width: 0,
      height: 0,
      screenNames: m.screenNames,
    })),
    isComplete,
  };

  return {
    screens: targetScreens,
    required: legacyRequired,
    result,
    missing,
    matchedAssignments,
    unmatchedClips,
    coveredScreenNames: [...coveredScreenNames],
    coveredClipIds,
    hasMatchingClips,
    isComplete,
    missingScreenResolutions,
    coverageLabel: (() => {
      if (targetScreens.length === 0) return 'Nėra ekranų';
      if (missingScreenResolutions) return 'Trūksta ekranų rezoliucijų';
      if (isComplete) return 'Pilnas komplektas';
      if (clips.length === 0) return 'Klipų dar nėra';
      if (!hasMatchingClips) return 'Nėra tinkamų klipų';
      const requiredKeys = new Set<string>();
      for (const screen of screensWithRes) {
        const size = parseResolution(screen.resolution);
        if (!size) continue;
        requiredKeys.add(`${resolutionKey(size)}|${screenMediaKind(screen)}`);
      }
      const total = requiredKeys.size;
      const ok = Math.max(0, total - missing.length);
      return `Dalinis (${ok}/${total} rez.)`;
    })(),
  };
}

/**
 * Dvi sluoksniai:
 * - plan — visi ekranai (media gauta)
 * - live — tik Piksel (player publish)
 */
export function evaluateOrderClips(
  screens: OrderClipScreen[],
  clips: OrderClipRecord[]
) {
  const plan = evaluateClipsAgainstScreens(screens, clips);
  const live = evaluateClipsAgainstScreens(pikselScreensOnly(screens), clips);

  const canPublish = live.hasMatchingClips;
  const canPublishPartial = canPublish && !live.isComplete;
  const canMarkMediaReceived = plan.hasMatchingClips;

  return {
    plan,
    live,
    allScreens: screens,
    pikselScreens: live.screens,
    required: live.required,
    result: live.result,
    matchedAssignments: live.matchedAssignments,
    unmatchedClips: live.unmatchedClips,
    publishableScreenNames: live.coveredScreenNames,
    publishableClipIds: live.coveredClipIds,
    canPublish,
    canPublishPartial,
    canMarkMediaReceived,
    canPlayPartial: canPublish,
    missingScreenResolutions: live.missingScreenResolutions,
    coverageLabel: plan.coverageLabel,
  };
}

export type PlanMediaCoverageSummary = {
  ok: number;
  total: number;
  isComplete: boolean;
  hasMatchingClips: boolean;
};

export type MediaColumnDisplay =
  | { kind: 'pending' }
  | { kind: 'complete' }
  | { kind: 'partial'; ok: number; total: number }
  | { kind: 'empty' };

/** ok/total = unikalių rezoliucijų (+ tipas) padengimas, ne ekranų skaičius. */
export function summarizePlanMediaCoverage(
  plan: ReturnType<typeof evaluateOrderClips>['plan']
): PlanMediaCoverageSummary {
  const requiredKeys = new Set<string>();
  for (const screen of plan.screens) {
    const size = parseResolution(screen.resolution);
    if (!size) continue;
    requiredKeys.add(`${resolutionKey(size)}|${screenMediaKind(screen)}`);
  }
  const total = requiredKeys.size;
  const missing = plan.missing.length;
  const ok = Math.max(0, total - missing);
  return {
    ok,
    total,
    isComplete: total > 0 && missing === 0,
    hasMatchingClips: plan.hasMatchingClips,
  };
}

/** Plano laukai, kurių `Order.details` tipas dar nedeklaruoja, bet runtime juos turi. */
type OrderClipPlanDetails = {
  plan?: {
    screenRows?: Array<{
      name: string;
      city?: string;
      owner?: string;
      type?: string;
      resolution?: string;
      catalogId?: string;
    }>;
    screenNames?: string[];
  };
};

function orderClipPlan(details: unknown): OrderClipPlanDetails['plan'] {
  if (!details || typeof details !== 'object') return undefined;
  const plan = (details as OrderClipPlanDetails).plan;
  return plan && typeof plan === 'object' ? plan : undefined;
}

/** Ekranai iš order.details.plan (be PocketBase) — greitam lentelės coverage. */
export function screensFromOrderPlan(order: {
  details?: OrderClipPlanDetails | NonNullable<Order['details']>;
}): OrderClipScreen[] {
  const plan = orderClipPlan(order.details);
  const rows = plan?.screenRows || [];
  if (rows.length > 0) {
    return rows.map((row) => ({
      id: row.catalogId,
      name: row.name,
      city: row.city,
      owner: row.owner,
      type: row.type,
      resolution: row.resolution,
    }));
  }
  return (plan?.screenNames || []).map((name) => ({
    name,
  }));
}

/**
 * Ekranai Live / Klipams: details.plan, o jei nėra — seni PocketBase `screens[]` ID
 * (ta pati logika, kad seni orderiai veiktų be perplanavimo).
 */
export async function resolveOrderClipScreens(order: Order): Promise<OrderClipScreen[]> {
  let nextScreens = screensFromOrderPlan(order);

  if (nextScreens.length === 0 && Array.isArray(order.screens) && order.screens.length > 0) {
    if (isTestOrder(order)) {
      nextScreens = (orderClipPlan(order.details)?.screenNames || []).map((name) => ({
        name,
      }));
    } else {
      const [mediaScreens, withPartner, partners] = await Promise.all([
        PocketBaseService.getScreensForMediaCheck(order.screens),
        PocketBaseService.getScreensWithPartner(order.screens),
        PocketBaseService.getPartners(),
      ]);
      const partnerById = new Map(partners.map((p) => [p.id, p.name]));
      nextScreens = mediaScreens.map((screen) => {
        const full = withPartner[screen.id];
        const partnerName = full?.partner ? partnerById.get(full.partner) : undefined;
        return {
          id: screen.id,
          name: screen.name,
          resolution: screen.resolution,
          partnerName: partnerName || null,
          owner: partnerName || null,
        };
      });
    }
  }

  return enrichScreensFromCatalog(nextScreens);
}

/**
 * Variantas A: — / Taip / 8/10 / Ne
 * 8/10 = padengtos / reikalingos rezoliucijos (ne ekranai).
 * Coverage snapshot (arba live map) turi prioritetą prieš media_received boolean.
 * Seni snapshot’ai be unit:'resolution' ignoruojami (buvo ekranų skaičius).
 */
export function resolveMediaColumnDisplay(
  order: {
    approved: boolean;
    media_received: boolean;
    details?: {
      mediaCoverage?: { ok: number; total: number; unit?: 'resolution' };
    };
  },
  coverageOverride?: { ok: number; total: number } | null
): MediaColumnDisplay {
  if (!order.approved) return { kind: 'pending' };

  const snap = order.details?.mediaCoverage;
  const cov =
    coverageOverride ??
    (snap?.unit === 'resolution' && snap.total > 0 ? snap : null);
  if (cov && cov.total > 0) {
    if (cov.ok <= 0) return { kind: 'empty' };
    if (cov.ok >= cov.total) return { kind: 'complete' };
    return { kind: 'partial', ok: cov.ok, total: cov.total };
  }

  return order.media_received ? { kind: 'complete' } : { kind: 'empty' };
}

/** Skaičiuoja plan coverage iš IndexedDB klipų + plano ekranų (su katalogo rezoliucijomis). */
export async function computeOrderPlanMediaCoverage(order: {
  id: string;
  details?: {
    plan?: {
      screenRows?: Array<{
        name: string;
        city?: string;
        owner?: string;
        type?: string;
        resolution?: string;
        catalogId?: string;
      }>;
      screenNames?: string[];
    };
    mediaCoverage?: { ok: number; total: number; unit?: 'resolution' };
  };
}): Promise<PlanMediaCoverageSummary | null> {
  const rawScreens = screensFromOrderPlan(order);
  if (rawScreens.length === 0) return null;
  const screens = await enrichScreensFromCatalog(rawScreens);
  const clips = await listOrderClips(order.id);
  const evaluation = evaluateOrderClips(screens, clips);
  return summarizePlanMediaCoverage(evaluation.plan);
}

