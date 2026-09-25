import { resolveClipUploadKind, type ClipUploadKind, type OrderClipRecord } from '@/lib/order-clips';

/** Naujas / pakeistas failas — ant paties klipo. Pašalinimas lieka atskirai, nes eilutė jau ištrinta. */
export type ClipFileChange = {
  kind: 'added' | 'replaced';
  at: string;
};

export type ClipTimeLine = {
  label: 'Įkelta' | 'Serveryje' | 'Ekranuose';
  at: string;
};

export type ClipChangeLine = {
  label: 'Naujas failas' | 'Pakeistas failas' | 'Pašalintas failas';
  at: string;
};

export type ClipRemovalNotice = {
  clipId: string;
  orderId: string;
  at: string;
  uploadKind: ClipUploadKind;
  resolutionKey: string | null;
  filename: string;
};

const REMOVAL_KEY = 'pikselClipFileChanges';
const REMOVALS_PER_ORDER = 40;

const CHANGE_LABEL: Record<ClipFileChange['kind'], ClipChangeLine['label']> = {
  added: 'Naujas failas',
  replaced: 'Pakeistas failas',
};

/** Lokalūs įkėlimai: `clip-<ms>-…`. Importuoti iš grotuvo šio šablono neturi. */
const LOCAL_CLIP_ID = /^clip-\d{10,}-/;

export function formatClipTime(iso: string | null | undefined): string | null {
  const raw = String(iso || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Vilnius',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = pick('year');
  const month = pick('month');
  const day = pick('day');
  const hour = pick('hour');
  const minute = pick('minute');
  if (!year || !month || !day || hour == null || minute == null) return null;
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * Įkėlimo laikas, jei jis jau įrašytas.
 * Nauji failai turi `uploadedAt`. Senesni šio kompo įkėlimai tą pačią akimirką laiko `createdAt`.
 * Importo `createdAt` nėra įkėlimo laikas — eilutės nerodom.
 */
export function storedUploadTime(
  clip: Pick<OrderClipRecord, 'id' | 'createdAt'> & { uploadedAt?: string }
): string | null {
  if (formatClipTime(clip.uploadedAt)) return String(clip.uploadedAt);
  if (LOCAL_CLIP_ID.test(String(clip.id || '')) && formatClipTime(clip.createdAt)) {
    return String(clip.createdAt);
  }
  return null;
}

export function clipTimeLines(
  clip: Pick<OrderClipRecord, 'id' | 'createdAt'> & {
    uploadedAt?: string;
    onServerAt?: string;
    onScreensAt?: string;
    fileChange?: ClipFileChange | null;
  },
  context?: {
    publishedAt?: string | null;
    publishedClipIds?: string[];
  }
): { times: ClipTimeLine[]; change: ClipChangeLine | null } {
  const times: ClipTimeLine[] = [];
  const uploaded = formatClipTime(storedUploadTime(clip));
  if (uploaded) times.push({ label: 'Įkelta', at: uploaded });

  const onServer = formatClipTime(clip.onServerAt);
  if (onServer) times.push({ label: 'Serveryje', at: onServer });

  const onScreens = formatClipTime(clip.onScreensAt);
  if (onScreens) {
    times.push({ label: 'Ekranuose', at: onScreens });
  } else {
    const ids = context?.publishedClipIds || [];
    const inPublish = ids.includes(String(clip.id));
    const published = inPublish ? formatClipTime(context?.publishedAt) : null;
    if (published) times.push({ label: 'Ekranuose', at: published });
  }

  const changeKind = clip.fileChange?.kind;
  const changeAt =
    changeKind === 'added' || changeKind === 'replaced'
      ? formatClipTime(clip.fileChange?.at)
      : null;
  const change =
    changeKind && changeAt
      ? { label: CHANGE_LABEL[changeKind], at: changeAt }
      : null;

  return { times, change };
}

/** Pirma to tipo byla — be pakeitimo eilutės. Ta pati rezoliucija — pakeitimas. Kita — naujas failas. */
export function classifyNewClipChange(
  existing: Array<Pick<OrderClipRecord, 'id' | 'uploadKind' | 'mimeType' | 'resolutionKey'>>,
  next: Pick<OrderClipRecord, 'id' | 'uploadKind' | 'mimeType' | 'resolutionKey'>
): ClipFileChange['kind'] | null {
  const kind = resolveClipUploadKind(next);
  const others = existing.filter(
    (clip) => clip.id !== next.id && resolveClipUploadKind(clip) === kind
  );
  if (others.length === 0) return null;
  if (next.resolutionKey && others.some((clip) => clip.resolutionKey === next.resolutionKey)) {
    return 'replaced';
  }
  return 'added';
}

export function removalChangeLine(notice: Pick<ClipRemovalNotice, 'at'>): ClipChangeLine | null {
  const at = formatClipTime(notice.at);
  if (!at) return null;
  return { label: 'Pašalintas failas', at };
}

export function removalsForSlot(
  notices: ClipRemovalNotice[],
  kind: ClipUploadKind,
  resolutionKey: string | null
): ClipRemovalNotice[] {
  if (!resolutionKey) return [];
  return notices.filter(
    (notice) => notice.uploadKind === kind && notice.resolutionKey === resolutionKey
  );
}

export function looseRemovals(
  notices: ClipRemovalNotice[],
  kind: ClipUploadKind,
  slotResolutionKeys: Array<string | null>
): ClipRemovalNotice[] {
  const keys = new Set(slotResolutionKeys.filter((key): key is string => Boolean(key)));
  return notices.filter(
    (notice) =>
      notice.uploadKind === kind &&
      (!notice.resolutionKey || !keys.has(notice.resolutionKey))
  );
}

export function appendClipRemoval(
  existing: ClipRemovalNotice[],
  notice: ClipRemovalNotice
): ClipRemovalNotice[] {
  const others = existing.filter((row) => row.orderId !== notice.orderId);
  const sameOrder = existing.filter((row) => row.orderId === notice.orderId);
  return [...others, ...[...sameOrder, notice].slice(-REMOVALS_PER_ORDER)];
}

function isRemovalNotice(value: unknown): value is ClipRemovalNotice {
  if (!value || typeof value !== 'object') return false;
  const row = value as ClipRemovalNotice;
  return (
    typeof row.clipId === 'string' &&
    typeof row.orderId === 'string' &&
    typeof row.at === 'string' &&
    (row.uploadKind === 'static' || row.uploadKind === 'video') &&
    (row.resolutionKey === null || typeof row.resolutionKey === 'string') &&
    typeof row.filename === 'string'
  );
}

function readRemovals(store: Pick<Storage, 'getItem'>): ClipRemovalNotice[] {
  try {
    const parsed = JSON.parse(store.getItem(REMOVAL_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRemovalNotice);
  } catch {
    return [];
  }
}

function browserStore(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function listClipRemovals(orderId: string): ClipRemovalNotice[] {
  const store = browserStore();
  if (!store) return [];
  return readRemovals(store).filter((row) => row.orderId === String(orderId));
}

/** Grąžina orderio eilutes, jei pavyko įrašyti. null — nieko nekeičiam ekrane. */
export function recordClipRemoval(notice: ClipRemovalNotice): ClipRemovalNotice[] | null {
  const store = browserStore();
  if (!store) return null;
  try {
    const next = appendClipRemoval(readRemovals(store), notice);
    store.setItem(REMOVAL_KEY, JSON.stringify(next));
    return next.filter((row) => row.orderId === notice.orderId);
  } catch {
    return null;
  }
}
