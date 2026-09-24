import { getPlayerApiBase, playerAdminCallError, withPlayerAdminSecret } from '@/lib/player-bridge';
import { fetchAdminState } from '@/lib/player-devices';

export type PlayerMediaKind = 'video' | 'image' | 'file';

export type PlayerMediaUsage = {
  campaignId: string;
  client: string;
};

export type PlayerMediaFile = {
  name: string;
  path: string;
  bytes: number;
  mtime: string;
  kind: PlayerMediaKind;
  usedBy: PlayerMediaUsage[];
};

export function playerMediaUrl(relPath: string): string {
  const base = getPlayerApiBase().replace(/\/$/, '');
  const path = relPath.startsWith('/') ? relPath : `/${relPath}`;
  return `${base}${path}`;
}

/** Hub įkelia `{orderId}-clip-{ts}-{rand}-{original}`. */
export function clipDisplayName(fileName: string): string {
  const match = String(fileName || '').match(/-clip-\d+-[a-z0-9]+-(.+)$/i);
  return match?.[1] || fileName;
}

export function playerMediaDownloadUrl(relPath: string): string {
  const url = playerMediaUrl(relPath);
  return `${url}${url.includes('?') ? '&' : '?'}download=1`;
}

export async function downloadPlayerMedia(file: {
  name: string;
  path: string;
}): Promise<{ ok: boolean; error?: string }> {
  const fileName = clipDisplayName(file.name) || file.name || 'klipas';
  try {
    const link = document.createElement('a');
    link.href = playerMediaDownloadUrl(file.path);
    link.download = fileName;
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Nepavyko atsisiųsti failo.' };
  }
}

export function formatMediaBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function kindFromPath(filePath: string): PlayerMediaKind {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  return 'file';
}

function leafFromMediaPath(relPath: string): string {
  const raw = String(relPath || '').replace(/^\/media\//, '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function fetchPlayerMediaFromCampaigns(): Promise<{
  ok: boolean;
  files: PlayerMediaFile[];
  totalBytes: number;
  count: number;
  error?: string;
}> {
  const state = await fetchAdminState();
  if (!state.ok) {
    return {
      ok: false,
      files: [],
      totalBytes: 0,
      count: 0,
      error: state.error,
    };
  }
  const byName = new Map<string, PlayerMediaFile>();
  for (const campaign of state.campaigns) {
    for (const item of campaign.media || []) {
      const name = leafFromMediaPath(item.path);
      if (!name) continue;
      const existing = byName.get(name);
      const usage = {
        campaignId: String(campaign.id || ''),
        client: String(campaign.client || ''),
      };
      if (existing) {
        existing.usedBy.push(usage);
        continue;
      }
      byName.set(name, {
        name,
        path: item.path.startsWith('/') ? item.path : `/media/${encodeURIComponent(name)}`,
        bytes: 0,
        mtime: campaign.publishedAt || '',
        kind: kindFromPath(name),
        usedBy: [usage],
      });
    }
  }
  const files = [...byName.values()].sort((a, b) =>
    String(b.mtime).localeCompare(String(a.mtime))
  );
  return { ok: true, files, totalBytes: 0, count: files.length };
}

export async function fetchPlayerMedia(): Promise<{
  ok: boolean;
  files: PlayerMediaFile[];
  totalBytes: number;
  count: number;
  error?: string;
}> {
  const base = getPlayerApiBase();
  try {
    const res = await fetch(`${base}/api/admin/media`, {
      method: 'GET',
      headers: await withPlayerAdminSecret(),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 404) {
      return fetchPlayerMediaFromCampaigns();
    }
    if (!res.ok || body?.ok === false) {
      return {
        ok: false,
        files: [],
        totalBytes: 0,
        count: 0,
        error: playerAdminCallError(res.status, `API ${res.status}`, body),
      };
    }
    const files = Array.isArray(body.files) ? (body.files as PlayerMediaFile[]) : [];
    return {
      ok: true,
      files,
      totalBytes: Number(body.totalBytes) || 0,
      count: Number(body.count) || files.length,
    };
  } catch {
    return {
      ok: false,
      files: [],
      totalBytes: 0,
      count: 0,
      error: `Nepasiekia piksel-api-server (${base})`,
    };
  }
}

export async function deletePlayerMedia(
  name: string
): Promise<{ ok: boolean; error?: string }> {
  const base = getPlayerApiBase();
  try {
    const res = await fetch(
      `${base}/api/admin/media?name=${encodeURIComponent(name)}`,
      { method: 'DELETE', headers: await withPlayerAdminSecret() }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.ok === false) {
      return { ok: false, error: playerAdminCallError(res.status, `API ${res.status}`, body) };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: `Nepasiekia piksel-api-server (${base})` };
  }
}
