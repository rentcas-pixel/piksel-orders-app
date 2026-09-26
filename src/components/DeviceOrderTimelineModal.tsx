'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  buildDeviceOrderTimeline,
  buildDeviceOrderTimelineExcelRows,
  deviceOrderTimelineExportFilename,
  formatTimelineTimestamp,
  type DeviceOrderTimelineEvent,
  type DeviceOrderTimelineKind,
} from '@/lib/device-order-timeline';
import { downloadExcel } from '@/lib/export-excel';
import { listOrderClips } from '@/lib/order-clips';
import { normalizeScreenKey } from '@/lib/post-campaign-report';
import {
  fetchCampaignPlays,
  type PlayerCampaign,
  type PlayerDevice,
} from '@/lib/player-devices';
import { PocketBaseService } from '@/lib/pocketbase';
import { modalBtnPrimary, modalBtnSecondary } from '@/lib/portal-ui';
import { getTestOrder } from '@/lib/test-orders';

type DeviceOrderTimelineModalProps = {
  isOpen: boolean;
  device: PlayerDevice;
  campaign: PlayerCampaign;
  onClose: () => void;
};

function kindBadgeClass(kind: DeviceOrderTimelineKind): string {
  if (kind === 'upload') {
    return 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200';
  }
  if (kind === 'publish') {
    return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
  }
  if (kind === 'play' || kind === 'first_play') {
    return 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200';
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
}

function EventRow({ event }: { event: DeviceOrderTimelineEvent }) {
  return (
    <li className="flex gap-3 border-b border-gray-100 px-5 py-3 last:border-0 dark:border-gray-700/80">
      <time
        dateTime={event.at}
        className="w-[11.5rem] shrink-0 font-mono text-[13px] tabular-nums text-gray-900 dark:text-gray-100"
      >
        {formatTimelineTimestamp(event.at)}
      </time>
      <div className="min-w-0 flex-1">
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${kindBadgeClass(event.kind)}`}
        >
          {event.label}
        </span>
        {event.detail ? (
          <div className="mt-1 truncate text-sm text-gray-600 dark:text-gray-300">
            {event.detail}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function DeviceOrderTimelineModal({
  isOpen,
  device,
  campaign,
  onClose,
}: DeviceOrderTimelineModalProps) {
  const [events, setEvents] = useState<DeviceOrderTimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playsHint, setPlaysHint] = useState<string | null>(null);

  const title = useMemo(() => {
    const local = getTestOrder(campaign.id);
    const client = String(local?.client || campaign.client || '').trim();
    return client || campaign.id;
  }, [campaign.client, campaign.id]);

  useEffect(() => {
    if (!isOpen) {
      setEvents([]);
      setError(null);
      setLoading(false);
      setPlaysHint(null);
      return;
    }

    let cancelled = false;
    const campaignId = campaign.id;
    const campaignSnapshot = campaign;

    const load = async () => {
      setLoading(true);
      setError(null);
      setPlaysHint(null);
      try {
        const [clips, playsResult, orderPublishedAt] = await Promise.all([
          listOrderClips(campaignId).catch(() => []),
          fetchCampaignPlays(campaignId),
          (async () => {
            const test = getTestOrder(campaignId);
            if (test?.details?.live?.publishedAt) {
              return String(test.details.live.publishedAt);
            }
            if (String(campaignId).startsWith('test-')) return null;
            try {
              const order = await PocketBaseService.getOrder(campaignId);
              return order?.details?.live?.publishedAt
                ? String(order.details.live.publishedAt)
                : null;
            } catch {
              return null;
            }
          })(),
        ]);

        if (cancelled) return;

        const screenKey = normalizeScreenKey(device.screenName);
        const screenPlays =
          playsResult.ok && playsResult.data
            ? playsResult.data.screens[screenKey] || null
            : null;

        const next = buildDeviceOrderTimeline({
          screenName: device.screenName,
          campaign: campaignSnapshot,
          orderPublishedAt,
          clips,
          screenPlays,
        });
        setEvents(next);

        if (!playsResult.ok) {
          setPlaysHint(
            playsResult.error ||
              'Nepavyko gauti play duomenų — rodomi įkėlimai / publish.'
          );
        } else if (!screenPlays || screenPlays.total <= 0) {
          setPlaysHint(
            'Šiam ekranui dar nėra užfiksuotų play įvykių (pasirodymai atsiras po paleidimo).'
          );
        } else if (!screenPlays.events?.length) {
          setPlaysHint(
            'Yra parodymai, bet be pilnos laikų istorijos (seni duomenys) — rodomas first/last play.'
          );
        } else {
          setPlaysHint(
            `${screenPlays.events.length} pasirodym${
              screenPlays.events.length === 1 ? 'as' : 'ai'
            } šiame ekrane.`
          );
        }
      } catch (err) {
        if (!cancelled) {
          setEvents([]);
          setError(
            err instanceof Error ? err.message : 'Nepavyko užkrauti išklotinės'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, device.screenName, campaign]);

  const handleExportXls = () => {
    if (!events.length) return;
    const client = title;
    const rows = buildDeviceOrderTimelineExcelRows({
      events,
      screenName: device.screenName,
      deviceCode: device.deviceCode,
      campaignId: campaign.id,
      client,
    });
    const filename = deviceOrderTimelineExportFilename({
      screenName: device.screenName,
      deviceCode: device.deviceCode,
      campaignId: campaign.id,
      client,
    });
    downloadExcel(rows, filename);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-order-timeline-title"
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div>
            <h2
              id="device-order-timeline-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              Iškloinė
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {device.screenName} · {device.deviceCode}
            </p>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
              {title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label="Uždaryti"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500">
              Kraunama…
            </div>
          ) : error ? (
            <div className="px-5 py-10 text-center text-sm text-rose-600 dark:text-rose-400">
              {error}
            </div>
          ) : events.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500">
              Įvykių nėra — nėra įkėlimų, publish ar play šiam ekranui.
            </div>
          ) : (
            <ul>
              {events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-3 dark:border-gray-700">
          {playsHint ? (
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              {playsHint}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onClose} className={modalBtnSecondary}>
              Uždaryti
            </button>
            <button
              type="button"
              disabled={loading || events.length === 0}
              onClick={handleExportXls}
              className={`inline-flex items-center gap-1.5 ${modalBtnPrimary}`}
            >
              <ArrowDownTrayIcon className="h-4 w-4 shrink-0" />
              .xls
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
