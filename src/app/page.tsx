'use client';

import { useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { OrdersTable } from '@/components/OrdersTable';
import { ScreenRevenueAnalysis } from '@/components/ScreenRevenueAnalysis';
import { PartnerRevenueAnalysis } from '@/components/PartnerRevenueAnalysis';
import { RecentApprovedOrders } from '@/components/RecentApprovedOrders';
import { Header } from '@/components/Header';
import { SearchAndFilters } from '@/components/SearchAndFilters';
import { EditOrderModal } from '@/components/EditOrderModal';
import { ReminderNotifications } from '@/components/ReminderNotifications';
import { WeekNumbersModal } from '@/components/WeekNumbersModal';
import { PocketBaseService } from '@/lib/pocketbase';
import { Order } from '@/types';

export default function Home() {
  const [isWeekNumbersModalOpen, setIsWeekNumbersModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showReminders, setShowReminders] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [activeTab, setActiveTab] = useState<'orders' | 'revenue' | 'partners' | 'latest'>('orders');
  const [filters, setFilters] = useState({
    status: '',
    month: '',
    year: '2026',
    client: '',
    agency: '',
    media_received: '',
    invoice_sent: ''
  });

  // Debounce – sumažina PocketBase apkrovą (ne kiekvienas įvedimas trigerina užklausą)
  const debouncedSearch = useDebounce(searchQuery, 400);
  const debouncedClient = useDebounce(filters.client, 400);
  const debouncedAgency = useDebounce(filters.agency, 400);
  const debouncedFilters = useMemo(() => ({
    ...filters,
    client: debouncedClient,
    agency: debouncedAgency,
  }), [filters, debouncedClient, debouncedAgency]);

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
  };

  const handleOrderUpdated = () => {
    // Force OrdersTable to refresh by updating the refresh key
    setRefreshKey(prev => prev + 1);
    setEditingOrder(null);
  };

  const handleOpenEditModalFromReminder = async (orderId: string) => {
    try {
      const order = await PocketBaseService.getOrder(orderId);
      setEditingOrder(order);
    } catch (error) {
      console.error('Error loading order for edit:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header 
        onAddOrder={() => setIsWeekNumbersModalOpen(true)} 
      />
      
      <main className="container mx-auto px-4 py-6">
        {activeTab !== 'latest' && (
          <SearchAndFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={filters}
            onFiltersChange={setFilters}
          />
        )}

        {/* Tabs */}
        <div className="mb-4 mt-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'orders'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Užsakymai
            </button>
            <button
              onClick={() => setActiveTab('revenue')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'revenue'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Ekranų pajamos
            </button>
            <button
              onClick={() => setActiveTab('partners')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'partners'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Partneriai
            </button>
            <button
              onClick={() => setActiveTab('latest')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'latest'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Naujausi
            </button>
          </nav>
        </div>

        {activeTab === 'orders' && (
          <OrdersTable
            key={refreshKey}
            searchQuery={debouncedSearch}
            filters={debouncedFilters}
            onEditOrder={handleEditOrder}
          />
        )}

        {activeTab === 'revenue' && (
          <ScreenRevenueAnalysis
            filters={debouncedFilters}
            onEditOrder={handleEditOrder}
            refreshKey={refreshKey}
          />
        )}

        {activeTab === 'partners' && (
          <PartnerRevenueAnalysis
            filters={debouncedFilters}
            onEditOrder={handleEditOrder}
            refreshKey={refreshKey}
          />
        )}

        {activeTab === 'latest' && (
          <RecentApprovedOrders
            onEditOrder={handleEditOrder}
            refreshKey={refreshKey}
          />
        )}
      </main>

      {/* Edit Order Modal */}
      <EditOrderModal
        order={editingOrder}
        isOpen={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        onOrderUpdated={handleOrderUpdated}
      />

      {/* Reminder Notifications */}
      {showReminders && (
        <ReminderNotifications
          onClose={() => setShowReminders(false)}
          onOpenEditModal={handleOpenEditModalFromReminder}
        />
      )}

      {/* Week Numbers Modal */}
      <WeekNumbersModal
        isOpen={isWeekNumbersModalOpen}
        onClose={() => setIsWeekNumbersModalOpen(false)}
      />
    </div>
  );
}
