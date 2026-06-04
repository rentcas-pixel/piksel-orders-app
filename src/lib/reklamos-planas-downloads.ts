const STORAGE_KEY = 'piksel-reklamos-planas-v1';

type DownloadIndex = Record<string, Record<string, { at: string }>>;

function readIndex(): DownloadIndex {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DownloadIndex;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeIndex(index: DownloadIndex) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(index));
  } catch {
    // quota / private mode
  }
}

/** Partnerių ID, kurių planas jau buvo atsisiųstas šiam užsakymui */
export function getDownloadedPartnerIds(orderId: string): Set<string> {
  const index = readIndex();
  const forOrder = index[orderId];
  if (!forOrder) return new Set();
  return new Set(Object.keys(forOrder));
}

export function isPartnerPlanDownloaded(orderId: string, partnerId: string): boolean {
  return getDownloadedPartnerIds(orderId).has(partnerId);
}

export function markPartnerPlanDownloaded(orderId: string, partnerId: string) {
  const index = readIndex();
  if (!index[orderId]) index[orderId] = {};
  index[orderId][partnerId] = { at: new Date().toISOString() };
  writeIndex(index);
}
