'use client';

import { useState, useMemo } from 'react';
import { CalendarDaysIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '@/hooks/useDebounce';
import { OrdersTable } from '@/components/OrdersTable';
import { OrdersCalendar } from '@/components/OrdersCalendar';
import { ScreenRevenueAnalysis } from '@/components/ScreenRevenueAnalysis';
import { PartnerRevenueAnalysis } from '@/components/PartnerRevenueAnalysis';
import { AgencyAnalysis } from '@/components/AgencyAnalysis';
import { ChartsAnalysis } from '@/components/ChartsAnalysis';
import { RecentApprovedOrders } from '@/components/RecentApprovedOrders';
import { OrderAnalyticsDashboard } from '@/components/OrderAnalyticsDashboard';
import { Header } from '@/components/Header';
import { SearchAndFilters } from '@/components/SearchAndFilters';
import { EditOrderModal } from '@/components/EditOrderModal';
import { ReminderNotifications } from '@/components/ReminderNotifications';
import { WeekNumbersModal } from '@/components/WeekNumbersModal';
import { PocketBaseService } from '@/lib/pocketbase';
import { Order } from '@/types';
import type { AppTab } from '@/lib/app-navigation';
import { APP_TABS, PAGE_META } from '@/lib/app-navigation';

type OrdersViewMode = 'list' | 'calendar';

export default function Home() {
  const [isWeekNumbersModalOpen, setIsWeekNumbersModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showReminders, setShowReminders] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<AppTab>('orders');
  const [ordersViewMode, setOrdersViewMode] = useState<OrdersViewMode>('list');
  const [filters, setFilters] = useState({
    status: '',
    month: '',
    year: '2026',
    client: '',
    agency: '',
    media_received: '',
    invoice_sent: '',
  });

  const debouncedSearch = useDebounce(searchQuery, 400);
  const debouncedClient = useDebounce(filters.client, 400);
  const debouncedAgency = useDebounce(filters.agency, 400);
  const debouncedFilters = useMemo(
    () => ({ ...filters, client: debouncedClient, agency: debouncedAgency }),
    [filters, debouncedClient, debouncedAgency]
  );

  const handleEditOrder = (order: Order) => setEditingOrder(order);

  const handleOrderUpdated = () => {
    setRefreshKey((prev) => prev + 1);
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
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header onAddOrder={() => setIsWeekNumbersModalOpen(true)} />
        <main className="container mx-auto px-4 py-6">
          {activeTab !== 'latest' && (
            <SearchAndFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filters={filters}
              onFiltersChange={setFilters}
            />
          )}

          <div className="mb-4 mt-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 overflow-x-auto">
              {APP_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  {PAGE_META[tab].title}
                </button>
              ))}
            </nav>
          </div>

          {activeTab === 'orders' && (
            <>
              <div className="mb-4 inline-flex rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-1">
                <button
                  type="button"
                  onClick={() => setOrdersViewMode('list')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    ordersViewMode === 'list'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                  }`}
                >
                  <TableCellsIcon className="w-4 h-4" />
                  Sąrašas
                </button>
                <button
                  type="button"
                  onClick={() => setOrdersViewMode('calendar')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    ordersViewMode === 'calendar'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                  }`}
                >
                  <CalendarDaysIcon className="w-4 h-4" />
                  Kalendorius
                </button>
              </div>

              {ordersViewMode === 'list' ? (
                <OrdersTable
                  key={refreshKey}
                  searchQuery={debouncedSearch}
                  filters={debouncedFilters}
                  onEditOrder={handleEditOrder}
                />
              ) : (
                <OrdersCalendar
                  key={refreshKey}
                  searchQuery={debouncedSearch}
                  filters={debouncedFilters}
                  onEditOrder={handleEditOrder}
                />
              )}
            </>
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
            <RecentApprovedOrders onEditOrder={handleEditOrder} refreshKey={refreshKey} />
          )}

          {activeTab === 'agencies' && (
            <AgencyAnalysis filters={debouncedFilters} onEditOrder={handleEditOrder} />
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-4">
              <OrderAnalyticsDashboard
                filters={debouncedFilters}
                onEditOrder={handleEditOrder}
                refreshKey={refreshKey}
              />
              <ChartsAnalysis filters={debouncedFilters} />
            </div>
          )}
        </main>
      </div>

      <EditOrderModal
        order={editingOrder}
        isOpen={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        onOrderUpdated={handleOrderUpdated}
      />

      {showReminders && (
        <ReminderNotifications
          onClose={() => setShowReminders(false)}
          onOpenEditModal={handleOpenEditModalFromReminder}
        />
      )}

      <WeekNumbersModal isOpen={isWeekNumbersModalOpen} onClose={() => setIsWeekNumbersModalOpen(false)} />
    </>
  );
}
