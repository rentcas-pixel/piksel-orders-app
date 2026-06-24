'use client';

import { useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { OrdersTable } from '@/components/OrdersTable';
import { OrdersCalendar } from '@/components/OrdersCalendar';
import { OrdersSearchFilters } from '@/components/OrdersSearchFilters';
import { ScreenRevenueAnalysis } from '@/components/ScreenRevenueAnalysis';
import { PartnerRevenueAnalysis } from '@/components/PartnerRevenueAnalysis';
import { AgencyAnalysis } from '@/components/AgencyAnalysis';
import { ChartsAnalysis } from '@/components/ChartsAnalysis';
import { RecentApprovedOrders } from '@/components/RecentApprovedOrders';
import { OrderAnalyticsDashboard } from '@/components/OrderAnalyticsDashboard';
import { Header } from '@/components/Header';
import { AppTabsNav } from '@/components/AppTabsNav';
import { PortalFiltersBar } from '@/components/PortalFiltersBar';
import { EditOrderModal } from '@/components/EditOrderModal';
import { InvoiceModal } from '@/components/InvoiceModal';
import { CombinedInvoiceBuilder } from '@/components/CombinedInvoiceBuilder';
import { CombinedInvoiceModal } from '@/components/CombinedInvoiceModal';
import { InvoicesFiltersBar } from '@/components/InvoicesFiltersBar';
import { InvoicesTable } from '@/components/InvoicesTable';
import { InvoiceService } from '@/lib/invoice-service';
import type { CombinedInvoiceCandidate } from '@/lib/combined-invoice';
import { ReminderNotifications } from '@/components/ReminderNotifications';
import { WeekNumbersModal } from '@/components/WeekNumbersModal';
import { PocketBaseService } from '@/lib/pocketbase';
import {
  createStandaloneInvoiceOrder,
  isCombinedInvoiceOrder,
  isStandaloneInvoiceOrder,
} from '@/lib/invoice-utils';
import { Order } from '@/types';
import type { Invoice } from '@/types';
import type { AppTab } from '@/lib/app-navigation';
import type { OrdersViewMode } from '@/lib/orders-filters';

export default function Home() {
  const [isWeekNumbersModalOpen, setIsWeekNumbersModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [invoicingOrder, setInvoicingOrder] = useState<Order | null>(null);
  const [combinedInvoice, setCombinedInvoice] = useState<Invoice | null>(null);
  const [combinedCandidates, setCombinedCandidates] = useState<CombinedInvoiceCandidate[] | null>(
    null
  );
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

  const handleGenerateInvoice = async (order: Order) => {
    const existing = await InvoiceService.getLatestForOrder(order.id);
    if (existing && (await InvoiceService.hasInvoiceLines(existing.id))) {
      setCombinedInvoice(existing);
      return;
    }
    setInvoicingOrder(order);
  };

  const handleInvoiceSaved = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleNewStandaloneInvoice = () => {
    setInvoicingOrder(createStandaloneInvoiceOrder());
  };

  const handleOpenInvoice = async (invoice: Invoice) => {
    if (isCombinedInvoiceOrder(invoice.order_id)) {
      setCombinedInvoice(invoice);
      return;
    }
    if (await InvoiceService.hasInvoiceLines(invoice.id)) {
      setCombinedInvoice(invoice);
      return;
    }
    if (isStandaloneInvoiceOrder(invoice.order_id)) {
      setInvoicingOrder(createStandaloneInvoiceOrder(invoice.order_id));
      return;
    }
    try {
      const order = await PocketBaseService.getOrder(invoice.order_id);
      setInvoicingOrder(order);
    } catch (error) {
      console.error('Nepavyko užkrauti užsakymo sąskaitai:', error);
      alert('Užsakymas nerastas. Atidaroma tik sąskaitos informacija.');
      setInvoicingOrder(createStandaloneInvoiceOrder(invoice.order_id));
    }
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
          <AppTabsNav activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab !== 'latest' && activeTab !== 'orders' && activeTab !== 'invoices' && (
            <PortalFiltersBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filters={filters}
              onFiltersChange={setFilters}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersSearchFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filters={filters}
              onFiltersChange={setFilters}
              viewMode={ordersViewMode}
              onViewModeChange={setOrdersViewMode}
            />
          )}

          {activeTab === 'orders' && (
            <>
              {ordersViewMode === 'list' ? (
                <OrdersTable
                  key={refreshKey}
                  searchQuery={debouncedSearch}
                  filters={debouncedFilters}
                  portalStyle
                  onEditOrder={handleEditOrder}
                  onGenerateInvoice={handleGenerateInvoice}
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

          {activeTab === 'invoices' && (
            <InvoicesFiltersBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              month={filters.month}
              year={filters.year}
              onMonthYearChange={(month, year) => setFilters((prev) => ({ ...prev, month, year }))}
            />
          )}

          {activeTab === 'invoices' && (
            <CombinedInvoiceBuilder
              month={filters.month}
              year={filters.year}
              searchQuery={debouncedSearch}
              refreshKey={refreshKey}
              onCreateCombined={(candidates) => setCombinedCandidates(candidates)}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesTable
              key={refreshKey}
              searchQuery={debouncedSearch}
              month={filters.month}
              year={filters.year}
              refreshKey={refreshKey}
              onNewInvoice={handleNewStandaloneInvoice}
              onOpenInvoice={(invoice) => void handleOpenInvoice(invoice)}
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
        onGenerateInvoice={handleGenerateInvoice}
      />

      <InvoiceModal
        order={invoicingOrder}
        isOpen={!!invoicingOrder}
        onClose={() => setInvoicingOrder(null)}
        onSaved={handleInvoiceSaved}
        onOpenCombined={(invoice) => {
          setInvoicingOrder(null);
          setCombinedInvoice(invoice);
        }}
      />

      <CombinedInvoiceModal
        isOpen={!!combinedInvoice || !!combinedCandidates}
        invoice={combinedInvoice}
        candidates={combinedCandidates}
        billingMonth={filters.month}
        billingYear={filters.year}
        onClose={() => {
          setCombinedInvoice(null);
          setCombinedCandidates(null);
        }}
        onSaved={handleInvoiceSaved}
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
