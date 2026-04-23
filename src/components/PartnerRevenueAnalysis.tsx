'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Order } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { calculatePartnerRevenues } from '@/lib/partner-revenue';
import { format } from 'date-fns';
import { downloadExcel } from '@/lib/export-excel';

const MONTH_NAMES = ['Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis', 'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'];

const REVENUE_CACHE_TTL = 5 * 60 * 1000; // 5 min
const partnerRevenueCache = new Map<string, { revenues: ReturnType<typeof calculatePartnerRevenues>; expires: number }>();

interface PartnerRevenueAnalysisProps {
  filters: { month: string; year: string; status: string };
  onEditOrder?: (order: Order) => void;
  refreshKey?: number;
}

export function PartnerRevenueAnalysis({ filters, onEditOrder, refreshKey }: PartnerRevenueAnalysisProps) {
  const [loading, setLoading] = useState(true);
  const [revenues, setRevenues] = useState<ReturnType<typeof calculatePartnerRevenues>>([]);
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleExportExcel = useCallback(() => {
    setExporting(true);
    try {
      const monthName = `${MONTH_NAMES[parseInt(filters.month, 10) - 1]}_${filters.year}`;
      const data: unknown[][] = [
        ['Nr.', 'Partneris', 'Pajamos', 'Užsakymai'],
        ...revenues.map((r, i) => [
          i + 1,
          r.partnerName,
          Number(r.totalRevenue.toFixed(2)),
          r.orderCount,
        ]),
      ];
      downloadExcel(data, `Partneriu_pajamos_${monthName}`);
    } finally {
      setExporting(false);
    }
  }, [revenues, filters.month, filters.year]);

  const fetchData = useCallback(async () => {
    if (!filters.month || !filters.year) return;
    const cacheKey = `partner_${filters.month}-${filters.year}`;
    const cached = partnerRevenueCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      setRevenues(cached.revenues);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const y = parseInt(filters.year, 10);
      const m = parseInt(filters.month, 10);
      const lastDay = new Date(y, m, 0).getDate();
      const startDate = `${filters.year}-${filters.month.padStart(2, '0')}-01`;
      const endDate = `${filters.year}-${filters.month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const filterParts = ['approved=true', `(from<="${endDate}" && to>="${startDate}")`];
      const filterString = filterParts.join(' && ');

      const [ordersResult, partners] = await Promise.all([
        PocketBaseService.getOrders({
          page: 1,
          perPage: 500,
          sort: '-updated',
          filter: filterString,
        }),
        PocketBaseService.getPartners(),
      ]);

      const items = ordersResult.items || [];
      const screenIds = [...new Set(items.flatMap(o => o.screens || []).filter(Boolean))];
      const screensWithPartner = await PocketBaseService.getScreensWithPartner(screenIds);
      const calculated = calculatePartnerRevenues(items, screensWithPartner, partners, y, m);

      setRevenues(calculated);
      partnerRevenueCache.set(cacheKey, { revenues: calculated, expires: Date.now() + REVENUE_CACHE_TTL });
    } catch {
      setRevenues([]);
    } finally {
      setLoading(false);
    }
  }, [filters.month, filters.year]);

  useEffect(() => {
    if (refreshKey !== undefined) partnerRevenueCache.clear();
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData, refreshKey]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Partnerių pajamos – {MONTH_NAMES[parseInt(filters.month, 10) - 1]} {filters.year}
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Šiame mėnesyje nėra patvirtintų užsakymų su ekranais, kurie turi priskirtą partnerį.
        </p>
      </div>
    );
  }

  const totalRevenue = revenues.reduce((sum, r) => sum + r.totalRevenue, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Partnerių pajamos – {MONTH_NAMES[parseInt(filters.month, 10) - 1]} {filters.year}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Bendros pajamos: €{totalRevenue.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <button
          onClick={handleExportExcel}
          disabled={exporting}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
          {exporting ? 'Eksportuojama...' : 'Excel'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Partneris
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Dienų
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Pajamos
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Užsakymai
              </th>
              <th className="px-6 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {revenues.map((r) => (
              <React.Fragment key={r.partnerId}>
                <tr
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => setExpandedPartner(expandedPartner === r.partnerId ? null : r.partnerId)}
                >
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {r.partnerName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {r.totalDays}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    €{r.totalRevenue.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {r.orderCount}
                  </td>
                  <td className="px-6 py-4">
                    {expandedPartner === r.partnerId ? (
                      <span className="text-gray-400">▼</span>
                    ) : (
                      <span className="text-gray-400">▶</span>
                    )}
                  </td>
                </tr>
                {expandedPartner === r.partnerId && r.orders?.length > 0 && (
                  <tr key={`${r.partnerId}-details`} className="bg-gray-50 dark:bg-gray-700/50">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="text-sm space-y-2">
                        <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Užsakymai, prisidėję prie „{r.partnerName}“:
                        </p>
                        {r.orders.map(({ order, daysInMonth, amount }) => (
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
                              <span className="font-medium">€{amount.toFixed(2)}</span>
                              <span className="text-gray-500 dark:text-gray-400 ml-1">({daysInMonth} d.)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
