'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import {
  fetchMonitoring,
  type MonitorNowPlaying,
  type MonitorScreen,
  type MonitorStatus,
  type MonitoringSnapshot,
} from '@/lib/player-devices';
import { getPlayerApiBase } from '@/lib/player-bridge';
import { modalBtnPrimary, modalBtnSecondary } from '@/lib/portal-ui';

type FilterKey = 'all' | MonitorStatus;

function formatAge(ageMs: number | null): string {
  if (ageMs == null || !Number.isFinite(ageMs)) return 'Nėra sync';
  const sec = Math.max(0, Math.round(ageMs / 1000));
  if (sec < 60) return `Prieš ${sec} s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `Prieš ${min} min.`;
  const h = Math.round(min / 60);
  return `Prieš ${h} val.`;
}

function statusLabel(status: MonitorStatus): string {
  if (status === 'online') return 'Veikia';
  if (status === 'warning') return 'Reikia dėmesio';
  return 'Atsijungęs';
}

function statusClass(status: MonitorStatus): string {
  if (status === 'online') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (status === 'warning') return 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200';
}

function rotationClips(screen: MonitorScreen): MonitorNowPlaying[] {
  if (screen.rotation?.length) return screen.rotation;
  return screen.nowPlaying ? [screen.nowPlaying] : [];
}

function ClipPreview({
  clip,
  screenName,
  screenshotUrl,
}: {
  clip: MonitorNowPlaying | null;
  screenName?: string;
  screenshotUrl?: string | null;
}) {
  if (screenshotUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={screenshotUrl} alt="" className="h-full w-full object-cover" />;
  }
  const url = clip?.url;
  const kind = clip?.kind || 'video';
  if (!url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 px-4 text-center text-white">
        <span className="text-[10px] font-semibold tracking-[0.18em] text-emerald-300">
          PIKSEL
        </span>
        <strong className="text-sm font-semibold leading-tight">
          {clip?.campaign || 'Nėra playlist'}
        </strong>
        <small className="text-[11px] text-white/60">{screenName}</small>
      </div>
    );
  }
  if (kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-full w-full object-cover" />;
  }
  return (
    <video
      key={url}
      src={url}
      className="h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
    />
  );
}

function RotationPreview({
  screen,
  large = false,
}: {
  screen: MonitorScreen;
  large?: boolean;
}) {
  const clips = rotationClips(screen);
  const [index, setIndex] = useState(0);
  const preferShot = !!screen.screenshotUrl;

  useEffect(() => {
    setIndex(0);
  }, [screen.device.deviceCode, clips.length, screen.screenshotUrl]);

  useEffect(() => {
    if (preferShot || clips.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % clips.length);
    }, large ? 5000 : 3500);
    return () => window.clearInterval(timer);
  }, [clips.length, large, preferShot]);

  const clip = preferShot
    ? screen.reportedNowPlaying || screen.nowPlaying
    : clips[index] || null;

  return (
    <>
      <ClipPreview
        clip={clip}
        screenName={screen.device.screenName}
        screenshotUrl={screen.screenshotUrl}
      />
      {preferShot ? (
        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
          LIVE SHOT · {clip?.campaign || '—'}
        </span>
      ) : clips.length > 1 ? (
        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {index + 1}/{clips.length} · {clip?.campaign || '—'}
        </span>
      ) : null}
    </>
  );
}

export function DeviceMonitoringView() {
  const [data, setData] = useState<MonitoringSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selected, setSelected] = useState<MonitorScreen | null>(null);

  const refresh = useCallback(async () => {
    const result = await fetchMonitoring();
    if (!result.ok || !result.data) {
      setError(result.error || 'Nepavyko užkrauti');
      setLoading(false);
      return;
    }
    setData(result.data);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  // SMTP Hub dispatch išjungtas — alertai tik per Resend (player API).

  useEffect(() => {
    if (!selected || !data) return;
    const fresh = data.screens.find(
      (s) => s.device.deviceCode === selected.device.deviceCode
    );
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [data, selected]);

  const visible = useMemo(() => {
    const screens = data?.screens || [];
    if (filter === 'all') return screens;
    return screens.filter((s) => s.status === filter);
  }, [data, filter]);

  const syncedLabel = data?.syncedAt
    ? new Date(data.syncedAt).toLocaleTimeString('lt-LT')
    : '—';

  const counts = data?.counts || { all: 0, online: 0, warning: 0, offline: 0 };

  const summary: { key: FilterKey; label: string; value: number }[] = [
    { key: 'all', label: 'Visi ekranai', value: counts.all },
    { key: 'online', label: 'Veikia', value: counts.online },
    { key: 'warning', label: 'Reikia dėmesio', value: counts.warning },
    { key: 'offline', label: 'Atsijungę', value: counts.offline },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Ekranų stebėjimas
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Visi ekranai viename lange
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Live iš{' '}
            <code className="text-xs">{getPlayerApiBase()}</code>
            {' · '}
            screenshot / „dabar groju“ iš playerio · offline alertai per mail.piksel.lt
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-right text-xs text-gray-500">
            <div>Paskutinis atnaujinimas</div>
            <div className="font-semibold text-gray-800 dark:text-gray-200">{syncedLabel}</div>
          </div>
          <Link href="/devices" className={modalBtnSecondary}>
            Devices
          </Link>
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
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
          {error.includes('404')
            ? ' — reikia atnaujinti player API (monitoring endpoint).'
            : ''}
        </p>
      )}

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-4">
        {summary.map((item, i) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`flex min-h-[4.25rem] items-center gap-3 px-4 py-3 text-left transition ${
              i < summary.length - 1 ? 'border-r border-gray-100 dark:border-gray-700' : ''
            } ${
              filter === item.key
                ? 'bg-blue-50 shadow-[inset_0_-3px_0_0_#2563eb] dark:bg-blue-950/30'
                : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'
            }`}
          >
            <strong className="min-w-[2rem] text-2xl font-bold text-gray-900 dark:text-white">
              {item.value}
            </strong>
            <span className="text-sm text-gray-500 dark:text-gray-400">{item.label}</span>
          </button>
        ))}
      </div>

      {loading && !data ? (
        <p className="text-sm text-gray-500">Kraunama…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800">
          Nėra grotuvų šiam filtrui. Paleisk Windows Player arba nuimk filtrą.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((screen) => {
            const d = screen.device;
            const scheduleHref = `/devices/${encodeURIComponent(d.deviceCode)}/scheduling`;
            return (
              <button
                key={d.deviceCode}
                type="button"
                onClick={() => setSelected(screen)}
                className={`overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-800 ${
                  screen.status === 'warning'
                    ? 'border-amber-300 dark:border-amber-700'
                    : screen.status === 'offline'
                      ? 'border-rose-300 dark:border-rose-800'
                      : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div
                  className={`relative aspect-[2/1] overflow-hidden bg-slate-900 ${
                    screen.status === 'offline' ? 'grayscale opacity-70' : ''
                  }`}
                >
                  <RotationPreview screen={screen} />
                  <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                    {screen.screenshotUrl
                      ? 'LIVE'
                      : screen.reportedNowPlaying
                        ? 'DABAR GROJA'
                        : 'ROTACIJA'}
                  </span>
                  {screen.stuck && (
                    <span className="absolute left-2 top-8 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      STUCK
                    </span>
                  )}
                  <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {d.width} × {d.height}
                  </span>
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {d.screenName || '—'}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[11px] text-gray-400">
                        {d.deviceCode}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(screen.status)}`}
                    >
                      ● {statusLabel(screen.status)}
                    </span>
                  </div>
                  <div className="mt-3 border-t border-gray-100 pt-2 text-xs dark:border-gray-700">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-400">Dabar groja</span>
                      <strong className="truncate text-gray-900 dark:text-white">
                        {screen.reportedNowPlaying?.campaign ||
                          screen.nowPlaying?.campaign ||
                          '—'}
                      </strong>
                    </div>
                    <div
                      className="mt-1 truncate text-[11px] text-gray-500"
                      title={screen.campaigns.join(', ')}
                    >
                      Playliste: {screen.campaignCount} kamp.
                      {screen.campaigns.length ? ` · ${screen.campaigns.join(' · ')}` : ''}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-gray-400">
                    <span className="truncate">
                      {screen.openIncidents?.length
                        ? `${screen.openIncidents.length} atviri incidentai`
                        : formatAge(screen.ageMs)}
                    </span>
                    <span>{formatAge(screen.ageMs)}</span>
                  </div>
                  <div className="mt-2">
                    <Link
                      href={scheduleHref}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      Scheduling →
                    </Link>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-4">
              <div>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(selected.status)}`}
                >
                  ● {statusLabel(selected.status)}
                </span>
                <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  {selected.device.screenName}
                </h2>
                <p className="text-xs text-gray-500">
                  {selected.device.deviceCode} · {selected.device.width}×{selected.device.height}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg bg-gray-100 px-2.5 py-1 text-lg text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                onClick={() => setSelected(null)}
                aria-label="Uždaryti"
              >
                ×
              </button>
            </div>
            <div className="relative aspect-[2/1] bg-black">
              <RotationPreview screen={selected} large />
            </div>
            <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Rotacija ({selected.campaignCount})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {rotationClips(selected).map((clip) => (
                  <span
                    key={`${clip.campaignId || clip.id}-${clip.url}`}
                    className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-100"
                  >
                    {clip.campaign || clip.id}
                  </span>
                ))}
                {!rotationClips(selected).length && (
                  <span className="text-sm text-gray-400">Tuščia</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 border-t border-gray-200 dark:border-gray-700 sm:grid-cols-3">
              <div className="border-r border-gray-100 px-4 py-3 dark:border-gray-700">
                <div className="text-[11px] text-gray-400">Klipų playliste</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {selected.playlistCount}
                </div>
              </div>
              <div className="border-r border-gray-100 px-4 py-3 dark:border-gray-700">
                <div className="text-[11px] text-gray-400">Sync</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatAge(selected.ageMs)}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-[11px] text-gray-400">Dabar groja</div>
                <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {selected.reportedNowPlaying?.campaign ||
                    selected.nowPlaying?.campaign ||
                    '—'}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <button
                type="button"
                className={modalBtnSecondary}
                onClick={() => setSelected(null)}
              >
                Uždaryti
              </button>
              <Link
                href={`/devices/${encodeURIComponent(selected.device.deviceCode)}/scheduling`}
                className={modalBtnPrimary}
              >
                Scheduling
              </Link>
            </div>
          </div>
        </div>
      )}

      {(data?.incidents?.length || 0) > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Incidentų istorija
            </h2>
            <p className="text-xs text-gray-500">
              Offline / stuck / recovered · alertai per mail.piksel.lt kai sukonfigūruota
              HUB_ALERT_URL
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-2 font-medium">Ekranas</th>
                  <th className="px-4 py-2 font-medium">Tipas</th>
                  <th className="px-4 py-2 font-medium">Pradžia</th>
                  <th className="px-4 py-2 font-medium">Pabaiga</th>
                  <th className="px-4 py-2 font-medium">Detalės</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {(data?.incidents || []).slice(0, 40).map((inc) => (
                  <tr key={inc.id}>
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                      {inc.screenName}
                      <div className="font-mono text-[10px] text-gray-400">
                        {inc.deviceCode}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          inc.type === 'offline'
                            ? 'bg-rose-50 text-rose-700'
                            : inc.type === 'stuck'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {inc.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-300">
                      {new Date(inc.openedAt).toLocaleString('lt-LT')}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-300">
                      {inc.closedAt
                        ? new Date(inc.closedAt).toLocaleString('lt-LT')
                        : '— atvira'}
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-2 text-xs text-gray-500">
                      {inc.detail || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
