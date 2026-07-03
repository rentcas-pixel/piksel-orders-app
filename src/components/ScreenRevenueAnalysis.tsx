'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Order } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { calculateScreenRevenuesForPeriod, getDaysInRange, resolveRevenueAnalysisPeriod } from '@/lib/screen-revenue';
import { format } from 'date-fns';
import { downloadExcel } from '@/lib/export-excel';
import { resolveListMonthYear } from '@/lib/orders-filters';
import { foldSearchText } from '@/lib/company-name-match';
import { FilterDropdown } from '@/components/FilterDropdown';
import { PortalSearchField } from '@/components/PortalSearchField';
import {
  portalCardClass,
  portalExportBtnClass,
  portalRowHoverClass,
  portalStickyThBgClass,
  portalStickyThClass,
  portalStickyTheadClass,
  portalTableScrollClass,
  portalToolbarClass,
} from '@/lib/portal-ui';

const MONTH_NAMES = ['Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis', 'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'];

function formatRevenuePeriodTitle(month: string, year: string): string {
  if (!month.trim()) return year;
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
}

const REVENUE_CACHE_TTL = 5 * 60 * 1000; // 5 min
const revenueCache = new Map<string, { revenues: ReturnType<typeof calculateScreenRevenuesForPeriod>; expires: number }>();

interface ScreenRevenueAnalysisProps {
  filters: { month: string; year: string; status: string };
  onEditOrder?: (order: Order) => void;
  refreshKey?: number; // Kai pasikeičia – išvalo cache ir perkrauna
}

