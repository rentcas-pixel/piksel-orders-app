'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/solid';
import { Order, OrderInvoiceStatus } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { SupabaseService } from '@/lib/supabase-service';
import { format } from 'date-fns';
import { downloadExcel } from '@/lib/export-excel';
import { getDaysInMonth, getDaysInRange } from '@/lib/screen-revenue';

interface OrdersTableProps {
  searchQuery: string;
  filters: {
    status: string;
    month: string;
    year: string;
    client: string;
    agency: string;
    media_received: string;
    invoice_sent: string;
  };
  onEditOrder: (order: Order) => void;
}

export function OrdersTable({ searchQuery, filters, onEditOrder }: OrdersTableProps) {
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
    orderId: string,
    field: 'invoice_issued' | 'invoice_sent',
    value: boolean
  ) => {
    const previousStatus = invoiceStatuses[orderId];
    const optimisticStatus: OrderInvoiceStatus = {
      order_id: orderId,
      invoice_issued: previousStatus?.invoice_issued ?? false,
      invoice_sent: previousStatus?.invoice_sent ?? false,
      updated_at: new Date().toISOString(),
      [field]: value,
    };

    setInvoiceStatuses(prev => ({
      ...prev,
      [orderId]: optimisticStatus,
    }));

    try {
      const savedStatus = await SupabaseService.upsertInvoiceStatus(orderId, {
        invoice_issued: optimisticStatus.invoice_issued,
        invoice_sent: optimisticStatus.invoice_sent,
      });
      setInvoiceStatuses(prev => ({
        ...prev,
        [orderId]: savedStatus,
      }));
    } catch (error) {
      console.error('Error updating invoice status:', error);
      setInvoiceStatuses(prev => {
        const next = { ...prev };
        if (previousStatus) {
          next[orderId] = previousStatus;
        } else {
          delete next[orderId];
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
    if (filters.month && filters.year) {
      filtered = filtered.filter(order => {
        const filterYear = parseInt(filters.year, 10);
        const filterMonth = parseInt(filters.month, 10);
        const orderFrom = new Date(order.from);
        const orderTo = new Date(order.to);
        const monthStart = new Date(filterYear, filterMonth - 1, 1);
        const monthEnd = new Date(filterYear, filterMonth, 0);
        return orderFrom <= monthEnd && orderTo >= monthStart;
      });
    } else if (filters.year) {
      filtered = filtered.filter(order => {
        const filterYear = parseInt(filters.year, 10);
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
    if (filters.month && filters.year) {
      const y = parseInt(filters.year, 10);
      const m = parseInt(filters.month, 10);
      const lastDay = new Date(y, m, 0).getDate(); // last day of month (Feb=28, etc.)
      const startDate = `${filters.year}-${filters.month.padStart(2, '0')}-01`;
      const endDate = `${filters.year}-${filters.month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      // Show orders that overlap with the selected month:
      // - order starts before month ends AND order ends after month starts
      filtersArray.push(`(from<="${endDate}" && to>="${startDate}")`);
    } else if (filters.year) {
      const startDate = `${filters.year}-01-01`;
      const endDate = `${filters.year}-12-31`;
      // Show orders that overlap with the selected year.
      filtersArray.push(`(from<="${endDate}" && to>="${startDate}")`);
    }
    
    // If no filters, return empty string
    if (filtersArray.length === 0) {
      return '';
    }
    
    const result = filtersArray.join(' && ');
    return result;
  }, [searchQuery, filters]);

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

  const getMonthlyAmount = useCallback((order: Order) => {
    const filterMonth = parseInt(filters.month, 10);
    const filterYear = parseInt(filters.year, 10);

    if (!filterMonth || !filterYear) {
      return null;
    }

    const totalDays = getDaysInRange(order.from, order.to);
    const daysInSelectedMonth = getDaysInMonth(order.from, order.to, filterYear, filterMonth);
    if (totalDays <= 0 || daysInSelectedMonth <= 0) {
      return 0;
    }

    return (order.final_price / totalDays) * daysInSelectedMonth;
  }, [filters.month, filters.year]);

  const formatMonthlyAmount = (order: Order) => {
    const monthlyAmount = getMonthlyAmount(order);
    if (monthlyAmount === null) return '-';
    return formatPrice(monthlyAmount);
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
      const statusMap = await SupabaseService.getInvoiceStatuses(items.map(item => item.id));
      const invoiceFilteredItems = filters.invoice_sent
        ? items.filter(item => {
            const issued = statusMap[item.id]?.invoice_issued ?? !!item.invoice_sent;
            return filters.invoice_sent === 'true' ? issued : !issued;
          })
        : items;
      const monthName = filters.month && filters.year
        ? `${['Sausis','Vasaris','Kovas','Balandis','Gegužė','Birželis','Liepa','Rugpjūtis','Rugsėjis','Spalis','Lapkritis','Gruodis'][parseInt(filters.month, 10) - 1]}_${filters.year}`
        : 'visi';
      const data: unknown[][] = [
        ['Klientas', 'Agentūra', 'Užsakymo Nr.', 'Statusas', 'Data nuo', 'Data iki', 'Media gautas', 'Kaina', 'Mėnesio suma', 'Sąskaita', 'Išsiųsta'],
        ...invoiceFilteredItems.map(o => [
          o.client,
          o.agency,
          String(o.invoice_id),
          o.approved ? 'Patvirtinta' : 'Nepatvirtinta',
          format(new Date(o.from), 'yyyy-MM-dd'),
          format(new Date(o.to), 'yyyy-MM-dd'),
          o.media_received ? 'Taip' : 'Ne',
          o.final_price ?? 0,
          getMonthlyAmount(o) ?? 0,
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
  }, [filters, sortField, sortDirection, buildFilterString, getMonthlyAmount]);

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
        const statusMap = await SupabaseService.getInvoiceStatuses(fetchedOrders.map(item => item.id));
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
  }, [currentPage, searchQuery, filters.status, filters.month, filters.year, filters.client, filters.agency, filters.media_received, filters.invoice_sent, sortField, sortDirection]);























  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Kraunama...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Table Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Užsakymai
            </h2>
            {sortField && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Rūšiuojama pagal: <span className="font-medium">{sortField} </span>
                ({sortDirection === 'asc' ? 'didėjimo' : 'mažėjimo'} tvarka)
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              {exporting ? 'Eksportuojama...' : 'Excel'}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Puslapis {currentPage} iš {totalPages}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleSort('client')}
              >
                <div className="flex items-center space-x-1">
                  <span>Klientas</span>
                  {getSortIcon('client')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleSort('agency')}
              >
                <div className="flex items-center space-x-1">
                  <span>Agentūra</span>
                  {getSortIcon('agency')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleSort('invoice_id')}
              >
                <div className="flex items-center space-x-1">
                  <span>Užsakymo Nr.</span>
                  {getSortIcon('invoice_id')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleSort('approved')}
              >
                <div className="flex items-center space-x-1">
                  <span>Statusas</span>
                  {getSortIcon('approved')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleSort('from')}
              >
                <div className="flex items-center space-x-1">
                  <span>Data nuo</span>
                  {getSortIcon('from')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleSort('to')}
              >
                <div className="flex items-center space-x-1">
                  <span>Data iki</span>
                  {getSortIcon('to')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleSort('media_received')}
              >
                <div className="flex items-center space-x-1">
                  <span>Media gautas</span>
                  {getSortIcon('media_received')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleSort('final_price')}
              >
                <div className="flex items-center space-x-1">
                  <span>Kaina</span>
                  {getSortIcon('final_price')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Mėnesio suma
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleSort('invoice_issued')}
              >
                <div className="flex items-center space-x-1">
                  <span>Sąskaita</span>
                  {getSortIcon('invoice_issued')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleSort('invoice_sent')}
              >
                <div className="flex items-center space-x-1">
                  <span>Išsiųsta</span>
                  {getSortIcon('invoice_sent')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {orders.map((order) => (
              <tr 
                key={order.id} 
                className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                onClick={() => onEditOrder(order)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    {order.viaduct && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Viadukai
                      </div>
                    )}
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {order.client}
                      {shouldShowMediaAlert(order) && (
                        <span className="ml-2 text-red-600 animate-pulse">
                          ⚠️
                        </span>
                      )}
                      {hasOrderCommentOrScreenshot(order.id) && (
                        <span
                          className="ml-2 inline-flex align-middle text-blue-600 dark:text-blue-400"
                          title="Yra komentaras arba screenshotas"
                        >
                          <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {order.agency || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {order.invoice_id}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.approved)}`}>
                    {getStatusText(order.approved)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {formatDate(order.from)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {formatDate(order.to)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    order.media_received 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {order.media_received ? 'Taip' : 'Ne'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatPrice(order.final_price)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatMonthlyAmount(order)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleInvoiceStatus(order.id, 'invoice_issued', !getInvoiceIssued(order));
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                      getInvoiceIssued(order) ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        getInvoiceIssued(order) ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleInvoiceStatus(order.id, 'invoice_sent', !getInvoiceSent(order.id));
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                      getInvoiceSent(order.id) ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        getInvoiceSent(order.id) ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Rodoma {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, totalItems)} iš {totalItems} rezultatų
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-white bg-gray-700 dark:bg-gray-600 border border-gray-600 dark:border-gray-500 rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Ankstesnis
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-white bg-gray-700 dark:bg-gray-600 border border-gray-600 dark:border-gray-500 rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sekantis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
