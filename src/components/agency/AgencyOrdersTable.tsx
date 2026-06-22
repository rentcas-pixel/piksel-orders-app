'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Order } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { downloadExcel } from '@/lib/export-excel';
import {
  buildAgencyOrdersFilter,
  type AgencyListFilters,
  type AgencyPeriodTab,
  isRecentlyUpdated,
} from '@/lib/agency-orders';

interface AgencyOrdersTableProps {
  agency: string;
  searchQuery: string;
  filters: AgencyListFilters;
  periodTab: AgencyPeriodTab;
  onOrderClick: (order: Order) => void;
}

export function AgencyOrdersTable({
  agency,
  searchQuery,
  filters,
  periodTab,
  onOrderClick,
}: AgencyOrdersTableProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortField, setSortField] = useState('updated');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [exporting, setExporting] = useState(false);

  const buildFilterString = useCallback(
    () =>
      buildAgencyOrdersFilter({
        agency,
        searchQuery,
        filters,
        periodTab,
      }),
    [agency, searchQuery, filters, periodTab]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [agency, searchQuery, filters.status, filters.month, filters.year, filters.client, periodTab, sortField, sortDirection]);

  useEffect(() => {
    if (!agency.trim()) {
      setOrders([]);
      setTotalItems(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      try {
        setLoading(true);
        const result = await PocketBaseService.getOrders({
          page: currentPage,
          perPage: 20,
          sort: `${sortDirection === 'desc' ? '-' : ''}${sortField}`,
          filter: buildFilterString(),
        });
        setOrders(result.items || []);
        setTotalPages(result.totalPages || 1);
        setTotalItems(result.totalItems || 0);
      } catch {
        setOrders([]);
        setTotalPages(1);
        setTotalItems(0);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [agency, currentPage, buildFilterString, sortField, sortDirection]);

  const handleExportExcel = useCallback(async () => {
    if (!agency.trim()) return;
    setExporting(true);
    try {
      const result = await PocketBaseService.getOrders({
        page: 1,
        perPage: 500,
        sort: `${sortDirection === 'desc' ? '-' : ''}${sortField}`,
        filter: buildFilterString(),
      });
      const items = result.items || [];
      const periodLabel =
        periodTab === 'current'
          ? 'einamos'
          : periodTab === 'future'
            ? 'busimos'
            : periodTab === 'past'
              ? 'buvusios'
              : 'visos';
      const data: unknown[][] = [
        ['Klientas', 'Užsakymo Nr.', 'Statusas', 'Media', 'Data nuo', 'Data iki', 'Kaina'],
        ...items.map((o) => [
          o.client,
          String(o.invoice_id),
          o.approved ? 'Patvirtinta' : 'Nepatvirtinta',
          o.approved ? (o.media_received ? 'Gauta' : 'Ne') : '—',
          format(new Date(o.from), 'yyyy-MM-dd'),
          format(new Date(o.to), 'yyyy-MM-dd'),
          o.final_price ?? 0,
        ]),
      ];
      const safeAgency = agency.replace(/[^\w.-]+/g, '_');
      downloadExcel(data, `Kampanijos_${safeAgency}_${periodLabel}`);
    } catch {
      console.error('Export failed');
    } finally {
      setExporting(false);
    }
  }, [agency, buildFilterString, sortField, sortDirection, periodTab]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <span className="text-gray-300">↕</span>;
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'yyyy-MM-dd');
    } catch {
      return dateString;
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('lt-LT', { style: 'currency', currency: 'EUR' }).format(price);

  const getStatusBadge = (approved: boolean) => (
    <span
      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
        approved
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
      }`}
    >
      {approved ? 'Patvirtinta' : 'Nepatvirtinta'}
    </span>
  );

  const getMediaBadge = (order: Order) => {
    if (!order.approved) {
      return <span className="text-sm text-gray-400 dark:text-gray-500">—</span>;
    }
    return (
      <span
        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          order.media_received
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
        }`}
      >
        {order.media_received ? 'Gauta' : 'Ne'}
      </span>
    );
  };

  if (!agency.trim()) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
        Pasirinkite agentūrą, kad pamatytumėte kampanijas.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Kraunama...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kampanijos</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting || totalItems === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            {exporting ? 'Eksportuojama...' : 'Excel'}
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">{totalItems} užsakymų</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {[
                ['client', 'Klientas'],
                ['invoice_id', 'Užsakymo Nr.'],
                ['approved', 'Statusas'],
                ['media_received', 'Media'],
                ['from', 'Data nuo'],
                ['to', 'Data iki'],
                ['final_price', 'Kaina'],
              ].map(([field, label]) => (
                <th
                  key={field}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort(field)}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {getSortIcon(field)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  Kampanijų nerasta.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => onOrderClick(order)}
                  className="hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      {order.client}
                      {isRecentlyUpdated(order.updated) && (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
                          Atnaujinta
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {order.invoice_id}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(order.approved)}</td>
                  <td className="px-4 py-3">{getMediaBadge(order)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {formatDate(order.from)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {formatDate(order.to)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                    {formatPrice(order.final_price ?? 0)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
          >
            Ankstesnis
          </button>
          <span className="text-sm text-gray-500">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
          >
            Kitas
          </button>
        </div>
      )}
    </div>
  );
}