export function ScreenRevenueAnalysis({ filters, onEditOrder, refreshKey }: ScreenRevenueAnalysisProps) {
  const [loading, setLoading] = useState(true);
  const [revenues, setRevenues] = useState<ReturnType<typeof calculateScreenRevenuesForPeriod>>([]);
  const [expandedScreen, setExpandedScreen] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [screenSearch, setScreenSearch] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('');
  const [ownerByScreenId, setOwnerByScreenId] = useState<Record<string, string>>({});
  const [ownerOptions, setOwnerOptions] = useState<Array<{ id: string; name: string }>>([]);
  const ownerFilterOptions = useMemo(
    () => [
      { value: '', label: 'Visi owneriai' },
      ...ownerOptions.map((owner) => ({ value: owner.id, label: owner.name })),
    ],
    [ownerOptions]
  );
  const abortRef = useRef<AbortController | null>(null);
  const resolvedPeriod = useMemo(
    () => resolveListMonthYear(filters.month, filters.year),
    [filters.month, filters.year]
  );
  const analysisPeriod = useMemo(
    () => resolveRevenueAnalysisPeriod(resolvedPeriod.month, resolvedPeriod.year),
    [resolvedPeriod.month, resolvedPeriod.year]
  );
  const periodTitle = formatRevenuePeriodTitle(resolvedPeriod.month, resolvedPeriod.year);

  const filteredRevenues = useMemo(() => {
    let rows = revenues;
    if (selectedOwner) {
      rows = rows.filter((r) => ownerByScreenId[r.screenId] === selectedOwner);
    }
    const q = foldSearchText(screenSearch);
    if (q) {
      rows = rows.filter(
        (r) =>
          foldSearchText(r.screenName).includes(q) ||
          foldSearchText(r.screenCity).includes(q)
      );
    }
    return rows;
  }, [revenues, ownerByScreenId, selectedOwner, screenSearch]);

  const handleExportExcel = useCallback(() => {
    setExporting(true);
    try {
      const monthName = `${formatRevenuePeriodTitle(resolvedPeriod.month, resolvedPeriod.year).replace(' ', '_')}`;
      const data: unknown[][] = [
        ['Nr.', 'Ekranas', 'Owner', 'Miestas', 'Pajamos', 'Užsakymai'],
        ...filteredRevenues.map((r, i) => [
          i + 1,
          r.screenName,
          ownerByScreenId[r.screenId] || 'Nepriskirtas',
          r.screenCity || '',
          Number(r.totalRevenue.toFixed(2)),
          r.orderCount,
        ]),
      ];
      downloadExcel(data, `Ekranu_pajamos_${monthName}`);
    } finally {
      setExporting(false);
    }
  }, [filteredRevenues, ownerByScreenId, resolvedPeriod.month, resolvedPeriod.year]);

  const fetchData = useCallback(async () => {
    const cacheKey = `${resolvedPeriod.month || 'all'}-${resolvedPeriod.year}`;
    const cached = revenueCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      setRevenues(cached.revenues);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const filterParts = [
        'approved=true',
        `(from<="${analysisPeriod.endDate}" && to>="${analysisPeriod.startDate}")`,
      ];
      const filterString = filterParts.join(' && ');

      const result = await PocketBaseService.getOrders({
        page: 1,
        perPage: 500,
        sort: '-updated',
        filter: filterString,
      });

      const items = result.items || [];
      const screenIds = [...new Set(items.flatMap(o => o.screens || []).filter(Boolean))];
      const [screenNames, partners] = await Promise.all([
        PocketBaseService.getScreensWithPartner(screenIds),
        PocketBaseService.getPartners(),
      ]);
      const calculated = calculateScreenRevenuesForPeriod(items, screenNames, analysisPeriod);
      const partnerNameById = new Map(partners.map((p) => [p.id, p.name]));
      const nextOwnerByScreenId: Record<string, string> = {};

      for (const revenue of calculated) {
        const partnerId = screenNames[revenue.screenId]?.partner;
        nextOwnerByScreenId[revenue.screenId] = partnerId
          ? partnerNameById.get(partnerId) || 'Nežinomas owner'
          : 'Nepriskirtas';
      }
      const nextOwnerOptions = Array.from(new Set(Object.values(nextOwnerByScreenId)))
        .sort((a, b) => a.localeCompare(b, 'lt-LT'))
        .map((name) => ({ id: name, name }));

      setRevenues(calculated);
      setOwnerByScreenId(nextOwnerByScreenId);
      setOwnerOptions(nextOwnerOptions);
      revenueCache.set(cacheKey, { revenues: calculated, expires: Date.now() + REVENUE_CACHE_TTL });
    } catch {
      setRevenues([]);
      setOwnerByScreenId({});
      setOwnerOptions([]);
    } finally {
      setLoading(false);
    }
  }, [analysisPeriod, resolvedPeriod.month, resolvedPeriod.year]);

  useEffect(() => {
    if (selectedOwner && !ownerOptions.some((o) => o.id === selectedOwner)) {
      setSelectedOwner('');
    }
  }, [selectedOwner, ownerOptions]);

  useEffect(() => {
    if (refreshKey !== undefined) revenueCache.clear();
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData, refreshKey]);

  if (loading) {
    return (
      <div className={`${portalCardClass} p-6`}>
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (revenues.length === 0) {
    return (
      <div className={`${portalCardClass} p-6`}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Ekranų pajamos – {periodTitle}
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          {resolvedPeriod.month.trim()
            ? 'Šiame mėnesyje nėra patvirtintų užsakymų su ekranais arba užsakymai neturi ekranų ID.'
            : `Šiais metais (${resolvedPeriod.year}) nėra patvirtintų užsakymų su ekranais arba užsakymai neturi ekranų ID.`}
        </p>
      </div>
    );
  }

  const totalRevenue = filteredRevenues.reduce((sum, r) => sum + r.totalRevenue, 0);

  return (
    <div className={portalCardClass}>
      <div className={`${portalToolbarClass} flex-wrap items-end gap-3`}>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Ekranų pajamos – {periodTitle}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Bendros pajamos: €{totalRevenue.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          <PortalSearchField
            value={screenSearch}
            onChange={setScreenSearch}
            placeholder="Ieškoti pagal ekrano pavadinimą…"
            className="w-full sm:w-56 md:w-64 sm:mr-0.5"
          />
          <FilterDropdown
            value={selectedOwner}
            options={ownerFilterOptions}
            placeholder="Owneris"
            onChange={setSelectedOwner}
            className="w-full sm:w-44"
          />
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className={portalExportBtnClass}
          >
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            {exporting ? 'Eksportuojama...' : 'Excel'}
          </button>
        </div>
      </div>

      <div className={portalTableScrollClass}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className={portalStickyTheadClass}>
            <tr>
              <th className={`${portalStickyThClass} w-12`}>
                Nr.
              </th>
              <th className={portalStickyThClass}>
                Ekranas (name)
              </th>
              <th className={portalStickyThClass}>
                Owner
              </th>
              <th className={portalStickyThClass}>
                Pajamos
              </th>
              <th className={portalStickyThClass}>
                Užsakymai
              </th>
              <th className={`${portalStickyThBgClass} px-4 py-3 w-10`}></th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredRevenues.map((r, index) => (
              <React.Fragment key={r.screenId}>
                <tr
                  key={r.screenId}
                  className={portalRowHoverClass}
                  onClick={() => setExpandedScreen(expandedScreen === r.screenId ? null : r.screenId)}
                >
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {r.screenName}
                    {r.screenCity && (
                      <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                        ({r.screenCity})
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {ownerByScreenId[r.screenId] || 'Nepriskirtas'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    €{r.totalRevenue.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {r.orderCount}
                  </td>
                  <td className="px-6 py-4">
                    {expandedScreen === r.screenId ? (
                      <span className="text-gray-400">▼</span>
                    ) : (
                      <span className="text-gray-400">▶</span>
                    )}
                  </td>
                </tr>
                {expandedScreen === r.screenId && r.byMonth[0]?.orders && (
                  <tr key={`${r.screenId}-details`} className="bg-gray-50 dark:bg-gray-700/50">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="text-sm space-y-2">
                        <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Užsakymai, prisidėję prie „{r.screenName}“:
                        </p>
                        {r.byMonth[0].orders.map(({ order, daysInMonth, screenPrice }) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600"
                          >
                            <div>
                              <span
                                className={onEditOrder ? 'text-blue-600 dark:text-blue-400 hover:underline cursor-pointer' : ''}
                                onClick={(e) => onEditOrder && (e.stopPropagation(), onEditOrder(order))}
                              >
                                {order.client} / {order.agency} ({order.invoice_id})
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 ml-2">
                                {format(new Date(order.from), 'yyyy-MM-dd')} – {format(new Date(order.to), 'yyyy-MM-dd')}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-medium">
                                €{((screenPrice / getDaysInRange(order.from, order.to)) * daysInMonth).toFixed(2)}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 ml-1">
                                ({daysInMonth} d.)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {filteredRevenues.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
                  {screenSearch.trim()
                    ? 'Pagal paiešką ekranų nerasta.'
                    : selectedOwner
                      ? 'Pasirinktam owneriui šiame mėnesyje nėra duomenų.'
                      : 'Duomenų nerasta.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
