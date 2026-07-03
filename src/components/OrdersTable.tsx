'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowDownTrayIcon, DocumentTextIcon, PaperAirplaneIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/solid';
import { Order, OrderInvoiceStatus } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { SupabaseService } from '@/lib/supabase-service';
import { format } from 'date-fns';
import { downloadExcel } from '@/lib/export-excel';
import type { TableTheme } from '@/lib/order-design-variants';
import { getTableTheme } from '@/lib/table-theme';
import { buildOrdersListFilter, resolveListMonthYear, type OrdersListFilters, type OrdersPeriodTab } from '@/lib/orders-filters';
import { isMultiMonthOrder } from '@/lib/invoice-utils';
import { resolveBillingContext } from '@/lib/invoice-month-status';
import { StatusIconButton } from '@/components/StatusIconButton';
import {
  portalExportBtnClass,
  portalStickyThBgClass,
  portalStickyThClass,
  portalStickyTheadClass,
  portalTableScrollClass,
  portalToolbarClass,
} from '@/lib/portal-ui';
import { PortalSearchField } from '@/components/PortalSearchField';

interface OrdersTableProps {
  searchQuery: string;
  searchInput?: string;
  onSearchInputChange?: (query: string) => void;
  filters: OrdersListFilters;
  onEditOrder: (order: Order) => void;
  onGenerateInvoice?: (order: Order) => void;
  variant?: TableTheme;
  portalStyle?: boolean;
  periodTab?: OrdersPeriodTab;
}

