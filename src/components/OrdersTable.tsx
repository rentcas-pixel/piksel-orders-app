'use client';

import { useState, useEffect, useCallback } from 'react';
import { Order } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { format } from 'date-fns';
import { lt } from 'date-fns/locale';
import { EyeIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface OrdersTableProps {
  searchQuery: string;
  filters: {
    status: string;
    month: string;
    year: string;
    client: string;
    agency: string;
    media_received: string;
  };
  onOrderClick: (order: Order) => void;
}

export function OrdersTable({ searchQuery, filters, onOrderClick }: OrdersTableProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortField, setSortField] = useState<string>('updated');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const buildFilterString = useCallback(() => {
    const filtersArray = [];
    
    console.log('🔍 Building filter string with:', { searchQuery, filters });
    
    // Add search query filter
    if (searchQuery.trim()) {
      filtersArray.push(`(client~"${searchQuery}" || agency~"${searchQuery}" || invoice_id~"${searchQuery}")`);
    }
    
    // Status filter - handle boolean conversion
    if (filters.status) {
      if (filters.status === 'taip') {
        filtersArray.push(`approved=true`);
      } else if (filters.status === 'ne') {
        filtersArray.push(`approved=false`);
      }
      // Note: 'rezervuota' and 'atšaukta' would need additional fields
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
    
    // Date filters - fix date format and logic
    if (filters.month && filters.year) {
      const startDate = `${filters.year}-${filters.month.padStart(2, '0')}-01`;
      const endDate = `${filters.year}-${filters.month.padStart(2, '0')}-31`;
      filtersArray.push(`from>="${startDate}" && to<="${endDate}"`);
    }
    
    // If no filters, return empty string
    if (filtersArray.length === 0) {
      console.log('🔍 No filters applied, returning empty string');
      return '';
    }
    
    const result = filtersArray.join(' && ');
    console.log('🔍 Final filter string:', result);
    return result;
  }, [searchQuery, filters]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const filterString = buildFilterString();
        console.log('🔍 PocketBase filter string:', filterString);
        console.log('🔍 Current filters:', filters);
        console.log('🔍 Search query:', searchQuery);
        console.log('🔍 Sort field:', sortField, 'direction:', sortDirection);
        
        const result = await PocketBaseService.getOrders({
          page: currentPage,
          perPage: 20,
          sort: `${sortDirection === 'desc' ? '-' : ''}${sortField}`,
          filter: filterString
        });
        
        console.log('✅ PocketBase response:', result);
        setOrders(result.items);
        setTotalPages(result.totalPages);
        setTotalItems(result.totalItems);
      } catch (error) {
        console.error('❌ Failed to fetch orders:', error);
        // For demo purposes, show filtered and sorted mock data
        const mockOrders = getMockOrders();
        const filteredOrders = filterMockOrders(mockOrders);
        const sortedOrders = sortOrders(filteredOrders);
        setOrders(sortedOrders);
        setTotalPages(1);
        setTotalItems(sortedOrders.length);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [currentPage, searchQuery, filters, sortField, sortDirection, buildFilterString]);

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
      // Note: 'rezervuota' and 'atšaukta' would need additional fields in the Order type
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
    
    // Month and year filter
    if (filters.month && filters.year) {
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.from);
        const orderMonth = orderDate.getMonth() + 1; // getMonth() returns 0-11
        const orderYear = orderDate.getFullYear();
        return orderMonth === parseInt(filters.month) && orderYear === parseInt(filters.year);
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    if (sortDirection === 'asc') {
      return (
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }
    
    return (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const getStatusText = (approved: boolean) => {
    // For now, we only have boolean approved field
    // In the future, this should be updated to handle 'rezervuota' and 'atšaukta'
    return approved ? 'Patvirtinta' : 'Nepatvirtinta';
  };

  const getStatusColor = (approved: boolean) => {
    if (approved) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: lt });
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
              Užsakymai ({totalItems})
            </h2>
            {sortField && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Rūšiuojama pagal: <span className="font-medium">{sortField}</span> 
                ({sortDirection === 'asc' ? 'didėjimo' : 'mažėjimo'} tvarka)
              </p>
            )}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Puslapis {currentPage} iš {totalPages}
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
                Veiksmai
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {orders.map((order) => (
              <tr 
                key={order.id} 
                className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                onClick={() => onOrderClick(order)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {order.client}
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
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOrderClick(order);
                      }}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement edit
                      }}
                      className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement delete
                      }}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
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
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Ankstesnis
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
