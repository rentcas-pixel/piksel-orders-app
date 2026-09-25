'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { downloadReklamosPlanasPostCampaign } from '@/lib/export-reklamos-planas';
import {
  buildMediaLabelsFromClips,
  buildPikselPostCampaignReportRows,
  formatReportViews,
  liveShownViewsByScreenId,
  type PostCampaignScreenReportRow,
} from '@/lib/post-campaign-report';
import { POST_CAMPAIGN_EXPORT_LABEL } from '@/lib/reklamos-planas-post-campaign';
import { fetchCampaignPlays } from '@/lib/player-devices';
import { loadCampaignExportData } from '@/lib/agency-orders';
import { listOrderClips } from '@/lib/order-clips';
import { modalBtnPrimary, modalBtnSecondary } from '@/lib/portal-ui';
import {
  daysLeftUntilCampaignEnd,
  formatDateInputValue,
} from '@/lib/date-utils';
import type { Order } from '@/types';

interface OrderAtaskaitaModalProps {
  isOpen: boolean;
  order: Order;
  onClose: () => void;
}

function canExpandClips(row: PostCampaignScreenReportRow): boolean {
  return (row.clips?.length ?? 0) >= 2;
}

export function OrderAtaskaitaModal({
  isOpen,
  order,
  onClose,
}: OrderAtaskaitaModalProps) {
  const [rows, setRows] = useState<PostCampaignScreenReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playsHint, setPlaysHint] = useState<string | null>(null);
  const [periodLabel, setPeriodLabel] = useState('');
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [expandedScreenIds, setExpandedScreenIds] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    if (!isOpen) {
      setRows([]);
      setError(null);
      setLoading(false);
      setExporting(false);
      setPeriodLabel('');
      setDaysLeft(null);
      setPlaysHint(null);
      setExpandedScreenIds(new Set());
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setPlaysHint(null);
      try {
        const [{ campaignOrder, screens, bundles, fullOrder }, playsResult, clips] =
          await Promise.all([
            loadCampaignExportData(order.id, order),
            fetchCampaignPlays(order.id),
            listOrderClips(order.id).catch(() => []),
          ]);
        const livePlays = playsResult.ok ? playsResult.data || null : null;
        const mediaLabels = buildMediaLabelsFromClips(order.id, clips);
        const nextRows = buildPikselPostCampaignReportRows({
          order: {
            ...campaignOrder,
            details: (fullOrder as { details?: Order['details'] }).details,
          },
          screens,
          bundles,
          livePlays,
          mediaLabels,
        });
        if (cancelled) return;
        setRows(nextRows);
        setExpandedScreenIds(new Set());
        const from = formatDateInputValue(campaignOrder.from);
        const to = formatDateInputValue(campaignOrder.to);
        setPeriodLabel(from && to ? `${from} – ${to}` : '');
        setDaysLeft(daysLeftUntilCampaignEnd(campaignOrder.to || order.to));
        const liveCount = nextRows.filter((r) => r.source === 'live').length;
        if (!playsResult.ok) {
          setPlaysHint(
            playsResult.error ||
              'Nepavyko gauti realių parodymų — rodomi apskaičiuoti.'
          );
        } else if (liveCount > 0) {
          setPlaysHint(
            `${liveCount} ekr. su realiais parodymais iš playerio (pvz. Panorama).`
          );
        } else {
          setPlaysHint(
            'Nėra prijungtų Piksel playerių šiam užsakymui — parodymai apskaičiuoti.'
          );
        }
      } catch (err) {
        if (!cancelled) {
          setRows([]);
          setDaysLeft(null);
          setError(
            err instanceof Error
              ? err.message
              : 'Nepavyko užkrauti parodymų ataskaitos.'
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
  }, [isOpen, order.id, order.to]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.planned += row.plannedViews;
        acc.shown += row.shownViews;
        acc.diff += row.difference;
        return acc;
      },
      { planned: 0, shown: 0, diff: 0 }
    );
  }, [rows]);

  const toggleExpanded = (screenId: string) => {
    setExpandedScreenIds((prev) => {
      const next = new Set(prev);
      if (next.has(screenId)) next.delete(screenId);
      else next.add(screenId);
      return next;
    });
  };

  const handleExportXls = async () => {
    setExporting(true);
    setError(null);
    try {
      const [{ campaignOrder, screens, bundles, fullOrder }, playsResult] =
        await Promise.all([
          loadCampaignExportData(order.id, order),
          fetchCampaignPlays(order.id),
        ]);
      const livePlays = playsResult.ok ? playsResult.data || null : null;
      const exportRows = buildPikselPostCampaignReportRows({
        order: {
          ...campaignOrder,
          details: (fullOrder as { details?: Order['details'] }).details,
        },
        screens,
        bundles,
        livePlays,
      });
      await downloadReklamosPlanasPostCampaign({
        order: campaignOrder,
        screens,
        bundles,
        shownViewsByScreenId: liveShownViewsByScreenId(exportRows),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nepavyko sugeneruoti ataskaitos Excel failo'
      );
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-ataskaita-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div>
            <h2
              id="order-ataskaita-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {POST_CAMPAIGN_EXPORT_LABEL}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Piksel ekranų parodymai
              {periodLabel ? ` · ${periodLabel}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            aria-label="Uždaryti"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </p>
          )}
          {playsHint && !error && (
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              {playsHint}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Kraunama…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Šiame užsakyme nėra Piksel ekranų su parodymais.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Ekranas</th>
                    <th className="px-3 py-2 font-medium text-right">Planuota</th>
                    <th className="px-3 py-2 font-medium text-right">Parodymai</th>
                    <th className="px-3 py-2 font-medium text-right">Skirtumas</th>
                    <th
                      className="px-3 py-2 font-medium text-right"
                      title="Liko dienų iki kampanijos pabaigos"
                    >
                      Liko dienų
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {rows.map((row) => {
                    const expandable = canExpandClips(row);
                    const expanded = expandable && expandedScreenIds.has(row.screenId);
                    return (
                      <Fragment key={row.screenId}>
                        <tr className="bg-white dark:bg-gray-800">
                          <td className="px-3 py-2 text-gray-900 dark:text-white">
                            <div className="flex flex-wrap items-center gap-2">
                              {expandable ? (
                                <button
                                  type="button"
                                  onClick={() => toggleExpanded(row.screenId)}
                                  className="inline-flex items-center gap-1 rounded-md text-left font-medium hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:text-emerald-300"
                                  aria-expanded={expanded}
                                  title="Rodyti klipų parodyimus"
                                >
                                  {expanded ? (
                                    <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                  ) : (
                                    <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                  )}
                                  {row.name}
                                </button>
                              ) : (
                                <span className="font-medium">{row.name}</span>
                              )}
                              {row.source === 'live' ? (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                                  Live
                                </span>
                              ) : (
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                                  Skaič.
                                </span>
                              )}
                            </div>
                            {row.city ? (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {row.city}
                              </div>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                            {formatReportViews(row.plannedViews)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">
                            {formatReportViews(row.shownViews)}
                          </td>
                          <td
                            className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${
                              row.difference >= 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {row.difference >= 0 ? '+' : ''}
                            {formatReportViews(row.difference)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-200">
                            {daysLeft === null ? '—' : formatReportViews(daysLeft)}
                          </td>
                        </tr>
                        {expanded
                          ? row.clips!.map((clip) => (
                              <tr
                                key={`${row.screenId}:${clip.mediaId}`}
                                className="bg-gray-50/80 dark:bg-gray-900/40"
                              >
                                <td className="px-3 py-1.5 pl-9 text-xs text-gray-600 dark:text-gray-300">
                                  {clip.name}
                                </td>
                                <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs tabular-nums text-gray-400">
                                  —
                                </td>
                                <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs tabular-nums font-medium text-gray-800 dark:text-gray-100">
                                  {formatReportViews(clip.shownViews)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs tabular-nums text-gray-400">
                                  —
                                </td>
                                <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs tabular-nums text-gray-400">
                                  —
                                </td>
                              </tr>
                            ))
                          : null}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                  <tr>
                    <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Viso ({rows.length})
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-200">
                      {formatReportViews(totals.planned)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                      {formatReportViews(totals.shown)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-2 text-right text-sm font-semibold tabular-nums ${
                        totals.diff >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {totals.diff >= 0 ? '+' : ''}
                      {formatReportViews(totals.diff)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-200">
                      {daysLeft === null ? '—' : formatReportViews(daysLeft)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <button type="button" onClick={onClose} className={modalBtnSecondary}>
            Uždaryti
          </button>
          <button
            type="button"
            disabled={exporting || loading}
            onClick={() => void handleExportXls()}
            className={`inline-flex items-center gap-1.5 ${modalBtnPrimary}`}
          >
            {exporting ? (
              <span className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-white/70 dark:bg-gray-700" />
            ) : (
              <ArrowDownTrayIcon className="h-4 w-4 shrink-0" />
            )}
            .xls
          </button>
        </div>
      </div>
    </div>
  );
}
