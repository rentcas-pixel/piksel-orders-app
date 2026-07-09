'use client';

import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { format } from 'date-fns';
import { ArrowDownTrayIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { Order, type OrderInvoiceStatus } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { SupabaseService } from '@/lib/supabase-service';
import { InvoiceService } from '@/lib/invoice-service';
import { downloadExcel } from '@/lib/export-excel';
import { downloadIssuedInvoicePdf } from '@/lib/invoice-pdf-batch';
import { isInvoiceListable } from '@/lib/invoice-utils';
import { StatusIconButton } from '@/components/StatusIconButton';
import { OrderSpecIndicator } from '@/components/OrderSpecIndicator';
import {
  buildAgencyOrdersFilter,
  type AgencyListFilters,
  type AgencyPeriodTab,
} from '@/lib/agency-orders';
import { resolveListMonthYear } from '@/lib/orders-filters';
import { readInvoiceStatusField, resolveBillingContext } from '@/lib/invoice-month-status';
import { fetchAgencyOrders } from '@/lib/agency-portal-api';

interface AgencyOrdersTableProps {
  agency: string;
  searchQuery: string;
  filters: AgencyListFilters;
  periodTab: AgencyPeriodTab;
  onOrderClick: (order: Order) => void;
  portalMode?: boolean;
}

export function AgencyOrdersTable({
  agency,
  searchQuery,
  filters,
  periodTab,
  onOrderClick,
  portalMode = false,
}: AgencyOrdersTableProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortField, setSortField] = useState('updated');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [exporting, setExporting] = useState(false);
  const [invoiceStatuses, setInvoiceStatuses] = useState<Record<string, OrderInvoiceStatus>>({});
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);

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
        const sort = `${sortDirection === 'desc' ? '-' : ''}${sortField}`;
        const result = portalMode
          ? await fetchAgencyOrders({
              page: currentPage,
              perPage: 20,
              sort,
              searchQuery,
              filters,
              periodTab,
            })
          : await PocketBaseService.getOrders({
              page: currentPage,
              perPage: 20,
              sort,
              filter: buildFilterString(),
            });
        const items = result.items || [];
        setOrders(items);
        setTotalPages(result.totalPages || 1);
        setTotalItems(result.totalItems || 0);

        if (portalMode) {
          setInvoiceStatuses({});
        } else if (items.length > 0) {
          try {
            const billingContext = resolveBillingContext(filters.month, filters.year);
            const statusMap = await SupabaseService.getMonthInvoiceStatuses(items, billingContext);
            setInvoiceStatuses(statusMap);
          } catch {
            setInvoiceStatuses({});
          }
        } else {
          setInvoiceStatuses({});
        }
      } catch {
        setOrders([]);
        setTotalPages(1);
        setTotalItems(0);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [agency, currentPage, buildFilterString, sortField, sortDirection, portalMode, searchQuery, filters, periodTab]);

  const handleExportExcel = useCallback(async () => {
    if (!agency.trim()) return;
    setExporting(true);
    try {
      const sort = `${sortDirection === 'desc' ? '-' : ''}${sortField}`;
      const result = portalMode
        ? await fetchAgencyOrders({
            page: 1,
            perPage: 500,
            sort,
            searchQuery,
            filters,
            periodTab,
          })
        : await PocketBaseService.getOrders({
            page: 1,
            perPage: 500,
            sort,
            filter: buildFilterString(),
          });
      const items = result.items || [];
      let exportStatuses: Record<string, OrderInvoiceStatus> = {};
      try {
        const billingContext = resolveBillingContext(filters.month, filters.year);
        exportStatuses = await SupabaseService.getMonthInvoiceStatuses(items, billingContext);
      } catch {
        exportStatuses = {};
      }
      const periodLabel =
        periodTab === 'current'
          ? 'einamos'
          : periodTab === 'future'
            ? 'busimos'
            : periodTab === 'past'
              ? 'buvusios'
              : 'visos';
      const data: unknown[][] = [
        ['Klientas', 'Užsakymo Nr.', 'Statusas', 'Media', 'Data nuo', 'Data iki', 'Kaina', 'Sąskaita'],
        ...items.map((o) => [
          o.client,
          String(o.invoice_id),
          o.approved ? 'Patvirtinta' : 'Nepatvirtinta',
          o.approved ? (o.media_received ? 'Gauta' : 'Ne') : '—',
          format(new Date(o.from), 'yyyy-MM-dd'),
          format(new Date(o.to), 'yyyy-MM-dd'),
          o.final_price ?? 0,
          o.approved
            ? (readInvoiceStatusField(o, exportStatuses[o.id], 'invoice_issued') ? 'Taip' : 'Ne')
            : '—',
        ]),
      ];
      const safeAgency = agency.replace(/[^\w.-]+/g, '_');
      downloadExcel(data, `Kampanijos_${safeAgency}_${periodLabel}`);
    } catch {
      console.error('Export failed');
    } finally {
      setExporting(false);
    }
  }, [agency, buildFilterString, sortField, sortDirection, periodTab, portalMode, searchQuery, filters]);

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

  const getInvoiceIssued = (order: Order) =>
    readInvoiceStatusField(order, invoiceStatuses[order.id], 'invoice_issued');

  const handleInvoiceIconClick = async (event: MouseEvent, order: Order) => {
    event.stopPropagation();
    if (!getInvoiceIssued(order) || downloadingOrderId) return;

    setDownloadingOrderId(order.id);
    try {
      const invoices = await InvoiceService.getByOrderId(order.id);
      const invoice = invoices.find(isInvoiceListable);
      if (!invoice) {
        alert('Sąskaita nerasta');
        return;
      }
      await downloadIssuedInvoicePdf(invoice);
    } catch (error) {
      console.error('Invoice PDF download:', error);
      alert('Klaida atsisiunčiant PDF');
    } finally {
      setDownloadingOrderId(null);
    }
  };

  const getInvoiceBadge = (order: Order) => {
    if (!order.approved) {
      return <span className="text-sm text-gray-400 dark:text-gray-500">—</span>;
    }
    const issued = getInvoiceIssued(order);
    const downloading = downloadingOrderId === order.id;
    return (
      <StatusIconButton
        active={issued}
        label={
          issued
            ? downloading
              ? 'Ruošiamas PDF…'
              : 'Atsisiųsti sąskaitos PDF'
            : 'Sąskaita neišrašyta'
        }
        icon={DocumentTextIcon}
        onClick={(e) => void handleInvoiceIconClick(e, order)}
        disabled={!issued || downloading}
      />
    );
  };
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
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Sąskaita
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
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
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{order.client}</span>
                      {order.is_spec_order && <OrderSpecIndicator />}
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
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {getInvoiceBadge(order)}
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
