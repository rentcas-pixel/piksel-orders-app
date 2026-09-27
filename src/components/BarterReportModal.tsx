'use client';

import { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Order } from '@/types';
import { fetchCampaignPlays, type CampaignScreenPlays } from '@/lib/player-devices';

type StoredPlays = {
  name: string;
  stored: boolean;
  total: number;
  byDay: Record<string, number>;
};

const NOT_STORED =
  'Tikri parodymai dar nekaupiami. Grotuvas šio barterio parodymų skaičiaus neišsaugojo, todėl skaičiai nepateikiami.';

function screenPlays(
  screens: Record<string, CampaignScreenPlays>,
  name: string
): StoredPlays {
  const key = name.trim().toLocaleLowerCase('lt-LT');
  const hit = screens[key];
  if (!hit) return { name, stored: false, total: 0, byDay: {} };
  const byDay = Object.fromEntries(
    Object.entries(hit.byDay || {}).filter(([, count]) => Number(count) > 0)
  );
  return { name, stored: true, total: Number(hit.total) || 0, byDay };
}

export function BarterReportModal({
  order,
  isOpen,
  onClose,
}: {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StoredPlays[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isOpen || !order) return;
    let cancelled = false;
    setLoading(true);
    setNote('');
    setRows([]);
    void (async () => {
      const selected = order.details?.barterScreens || [];
      const names = selected.map((screen) => screen.name).filter(Boolean);
      const result = await fetchCampaignPlays(order.id);
      if (cancelled) return;
      if (!result.ok || !result.data) {
        setNote(NOT_STORED);
        setLoading(false);
        return;
      }
      const parsed = (names.length ? names : Object.keys(result.data.screens)).map((name) =>
        screenPlays(result.data?.screens || {}, name)
      );
      const anyStored = parsed.some((row) => row.stored);
      if (!anyStored) {
        setNote(NOT_STORED);
        setRows([]);
      } else {
        setRows(parsed);
        setNote('');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barter-report-title"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="barter-report-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Barterio ataskaita
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{order.client}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Uždaryti"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Tikrinami tikri parodymai…</p>
        ) : note ? (
          <p className="text-sm text-gray-700 dark:text-gray-200">{note}</p>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.name} className="border-b border-gray-100 pb-3 dark:border-gray-700">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">{row.name}</span>
                  {row.stored ? (
                    <span className="tabular-nums text-gray-900 dark:text-white">{row.total}</span>
                  ) : (
                    <span className="text-gray-500">nekaupiama</span>
                  )}
                </div>
                {row.stored && Object.keys(row.byDay).length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-xs text-gray-500">
                    {Object.entries(row.byDay)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([day, count]) => (
                        <li key={day} className="flex justify-between gap-3">
                          <span>{day}</span>
                          <span className="tabular-nums">{count}</span>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
