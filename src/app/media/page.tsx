'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownTrayIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import { AppShell } from '@/components/AppShell';
import { useAppSession } from '@/hooks/useAppSession';
import { getPlayerApiBase } from '@/lib/player-bridge';
import {
  clipDisplayName,
  deletePlayerMedia,
  downloadPlayerMedia,
  fetchPlayerMedia,
  formatMediaBytes,
  playerMediaUrl,
  type PlayerMediaFile,
} from '@/lib/player-media';
import {
  modalBtnDanger,
  modalBtnPrimary,
  modalBtnSecondary,
  portalCardClass,
  portalSearchFieldClass,
  portalSearchInputClass,
  portalStickyThClass,
  portalStickyTheadClass,
  portalTableScrollClass,
  portalTdClass,
} from '@/lib/portal-ui';

export default function MediaPage() {
  const { session, loading: sessionLoading } = useAppSession();
  const [files, setFiles] = useState<PlayerMediaFile[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<PlayerMediaFile | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const result = await fetchPlayerMedia();
    if (!result.ok) {
      setError(result.error || 'Nepavyko užkrauti');
      setFiles([]);
      setTotalBytes(0);
    } else {
      setFiles(result.files);
      setTotalBytes(result.totalBytes);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((file) => {
      const hay = [
        file.name,
        clipDisplayName(file.name),
        file.kind,
        ...file.usedBy.map((u) => `${u.client} ${u.campaignId}`),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [files, query]);

  const remove = async (file: PlayerMediaFile) => {
    const label = clipDisplayName(file.name);
    if (!confirm(`Ištrinti „${label}“ iš player serverio?\nEkranai šio failo daugiau negaus.`)) {
      return;
    }
    setDeleting(file.name);
    const result = await deletePlayerMedia(file.name);
    setDeleting(null);
    if (!result.ok) {
      alert(result.error || 'Nepavyko ištrinti');
      return;
    }
    if (preview?.name === file.name) setPreview(null);
    await refresh();
  };

  const download = async (file: PlayerMediaFile) => {
    setDownloading(file.name);
    const result = await downloadPlayerMedia(file);
    setDownloading(null);
    if (!result.ok) {
      alert(result.error || 'Nepavyko atsisiųsti');
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        Kraunama…
      </div>
    );
  }

  if (!session) {
    if (typeof window !== 'undefined') window.location.assign('/login');
    return null;
  }

  const formatWhen = (value?: string) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('lt-LT');
    } catch {
      return value;
    }
  };

  return (
    <>
    <div className="play-vertical-grid min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppShell onAddOrder={() => {}} userEmail={session.email}>
      <main className="container mx-auto px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Media</h1>
            <p className="mt-1 text-sm text-gray-500">
              Klipai serveryje <code className="text-xs">{getPlayerApiBase()}</code>
              {files.length ? ` · ${files.length} fail.` : ''}
              {totalBytes > 0 ? ` · ${formatMediaBytes(totalBytes)}` : ''}
            </p>
          </div>
          <button
            type="button"
            className={modalBtnPrimary}
            onClick={() => {
              setLoading(true);
              void refresh();
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <ArrowPathIcon className="h-4 w-4" />
              Atnaujinti
            </span>
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <div className={portalCardClass}>
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className={portalSearchFieldClass}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ieškoti pagal failą, klientą, orderio ID…"
                className={`${portalSearchInputClass} pl-3`}
              />
            </div>
          </div>
          <div className={portalTableScrollClass}>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className={portalStickyTheadClass}>
                <tr>
                  <th className={portalStickyThClass}>Failas</th>
                  <th className={portalStickyThClass}>Dydis</th>
                  <th className={portalStickyThClass}>Naudoja</th>
                  <th className={portalStickyThClass}>Įkelta</th>
                  <th className={portalStickyThClass}> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-800">
                {loading && files.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`${portalTdClass} text-center`}>
                      Kraunama…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`${portalTdClass} text-center`}>
                      {files.length === 0
                        ? 'Serveryje dar nėra klipų. Publikuok Live — tada jie atsiras čia.'
                        : 'Nerasta pagal paiešką.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((file) => {
                    const url = playerMediaUrl(file.path);
                    const label = clipDisplayName(file.name);
                    return (
                      <tr
                        key={file.name}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40"
                        onClick={() => setPreview(file)}
                      >
                        <td className={`${portalTdClass} text-gray-900 dark:text-white`}>
                          <div className="font-medium">{label}</div>
                          <div className="max-w-[28rem] truncate font-mono text-[11px] text-gray-400">
                            {file.name}
                          </div>
                        </td>
                        <td className={portalTdClass}>
                          {file.bytes > 0 ? formatMediaBytes(file.bytes) : '—'}
                        </td>
                        <td className={portalTdClass}>
                          {file.usedBy.length === 0 ? (
                            <span className="text-xs text-gray-400">Nenaudojamas</span>
                          ) : (
                            <span>
                              {file.usedBy
                                .map((u) => u.client || u.campaignId)
                                .filter(Boolean)
                                .join(', ')}
                            </span>
                          )}
                        </td>
                        <td className={portalTdClass}>{formatWhen(file.mtime)}</td>
                        <td
                          className={portalTdClass}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end gap-1">
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                            >
                              Atidaryti
                            </a>
                            <button
                              type="button"
                              title="Atsisiųsti"
                              disabled={downloading === file.name}
                              onClick={() => void download(file)}
                              className="rounded-lg px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                              <span className="inline-flex items-center gap-1">
                                <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                                {downloading === file.name ? 'Siunčiama…' : 'Atsisiųsti'}
                              </span>
                            </button>
                            <button
                              type="button"
                              title="Ištrinti"
                              disabled={deleting === file.name}
                              onClick={() => void remove(file)}
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-950/40"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      </AppShell>
    </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {clipDisplayName(preview.name)}
            </h3>
            <p className="mt-1 break-all font-mono text-xs text-gray-500">{preview.name}</p>
            <div className="mt-4 overflow-hidden rounded-lg bg-black">
              {preview.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={playerMediaUrl(preview.path)}
                  alt={clipDisplayName(preview.name)}
                  className="max-h-[60vh] w-full object-contain"
                />
              ) : preview.kind === 'video' ? (
                <video
                  src={playerMediaUrl(preview.path)}
                  controls
                  className="max-h-[60vh] w-full"
                />
              ) : (
                <p className="p-6 text-sm text-gray-300">Peržiūra šiam tipui negalima.</p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <a
                href={playerMediaUrl(preview.path)}
                target="_blank"
                rel="noreferrer"
                className={modalBtnSecondary}
              >
                Atidaryti URL
              </a>
              <button
                type="button"
                className={modalBtnSecondary}
                disabled={downloading === preview.name}
                onClick={() => void download(preview)}
              >
                {downloading === preview.name ? 'Siunčiama…' : 'Atsisiųsti'}
              </button>
              <button
                type="button"
                className={modalBtnDanger}
                disabled={deleting === preview.name}
                onClick={() => void remove(preview)}
              >
                Ištrinti
              </button>
              <button
                type="button"
                className={modalBtnPrimary}
                onClick={() => setPreview(null)}
              >
                Uždaryti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