export function OrdersTable({
  searchQuery,
  searchInput,
  onSearchInputChange,
  filters,
  onEditOrder,
  onGenerateInvoice,
  variant = 'default',
  portalStyle = false,
  periodTab = 'all',
}: OrdersTableProps) {
  const t = getTableTheme(variant);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortField, setSortField] = useState<string>('updated');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [exporting, setExporting] = useState(false);
  const [invoiceStatuses, setInvoiceStatuses] = useState<Record<string, OrderInvoiceStatus>>({});
  const [orderActivityMap, setOrderActivityMap] = useState<Record<string, boolean>>({});

  // Function to check if media alert should be shown
  const shouldShowMediaAlert = (order: Order): boolean => {
    if (!order.approved || order.media_received) {
      return false;
    }

    try {
      const fromDate = new Date(order.from);
      const today = new Date();
      const timeDiff = fromDate.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      // Show alert if: 2 days or less remaining, OR deadline has passed, OR today
      return daysDiff <= 2;
    } catch {
      return false;
    }
  };

  const billingContext = useMemo(
    () => resolveBillingContext(filters.month, filters.year),
    [filters.month, filters.year]
  );

  const getInvoiceStatus = useCallback(
    (orderId: string) => invoiceStatuses[orderId] ?? null,
    [invoiceStatuses]
  );

  const getInvoiceIssued = useCallback(
    (order: Order) => {
      const status = getInvoiceStatus(order.id);
      return status?.invoice_issued ?? !!order.invoice_sent;
    },
    [getInvoiceStatus]
  );

  const getInvoiceSent = useCallback(
    (orderId: string) => getInvoiceStatus(orderId)?.invoice_sent ?? false,
    [getInvoiceStatus]
  );

  const hasOrderCommentOrScreenshot = useCallback(
    (orderId: string) => orderActivityMap[orderId] ?? false,
    [orderActivityMap]
  );

  const handleToggleInvoiceStatus = async (
    order: Order,
    field: 'invoice_issued' | 'invoice_sent',
    value: boolean
  ) => {
    const previousStatus = invoiceStatuses[order.id];
    const currentIssued = previousStatus?.invoice_issued ?? !!order.invoice_sent;
    const currentSent = previousStatus?.invoice_sent ?? false;

    if (isMultiMonthOrder(order) && billingContext) {
      const nextIssued = field === 'invoice_issued' ? value : currentIssued;
      const nextSent =
        field === 'invoice_sent' ? value : field === 'invoice_issued' && !value ? false : currentSent;
      const optimisticStatus: OrderInvoiceStatus = {
        order_id: order.id,
        invoice_issued: nextIssued,
        invoice_sent: nextSent,
        updated_at: new Date().toISOString(),
      };
      setInvoiceStatuses((prev) => ({
        ...prev,
        [order.id]: optimisticStatus,
      }));
      try {
        if (billingContext.month) {
          await SupabaseService.upsertOrderInvoiceMonthFlags(order.id, billingContext, {
            invoice_issued: nextIssued,
            invoice_sent: nextSent,
          });
        } else {
          await SupabaseService.upsertOrderInvoiceMonthFlagsForOrderYear(order, billingContext.year, {
            invoice_issued: nextIssued,
            invoice_sent: nextSent,
          });
          await SupabaseService.upsertInvoiceStatus(order.id, {
            invoice_issued: nextIssued,
            invoice_sent: nextSent,
          });
        }
      } catch (error) {
        console.error('Error updating month invoice flags:', error);
        setInvoiceStatuses((prev) => {
          const next = { ...prev };
          if (previousStatus) next[order.id] = previousStatus;
          else delete next[order.id];
          return next;
        });
      }
      return;
    }

    const optimisticStatus: OrderInvoiceStatus = {
      order_id: order.id,
      invoice_issued: currentIssued,
      invoice_sent: currentSent,
      updated_at: new Date().toISOString(),
      [field]: value,
    };

    setInvoiceStatuses(prev => ({
      ...prev,
      [order.id]: optimisticStatus,
    }));

    try {
      const savedStatus = await SupabaseService.upsertInvoiceStatus(order.id, {
        invoice_issued: optimisticStatus.invoice_issued,
        invoice_sent: optimisticStatus.invoice_sent,
      });
      setInvoiceStatuses(prev => ({
        ...prev,
        [order.id]: savedStatus,
      }));
    } catch (error) {
      console.error('Error updating invoice status:', error);
      setInvoiceStatuses(prev => {
        const next = { ...prev };
        if (previousStatus) {
          next[order.id] = previousStatus;
        } else {
          delete next[order.id];
        }
        return next;
      });
    }
  };



  const getMockOrders = (): Order[] => [
    {
      id: '1',
      client: 'Ansamblis LIETUVA',
      agency: 'PUBLICIS GROUPE',
      invoice_id: '3481',
      approved: true,
      viaduct: false,
      from: '2025-08-25',
      to: '2025-09-07',
      media_received: true,
      final_price: 1150.64,
      invoice_sent: false,
      updated: '2025-08-22T13:37:44Z'
    },
    {
      id: '2',
      client: 'Perlas momentinės 08 25-08 31',
      agency: 'Open',
      invoice_id: '3545',
      approved: true,
      viaduct: false,
      from: '2025-08-25',
      to: '2025-08-31',
      media_received: true,
      final_price: 5618.25,
      invoice_sent: false,
      updated: '2025-08-22T13:34:37Z'
    },
    {
      id: '3',
      client: 'CCC back to school',
      agency: 'OMG',
      invoice_id: '3546',
      approved: false,
      viaduct: true,
      from: '2025-09-08',
      to: '2025-09-14',
      media_received: false,
      final_price: 282.33,
      invoice_sent: false,
      updated: '2025-08-22T13:23:39Z'
    },
    {
      id: '4',
      client: 'Maxima',
      agency: 'DDB',
      invoice_id: '3547',
      approved: true,
      viaduct: false,
      from: '2025-09-01',
      to: '2025-09-15',
      media_received: true,
      final_price: 1250.00,
      invoice_sent: true,
      updated: '2025-08-22T14:00:00Z'
    },
    {
      id: '5',
      client: 'Lidl',
      agency: 'McCann',
      invoice_id: '3548',
      approved: false,
      viaduct: true,
      from: '2025-09-10',
      to: '2025-09-20',
      media_received: false,
      final_price: 890.50,
      invoice_sent: false,
      updated: '2025-08-22T14:30:00Z'
    }
  ];

  const filterMockOrders = useCallback((orders: Order[]): Order[] => {
    let filtered = [...orders];
    
    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => 
        order.client.toLowerCase().includes(query) ||
        order.agency.toLowerCase().includes(query) ||
        order.invoice_id.toLowerCase().includes(query)
      );
    }
    
    // Status filter
    if (filters.status) {
      if (filters.status === 'taip') {
        filtered = filtered.filter(order => order.approved === true);
      } else if (filters.status === 'ne') {
        filtered = filtered.filter(order => order.approved === false);
      }
    }
    
    // Client filter
    if (filters.client) {
      filtered = filtered.filter(order => 
        order.client.toLowerCase().includes(filters.client.toLowerCase())
      );
    }
    
    // Agency filter
    if (filters.agency) {
      filtered = filtered.filter(order => 
        order.agency.toLowerCase().includes(filters.agency.toLowerCase())
      );
    }

    // Media received filter
    if (filters.media_received) {
      if (filters.media_received === 'true') {
        filtered = filtered.filter(order => order.media_received === true);
      } else if (filters.media_received === 'false') {
        filtered = filtered.filter(order => order.media_received === false);
      }
    }

    // Invoice sent filter
    if (filters.invoice_sent) {
      if (filters.invoice_sent === 'true') {
        filtered = filtered.filter(order => order.invoice_sent === true);
      } else if (filters.invoice_sent === 'false') {
        filtered = filtered.filter(order => order.invoice_sent === false);
      }
    }
    
    // Month and year filter
    const { month: resolvedMonth, year: resolvedYear } = resolveListMonthYear(
      filters.month,
      filters.year
    );
    if (resolvedMonth && resolvedYear) {
      filtered = filtered.filter(order => {
        const filterYear = parseInt(resolvedYear, 10);
        const filterMonth = parseInt(resolvedMonth, 10);
        const orderFrom = new Date(order.from);
        const orderTo = new Date(order.to);
        const monthStart = new Date(filterYear, filterMonth - 1, 1);
        const monthEnd = new Date(filterYear, filterMonth, 0);
        return orderFrom <= monthEnd && orderTo >= monthStart;
      });
    } else if (resolvedYear) {
      filtered = filtered.filter(order => {
        const filterYear = parseInt(resolvedYear, 10);
        const orderFrom = new Date(order.from);
        const orderTo = new Date(order.to);
        const yearStart = new Date(filterYear, 0, 1);
        const yearEnd = new Date(filterYear, 11, 31);
        return orderFrom <= yearEnd && orderTo >= yearStart;
      });
    }
    
    return filtered;
  }, [searchQuery, filters]);

  const sortOrders = useCallback((orders: Order[]): Order[] => {
    return [...orders].sort((a, b) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;
      
      switch (sortField) {
        case 'client':
        case 'agency':
        case 'invoice_id':
          aValue = (a[sortField as keyof Order] as string)?.toLowerCase() || '';
          bValue = (b[sortField as keyof Order] as string)?.toLowerCase() || '';
          break;
        case 'final_price':
          aValue = Number(a.final_price) || 0;
          bValue = Number(b.final_price) || 0;
          break;
        case 'from':
        case 'to':
        case 'updated':
          aValue = new Date(a[sortField as keyof Order] as string);
          bValue = new Date(b[sortField as keyof Order] as string);
          break;
        case 'approved':
          aValue = a.approved ? 1 : 0;
          bValue = b.approved ? 1 : 0;
          break;
        case 'media_received':
          aValue = a.media_received ? 1 : 0;
          bValue = b.media_received ? 1 : 0;
          break;
        default:
          aValue = a[sortField as keyof Order] as string;
          bValue = b[sortField as keyof Order] as string;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sortField, sortDirection]);

  const buildFilterString = useCallback(() => {
    if (portalStyle) {
      return buildOrdersListFilter({
        searchQuery,
        filters,
        periodTab,
      });
    }

    const filtersArray = [];
    
    // Add search query filter
    if (searchQuery.trim()) {
      // Check if searching for "viad" to include viaduct orders
      if (searchQuery.toLowerCase().startsWith('viad')) {
        filtersArray.push(`(client~"${searchQuery}" || agency~"${searchQuery}" || invoice_id~"${searchQuery}" || viaduct=true)`);
      } else {
        filtersArray.push(`(client~"${searchQuery}" || agency~"${searchQuery}" || invoice_id~"${searchQuery}")`);
      }
    }
    
    // Status filter - handle boolean conversion
    if (filters.status) {
      if (filters.status === 'taip') {
        filtersArray.push(`approved=true`);
      } else if (filters.status === 'ne') {
        filtersArray.push(`approved=false`);
      }
    }
    
    // Client filter
    if (filters.client.trim()) {
      filtersArray.push(`client~"${filters.client}"`);
    }
    
    // Agency filter
    if (filters.agency.trim()) {
      filtersArray.push(`agency~"${filters.agency}"`);
    }
    
    // Media received filter
    if (filters.media_received) {
      if (filters.media_received === 'true') {
        filtersArray.push(`media_received=true`);
      } else if (filters.media_received === 'false') {
        filtersArray.push(`media_received=false`);
      }
    }

    // Date filters - show orders that overlap with selected period
    const { month: resolvedMonth, year: resolvedYear } = resolveListMonthYear(
      filters.month,
      filters.year
    );
    if (resolvedMonth && resolvedYear) {
      const y = parseInt(resolvedYear, 10);
      const m = parseInt(resolvedMonth, 10);
      const lastDay = new Date(y, m, 0).getDate(); // last day of month (Feb=28, etc.)
      const startDate = `${resolvedYear}-${resolvedMonth}-01`;
      const endDate = `${resolvedYear}-${resolvedMonth}-${String(lastDay).padStart(2, '0')}`;
      // Show orders that overlap with the selected month:
      // - order starts before month ends AND order ends after month starts
      filtersArray.push(`(from<="${endDate}" && to>="${startDate}")`);
    } else if (resolvedYear) {
      const startDate = `${resolvedYear}-01-01`;
      const endDate = `${resolvedYear}-12-31`;
      // Show orders that overlap with the selected year.
      filtersArray.push(`(from<="${endDate}" && to>="${startDate}")`);
    }
    
    // If no filters, return empty string
    if (filtersArray.length === 0) {
      return '';
    }
    
    const result = filtersArray.join(' && ');
    return result;
  }, [searchQuery, filters, portalStyle, periodTab]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      );
    }
    
    if (sortDirection === 'asc') {
      return (
        <svg className="w-3 h-3 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l4-4 4 4" />
        </svg>
      );
    }
    
    return (
      <svg className="w-3 h-3 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 15l4 4 4-4" />
      </svg>
    );
  };

  const getStatusText = (approved: boolean) => {
    return approved ? 'Patvirtinta' : 'Nepatvirtinta';
  };

  const getStatusColor = (approved: boolean) => {
    if (approved) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  const StatusPill = ({ approved }: { approved: boolean }) => {
    if (t.compact) {
      const dot = approved ? 'bg-emerald-500' : 'bg-rose-500';
      const bg = approved
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/40 dark:text-emerald-300'
        : 'bg-rose-50 text-rose-700 ring-rose-600/10 dark:bg-rose-950/40 dark:text-rose-300';
      return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${bg}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {getStatusText(approved)}
        </span>
      );
    }
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(approved)}`}>
        {getStatusText(approved)}
      </span>
    );
  };

  const BoolPill = ({ value, yesLabel = 'Taip', noLabel = 'Ne' }: { value: boolean; yesLabel?: string; noLabel?: string }) => {
    if (t.compact) {
      const dot = value ? 'bg-emerald-500' : 'bg-gray-400';
      const bg = value
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/40 dark:text-emerald-300'
        : 'bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-800 dark:text-gray-400';
      return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${bg}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {value ? yesLabel : noLabel}
        </span>
      );
    }
    return (
      <span
        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          value
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }`}
      >
        {value ? yesLabel : noLabel}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'yyyy-MM-dd');
    } catch {
      return dateString;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('lt-LT', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  const handleExportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const filterString = buildFilterString();
      const serverSortField = sortField === 'invoice_issued' || sortField === 'invoice_sent' ? 'updated' : sortField;
      const result = await PocketBaseService.getOrders({
        page: 1,
        perPage: 500,
        sort: `${sortDirection === 'desc' ? '-' : ''}${serverSortField}`,
        filter: filterString,
      });
      const items = result.items || [];
      const statusMap = await SupabaseService.getMonthInvoiceStatuses(items, billingContext);
      const invoiceFilteredItems = filters.invoice_sent
        ? items.filter(item => {
            const issued = statusMap[item.id]?.invoice_issued ?? !!item.invoice_sent;
            return filters.invoice_sent === 'true' ? issued : !issued;
          })
        : items;
      const { month: exportMonth, year: exportYear } = resolveListMonthYear(filters.month, filters.year);
      const monthName = exportMonth && exportYear
        ? `${['Sausis','Vasaris','Kovas','Balandis','Gegužė','Birželis','Liepa','Rugpjūtis','Rugsėjis','Spalis','Lapkritis','Gruodis'][parseInt(exportMonth, 10) - 1]}_${exportYear}`
        : 'visi';
      const data: unknown[][] = [
        ['Klientas', 'Agentūra', 'Užsakymo Nr.', 'Statusas', 'Data nuo', 'Data iki', 'Media', 'Kaina', 'Sąskaita', 'Išsiųsta'],
        ...invoiceFilteredItems.map(o => [
          o.client,
          o.agency,
          String(o.invoice_id),
          o.approved ? 'Patvirtinta' : 'Nepatvirtinta',
          format(new Date(o.from), 'yyyy-MM-dd'),
          format(new Date(o.to), 'yyyy-MM-dd'),
          o.media_received ? 'Taip' : 'Ne',
          o.final_price ?? 0,
          (statusMap[o.id]?.invoice_issued ?? !!o.invoice_sent) ? 'Taip' : 'Ne',
          (statusMap[o.id]?.invoice_sent ?? false) ? 'Taip' : 'Ne',
        ]),
      ];
      downloadExcel(data, `Uzsakymai_${monthName}`);
    } catch {
      console.error('Export failed');
    } finally {
      setExporting(false);
    }
  }, [filters, sortField, sortDirection, buildFilterString]);

  // Reset pagination when search/filters/sort changes to avoid invalid states like "Page 2 of 1"
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    filters.status,
    filters.month,
    filters.year,
    filters.client,
    filters.agency,
    filters.media_received,
    filters.invoice_sent,
    sortField,
    sortDirection,
    periodTab,
  ]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const filterString = buildFilterString();
        const invoiceSort = sortField === 'invoice_issued' || sortField === 'invoice_sent';
        const invoiceFilterActive = Boolean(filters.invoice_sent);
        const serverSortField = invoiceSort ? 'updated' : sortField;

        const result = await PocketBaseService.getOrders({
          page: invoiceFilterActive || invoiceSort ? 1 : currentPage,
          perPage: invoiceFilterActive || invoiceSort ? 500 : 20,
          sort: `${sortDirection === 'desc' ? '-' : ''}${serverSortField}`,
          filter: filterString
        });

        const fetchedOrders = result.items || [];
        const statusMap = await SupabaseService.getMonthInvoiceStatuses(fetchedOrders, billingContext);
        setInvoiceStatuses(statusMap);
        const activityMap = await SupabaseService.getOrderCommentOrScreenshotMap(fetchedOrders.map(item => item.id));
        setOrderActivityMap(activityMap);

        let processedOrders = fetchedOrders;
        if (invoiceFilterActive) {
          processedOrders = processedOrders.filter(item => {
            const isIssued = statusMap[item.id]?.invoice_issued ?? !!item.invoice_sent;
            return filters.invoice_sent === 'true' ? isIssued : !isIssued;
          });
        }

        if (invoiceSort) {
          const invoiceSortField = sortField as 'invoice_issued' | 'invoice_sent';
          processedOrders = [...processedOrders].sort((a, b) => {
            const aValue = invoiceSortField === 'invoice_issued'
              ? ((statusMap[a.id]?.invoice_issued ?? !!a.invoice_sent) ? 1 : 0)
              : ((statusMap[a.id]?.invoice_sent ?? false) ? 1 : 0);
            const bValue = invoiceSortField === 'invoice_issued'
              ? ((statusMap[b.id]?.invoice_issued ?? !!b.invoice_sent) ? 1 : 0)
              : ((statusMap[b.id]?.invoice_sent ?? false) ? 1 : 0);
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
          });
        }

        if (invoiceFilterActive || invoiceSort) {
          const perPage = 20;
          const offset = (currentPage - 1) * perPage;
          const paginatedOrders = processedOrders.slice(offset, offset + perPage);
          const computedTotalItems = processedOrders.length;
          const computedTotalPages = Math.max(1, Math.ceil(computedTotalItems / perPage));
          setOrders(paginatedOrders);
          setTotalItems(computedTotalItems);
          setTotalPages(computedTotalPages);
          if (currentPage > computedTotalPages) setCurrentPage(1);
        } else {
          setOrders(processedOrders);
          setTotalPages(result.totalPages);
          setTotalItems(result.totalItems);
        }
      } catch {
        console.error('❌ Failed to fetch orders');
        // For demo purposes, show filtered and sorted mock data
        const mockOrders = getMockOrders();
        const filteredOrders = filterMockOrders(mockOrders);
        const sortedOrders = sortOrders(filteredOrders);
        setOrders(sortedOrders);
        setInvoiceStatuses({});
        setOrderActivityMap({});
        setTotalPages(1);
        setTotalItems(sortedOrders.length);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
    // Only depend on primitives to avoid infinite loops from object/function reference changes.
    // buildFilterString, filterMockOrders, sortOrders, calculateSumAsync are derived from these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchQuery, filters.status, filters.month, filters.year, filters.client, filters.agency, filters.media_received, filters.invoice_sent, sortField, sortDirection, portalStyle, periodTab, billingContext?.month, billingContext?.year]);























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

  if (portalStyle) {
    const portalSortIcon = (field: string) => {
      if (sortField !== field) return <span className="text-gray-300">↕</span>;
      return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
    };

    const portalStatusBadge = (approved: boolean) => (
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

    const portalMediaBadge = (order: Order) => {
      if (!order.approved) {
        return <span className="text-sm text-gray-400 dark:text-gray-500">—</span>;
      }
      return (
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            order.media_received
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}
        >
          {order.media_received ? 'Taip' : 'Ne'}
        </span>
      );
    };

    const portalColumns: [string, string][] = [
      ['client', 'Klientas'],
      ['agency', 'Agentūra'],
      ['invoice_id', 'Užsakymo Nr.'],
      ['approved', 'Statusas'],
      ['from', 'Data nuo'],
      ['to', 'Data iki'],
      ['media_received', 'Media'],
      ['final_price', 'Kaina'],
      ['invoice_issued', 'Sąskaita'],
      ['invoice_sent', 'Išsiųsta'],
    ];

    const portalInvoiceIcon = (
      order: Order,
      field: 'invoice_issued' | 'invoice_sent',
      on: boolean
    ) => {
      const isIssued = field === 'invoice_issued';
      const Icon = isIssued ? DocumentTextIcon : PaperAirplaneIcon;
      const label = isIssued
        ? on
          ? 'Sąskaita išrašyta'
          : 'Sąskaita neišrašyta'
        : on
          ? 'Sąskaita išsiųsta'
          : 'Sąskaita neišsiųsta';

      return (
        <StatusIconButton
          active={on}
          label={label}
          icon={Icon}
          onClick={(e) => {
            e.stopPropagation();
            handleToggleInvoiceStatus(order, field, !on);
          }}
        />
      );
    };

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className={`${portalToolbarClass} flex-wrap items-end gap-3`}>
          <h2 className="min-w-0 flex-1 text-lg font-semibold text-gray-900 dark:text-white">Kampanijos</h2>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            {onSearchInputChange && (
              <PortalSearchField
                value={searchInput ?? searchQuery}
                onChange={onSearchInputChange}
                placeholder="Ieškoti pagal klientą, agentūrą, užsakymo nr..."
                className="w-full sm:w-56 md:w-64"
              />
            )}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting || totalItems === 0}
              className={portalExportBtnClass}
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              {exporting ? 'Eksportuojama...' : 'Excel'}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">{totalItems} užsakymų</span>
          </div>
        </div>

        <div className={portalTableScrollClass}>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={portalStickyTheadClass}>
              <tr>
                {portalColumns.map(([field, label]) => (
                  <th
                    key={field}
                    className={`${portalStickyThClass} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800`}
                    onClick={() => handleSort(field)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {portalSortIcon(field)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={portalColumns.length} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Kampanijų nerasta.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => onEditOrder(order)}
                    className="hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        {order.client}
                        {hasOrderCommentOrScreenshot(order.id) && (
                          <span
                            className="shrink-0 inline-flex text-blue-600 dark:text-blue-400"
                            title="Yra komentaras arba screenshotas"
                          >
                            <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{order.agency || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{order.invoice_id}</td>
                    <td className="px-4 py-3">{portalStatusBadge(order.approved)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDate(order.from)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDate(order.to)}</td>
                    <td className="px-4 py-3">{portalMediaBadge(order)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                      {formatPrice(order.final_price)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {portalInvoiceIcon(order, 'invoice_issued', getInvoiceIssued(order))}
                        {onGenerateInvoice && order.approved && (
                          <button
                            type="button"
                            title="Išrašyti sąskaitą"
                            aria-label="Išrašyti sąskaitą"
                            onClick={(e) => {
                              e.stopPropagation();
                              onGenerateInvoice(order);
                            }}
                            className="inline-flex rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white"
                          >
                            <PlusCircleIcon className="h-5 w-5" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {portalInvoiceIcon(order, 'invoice_sent', getInvoiceSent(order.id))}
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

  return (
    <div className={t.cardClass}>
      {/* Table Header */}
      <div className={`${t.toolbarPad} border-b ${t.toolbarBorder}`}>
        <div className="flex items-center justify-between">
          {t.showTitle && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Užsakymai</h2>
              {sortField && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Rūšiuojama pagal: <span className="font-medium">{sortField} </span>
                  ({sortDirection === 'asc' ? 'didėjimo' : 'mažėjimo'} tvarka)
                </p>
              )}
            </div>
          )}
          {t.showCount && <p className="text-xs text-gray-500 dark:text-gray-400">{totalItems} užsakymų</p>}
          <div className={`flex items-center gap-2 ${t.compact ? 'ml-auto' : 'gap-4'}`}>
            <button onClick={handleExportExcel} disabled={exporting} className={t.exportBtn}>
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />
              {exporting ? 'Eksportuojama...' : 'Excel'}
            </button>
            <span className={`${t.compact ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400`}>
              {t.paginationModern ? `${currentPage} / ${totalPages}` : `Puslapis ${currentPage} iš ${totalPages}`}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={portalTableScrollClass}>
        <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
          <colgroup>
            <col className="w-[14rem]" />
          </colgroup>
          <thead className={`${t.theadClass} sticky top-0 z-10`}>
            <tr>
              <th 
                className={`w-[14rem] max-w-[14rem] ${t.thClass} ${portalStickyThBgClass}`}
                onClick={() => handleSort('client')}
              >
                <div className="flex items-center space-x-1">
                  <span>Klientas</span>
                  {getSortIcon('client')}
                </div>
              </th>
              <th 
                className={`${t.thClass} ${portalStickyThBgClass} ${t.hideAgency ? 'hidden' : ''}`}
                onClick={() => handleSort('agency')}
              >
                <div className="flex items-center space-x-1">
                  <span>Agentūra</span>
                  {getSortIcon('agency')}
                </div>
              </th>
              <th 
                className={`${t.thClass} ${portalStickyThBgClass}`}
                onClick={() => handleSort('invoice_id')}
              >
                <div className="flex items-center space-x-1">
                  <span>Užsakymo Nr.</span>
                  {getSortIcon('invoice_id')}
                </div>
              </th>
              <th 
                className={`${t.thClass} ${portalStickyThBgClass}`}
                onClick={() => handleSort('approved')}
              >
                <div className="flex items-center space-x-1">
                  <span>Statusas</span>
                  {getSortIcon('approved')}
                </div>
              </th>
              <th 
                className={`${t.thClass} ${portalStickyThBgClass}`}
                onClick={() => handleSort('from')}
              >
                <div className="flex items-center space-x-1">
                  <span>Data nuo</span>
                  {getSortIcon('from')}
                </div>
              </th>
              <th 
                className={`${t.thClass} ${portalStickyThBgClass}`}
                onClick={() => handleSort('to')}
              >
                <div className="flex items-center space-x-1">
                  <span>Data iki</span>
                  {getSortIcon('to')}
                </div>
              </th>
              <th 
                className={`${t.thClass} ${portalStickyThBgClass}`}
                onClick={() => handleSort('media_received')}
              >
                <div className="flex items-center space-x-1">
                  <span>Media</span>
                  {getSortIcon('media_received')}
                </div>
              </th>
              <th 
                className={`${t.thClass} ${portalStickyThBgClass}`}
                onClick={() => handleSort('final_price')}
              >
                <div className="flex items-center space-x-1">
                  <span>Kaina</span>
                  {getSortIcon('final_price')}
                </div>
              </th>
              <th 
                className={`${t.thClass} ${portalStickyThBgClass}`}
                onClick={() => handleSort('invoice_issued')}
              >
                <div className="flex items-center space-x-1">
                  <span>Sąskaita</span>
                  {getSortIcon('invoice_issued')}
                </div>
              </th>
              <th 
                className={`${t.thClass} ${portalStickyThBgClass}`}
                onClick={() => handleSort('invoice_sent')}
              >
                <div className="flex items-center space-x-1">
                  <span>Išsiųsta</span>
                  {getSortIcon('invoice_sent')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className={t.tbodyClass}>
            {orders.map((order) => (
              <tr key={order.id} className={`${t.rowHover} transition-colors`}
                onClick={() => onEditOrder(order)}
              >
                <td className={`w-[14rem] max-w-[14rem] ${t.clientCellPad}`}>
                  <div className="min-w-0" title={order.client}>
                    {order.viaduct && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">Viadukai</div>
                    )}
                    <div className="flex items-center min-w-0 gap-1">
                      <span className={`truncate min-w-0 flex-1 ${t.clientFont} text-gray-900 dark:text-white`}>
                        {order.client}
                      </span>
                      {shouldShowMediaAlert(order) && (
                        <span className="shrink-0 text-red-600 animate-pulse" aria-hidden>
                          ⚠️
                        </span>
                      )}
                      {hasOrderCommentOrScreenshot(order.id) && (
                        <span
                          className="shrink-0 inline-flex text-blue-600 dark:text-blue-400"
                          title="Yra komentaras arba screenshotas"
                        >
                          <ChatBubbleLeftEllipsisIcon className={t.compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                        </span>
                      )}
                    </div>
                    {t.hideAgency && order.agency && (
                      <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{order.agency}</p>
                    )}
                  </div>
                </td>
                <td className={`${t.tdPad} whitespace-nowrap ${t.hideAgency ? 'hidden' : ''}`}>
                  <div className={`${t.cellText} text-gray-500 dark:text-gray-400`}>{order.agency || '-'}</div>
                </td>
                <td className={`${t.tdPad} whitespace-nowrap`}>
                  <div className={`${t.cellText} text-gray-900 dark:text-white tabular-nums`}>{order.invoice_id}</div>
                </td>
                <td className={`${t.tdPad} whitespace-nowrap`}>
                  <StatusPill approved={order.approved} />
                </td>
                <td className={`${t.tdPad} whitespace-nowrap`}>
                  <div className={`${t.cellText} text-gray-900 dark:text-white tabular-nums`}>{formatDate(order.from)}</div>
                </td>
                <td className={`${t.tdPad} whitespace-nowrap`}>
                  <div className={`${t.cellText} text-gray-900 dark:text-white tabular-nums`}>{formatDate(order.to)}</div>
                </td>
                <td className={`${t.tdPad} whitespace-nowrap`}>
                  <BoolPill value={order.media_received} />
                </td>
                <td className={`${t.tdPad} whitespace-nowrap`}>
                  <div className={`${t.cellText} font-medium text-gray-900 dark:text-white tabular-nums`}>{formatPrice(order.final_price)}</div>
                </td>
                <td className={`${t.tdPad} whitespace-nowrap`}>
                  <StatusIconButton
                    active={getInvoiceIssued(order)}
                    label={
                      getInvoiceIssued(order)
                        ? 'Sąskaita išrašyta'
                        : 'Sąskaita neišrašyta'
                    }
                    icon={DocumentTextIcon}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleInvoiceStatus(order, 'invoice_issued', !getInvoiceIssued(order));
                    }}
                  />
                </td>
                <td className={`${t.tdPad} whitespace-nowrap`}>
                  <StatusIconButton
                    active={getInvoiceSent(order.id)}
                    label={
                      getInvoiceSent(order.id)
                        ? 'Sąskaita išsiųsta'
                        : 'Sąskaita neišsiųsta'
                    }
                    icon={PaperAirplaneIcon}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleInvoiceStatus(order, 'invoice_sent', !getInvoiceSent(order.id));
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={`${t.toolbarPad} border-t border-gray-200 dark:border-gray-700`}>
          <div className="flex items-center justify-between">
            <div className={`${t.compact ? 'text-xs' : 'text-sm'} text-gray-700 dark:text-gray-300`}>
              {((currentPage - 1) * 20) + 1}–{Math.min(currentPage * 20, totalItems)} / {totalItems}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={
                  t.paginationModern
                    ? 'px-2.5 py-1 text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                    : 'px-3 py-2 text-sm font-medium text-white bg-gray-700 dark:bg-gray-600 border border-gray-600 dark:border-gray-500 rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                }
              >
                ←
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={
                  t.paginationModern
                    ? 'px-2.5 py-1 text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                    : 'px-3 py-2 text-sm font-medium text-white bg-gray-700 dark:bg-gray-600 border border-gray-600 dark:border-gray-500 rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                }
              >
                →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
