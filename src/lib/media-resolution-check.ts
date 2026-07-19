export type ResolutionSize = {
  width: number;
  height: number;
};

export type RequiredResolution = {
  key: string;
  label: string;
  width: number;
  height: number;
  screenNames: string[];
};

export type ClipResolutionResult = {
  fileName: string;
  width: number | null;
  height: number | null;
  key: string | null;
  label: string | null;
  error?: string;
};

export type MediaResolutionCheckResult = {
  required: RequiredResolution[];
  clips: ClipResolutionResult[];
  coveredKeys: string[];
  missing: RequiredResolution[];
  unmatchedClips: ClipResolutionResult[];
  isComplete: boolean;
};

/** Parse PocketBase resolution strings like "1152 x 576", "3.040 x 240". */
export function parseResolution(raw: string | null | undefined): ResolutionSize | null {
  if (!raw?.trim()) return null;
  const cleaned = raw
    .trim()
    .replace(/×/gi, 'x')
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ');

  const match = cleaned.match(/(\d[\d.\s]*)\s*[xX]\s*(\d[\d.\s]*)/);
  if (!match) return null;

  const width = parseDimension(match[1]);
  const height = parseDimension(match[2]);
  if (!width || !height) return null;
  return { width, height };
}

function parseDimension(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function resolutionKey(size: ResolutionSize): string {
  return `${size.width}x${size.height}`;
}

export function formatResolution(size: ResolutionSize): string {
  return `${size.width} × ${size.height}`;
}

export function collectRequiredResolutions(
  screens: Array<{ name?: string; resolution?: string | null }>
): RequiredResolution[] {
  const byKey = new Map<string, RequiredResolution>();

  for (const screen of screens) {
    const size = parseResolution(screen.resolution);
    if (!size) continue;
    const key = resolutionKey(size);
    const existing = byKey.get(key);
    const screenName = (screen.name || 'Nežinomas').trim();
    if (existing) {
      if (screenName && !existing.screenNames.includes(screenName)) {
        existing.screenNames.push(screenName);
      }
      continue;
    }
    byKey.set(key, {
      key,
      label: formatResolution(size),
      width: size.width,
      height: size.height,
      screenNames: screenName ? [screenName] : [],
    });
  }

  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, 'lt'));
}

export function evaluateMediaResolutions(
  required: RequiredResolution[],
  clips: ClipResolutionResult[]
): MediaResolutionCheckResult {
  const coveredKeys = [
    ...new Set(clips.map((c) => c.key).filter((key): key is string => Boolean(key))),
  ];
  const covered = new Set(coveredKeys);
  const missing = required.filter((r) => !covered.has(r.key));
  const requiredKeys = new Set(required.map((r) => r.key));
  const unmatchedClips = clips.filter(
    (c) => c.key && !requiredKeys.has(c.key)
  );

  return {
    required,
    clips,
    coveredKeys,
    missing,
    unmatchedClips,
    isComplete: required.length > 0 && missing.length === 0,
  };
}

export function isMediaFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type.startsWith('video/') || type.startsWith('image/')) return true;
  return /\.(mp4|mov|m4v|webm|avi|mkv|jpg|jpeg|png|webp|gif)$/i.test(file.name);
}

export async function readFileResolution(file: File): Promise<ClipResolutionResult> {
  const base = {
    fileName: file.name,
    width: null as number | null,
    height: null as number | null,
    key: null as string | null,
    label: null as string | null,
  };

  if (!isMediaFile(file)) {
    return { ...base, error: 'Nepalaikomas formatas' };
  }

  try {
    const size = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(file.name)
      ? await readImageSize(file)
      : await readVideoSize(file);

    if (!size) {
      return { ...base, error: 'Nepavyko nuskaityti rezoliucijos' };
    }

    return {
      fileName: file.name,
      width: size.width,
      height: size.height,
      key: resolutionKey(size),
      label: formatResolution(size),
    };
  } catch {
    return { ...base, error: 'Nepavyko nuskaityti rezoliucijos' };
  }
}

function readVideoSize(file: File): Promise<ResolutionSize | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      cleanup();
      resolve(width > 0 && height > 0 ? { width, height } : null);
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    video.src = url;
  });
}

function readImageSize(file: File): Promise<ResolutionSize | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    const cleanup = () => URL.revokeObjectURL(url);

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      cleanup();
      resolve(width > 0 && height > 0 ? { width, height } : null);
    };
    image.onerror = () => {
      cleanup();
      resolve(null);
    };

    image.src = url;
  });
}
