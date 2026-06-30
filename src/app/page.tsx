'use client';

import { useState, useMemo, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useAppSession } from '@/hooks/useAppSession';
import { canAccessAppTab, canAccessInvoicesSubTab, hasAdminFinanceAccess } from '@/lib/app-permissions';
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
import { AppBreadcrumb } from '@/components/AppBreadcrumb';
import { PortalFiltersBar } from '@/components/PortalFiltersBar';
import { EditOrderModal } from '@/components/EditOrderModal';
import { InvoiceModal } from '@/components/InvoiceModal';
import { CombinedInvoiceBuilder } from '@/components/CombinedInvoiceBuilder';
import { CombinedInvoiceModal } from '@/components/CombinedInvoiceModal';
import { BalanceSummaryPanel } from '@/components/BalanceSummaryPanel';
import { InvoicesSubTabsNav } from '@/components/InvoicesSubTabsNav';
import { InvoicesFiltersBar } from '@/components/InvoicesFiltersBar';
import { InvoicesTable } from '@/components/InvoicesTable';
import { ReceivedInvoicesFiltersBar } from '@/components/ReceivedInvoicesFiltersBar';
import { ReceivedInvoicesTable } from '@/components/ReceivedInvoicesTable';
import { ReceivedInvoiceModal } from '@/components/ReceivedInvoiceModal';
import { ReceivedInvoicesBatchModal } from '@/components/ReceivedInvoicesBatchModal';
import { IssuedInvoicesBatchModal } from '@/components/IssuedInvoicesBatchModal';
import { BankStatementImportModal } from '@/components/BankStatementImportModal';
import { BankPanel } from '@/components/BankPanel';
import { BankBalanceSummaryPanel } from '@/components/BankBalanceSummaryPanel';
import { BankDashboardPanel } from '@/components/BankDashboardPanel';
import { BankSubTabsNav } from '@/components/BankSubTabsNav';
import { ReceivedInvoiceService } from '@/lib/received-invoice-service';
import { InvoiceService } from '@/lib/invoice-service';
import type { CombinedInvoiceCandidate } from '@/lib/combined-invoice';
import { BankImportProgressToast } from '@/components/BankImportProgressToast';
import { ReminderNotifications } from '@/components/ReminderNotifications';
import { WeekNumbersModal } from '@/components/WeekNumbersModal';
import { PocketBaseService } from '@/lib/pocketbase';
import {
  createStandaloneInvoiceOrder,
  isCombinedInvoiceOrder,
  isStandaloneInvoiceOrder,
} from '@/lib/invoice-utils';
import { Order } from '@/types';
import type { Invoice, ReceivedInvoice } from '@/types';
import type { AppTab, BankSubTab, InvoicesSubTab } from '@/lib/app-navigation';
import { getAppBreadcrumb } from '@/lib/app-navigation';
import type { OrdersViewMode } from '@/lib/orders-filters';
import type { IssuedInvoicePaymentFilter } from '@/lib/issued-invoice-filters';

export default function Home() {
  const { session, loading: sessionLoading, error: sessionError } = useAppSession();
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
  const [invoicesSubTab, setInvoicesSubTab] = useState<InvoicesSubTab>('issued');
  const [bankSubTab, setBankSubTab] = useState<BankSubTab>('dashboard');
  const [expensesStatusFilter, setExpensesStatusFilter] =
    useState<IssuedInvoicePaymentFilter>('all');
  const [issuedPaymentFilter, setIssuedPaymentFilter] =
    useState<IssuedInvoicePaymentFilter>('all');
  const [receivedInvoiceModal, setReceivedInvoiceModal] = useState<{
    invoice: ReceivedInvoice | null;
    isNew: boolean;
  } | null>(null);
  const [batchImportOpen, setBatchImportOpen] = useState(false);
  const [issuedBatchImportOpen, setIssuedBatchImportOpen] = useState(false);
  const [bankImportOpen, setBankImportOpen] = useState(false);
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

  const isAdmin = session ? hasAdminFinanceAccess(session.role) : false;
  const visibleTabs = session?.visibleTabs ?? [];
  const visibleInvoicesSubTabs = session?.visibleInvoicesSubTabs ?? ['issued'];

  useEffect(() => {
    if (!session) return;
    if (!canAccessAppTab(session.role, activeTab)) {
      setActiveTab('orders');
    }
    if (!canAccessInvoicesSubTab(session.role, invoicesSubTab)) {
      setInvoicesSubTab('issued');
    }
  }, [session, activeTab, invoicesSubTab]);

  const breadcrumb = useMemo(
    () =>
      getAppBreadcrumb(activeTab, {
        invoicesSubTab,
        bankSubTab,
        ordersViewMode,
      }),
    [activeTab, invoicesSubTab, bankSubTab, ordersViewMode]
  );

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Kraunama…</p>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-sm text-red-600 dark:text-red-400">{sessionError ?? 'Sesija nerasta.'}</p>
      </div>
    );
  }

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
        <Header onAddOrder={() => setIsWeekNumbersModalOpen(true)} userEmail={session.email} />
        <main className="container mx-auto px-4 py-6">
          <AppBreadcrumb segments={breadcrumb} />
          <AppTabsNav
            activeTab={activeTab}
            visibleTabs={visibleTabs}
            onTabChange={setActiveTab}
          />

          {activeTab !== 'latest' && activeTab !== 'orders' && activeTab !== 'invoices' && activeTab !== 'bank' && (
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
            <InvoicesSubTabsNav
              value={invoicesSubTab}
              visibleSubTabs={visibleInvoicesSubTabs}
              onChange={setInvoicesSubTab}
            />
          )}

          {activeTab === 'bank' && (
            <BankSubTabsNav value={bankSubTab} onChange={setBankSubTab} />
          )}

          {activeTab === 'bank' && bankSubTab !== 'balance' && bankSubTab !== 'dashboard' && (
            <BankPanel
              subTab={bankSubTab}
              month={filters.month}
              year={filters.year}
              onMonthYearChange={(month, year) => setFilters((prev) => ({ ...prev, month, year }))}
              refreshKey={refreshKey}
              onChanged={() => setRefreshKey((prev) => prev + 1)}
            />
          )}

          {activeTab === 'bank' && bankSubTab === 'dashboard' && (
            <BankDashboardPanel refreshKey={refreshKey} />
          )}

          {activeTab === 'bank' && bankSubTab === 'balance' && (
            <BankBalanceSummaryPanel
              month={filters.month}
              year={filters.year}
              onMonthYearChange={(month, year) => setFilters((prev) => ({ ...prev, month, year }))}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'invoices' && invoicesSubTab === 'balance' && (
            <BalanceSummaryPanel
              month={filters.month}
              year={filters.year}
              onMonthYearChange={(month, year) => setFilters((prev) => ({ ...prev, month, year }))}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'invoices' && invoicesSubTab === 'issued' && (
            <InvoicesFiltersBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              month={filters.month}
              year={filters.year}
              onMonthYearChange={(month, year) => setFilters((prev) => ({ ...prev, month, year }))}
              paymentFilter={issuedPaymentFilter}
              onPaymentFilterChange={setIssuedPaymentFilter}
            />
          )}

          {activeTab === 'invoices' && invoicesSubTab === 'issued' && (
            <CombinedInvoiceBuilder
              month={filters.month}
              year={filters.year}
              searchQuery={debouncedSearch}
              refreshKey={refreshKey}
              onCreateCombined={(candidates) => setCombinedCandidates(candidates)}
            />
          )}

          {activeTab === 'invoices' && invoicesSubTab === 'issued' && (
            <InvoicesTable
              key={refreshKey}
              searchQuery={debouncedSearch}
              month={filters.month}
              year={filters.year}
              paymentFilter={issuedPaymentFilter}
              refreshKey={refreshKey}
              onNewInvoice={handleNewStandaloneInvoice}
              onBatchImport={() => setIssuedBatchImportOpen(true)}
              onOpenInvoice={(invoice) => void handleOpenInvoice(invoice)}
            />
          )}

          {activeTab === 'invoices' && invoicesSubTab === 'received' && (
            <ReceivedInvoicesFiltersBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              month={filters.month}
              year={filters.year}
              onMonthYearChange={(month, year) => setFilters((prev) => ({ ...prev, month, year }))}
              statusFilter={expensesStatusFilter}
              onStatusFilterChange={setExpensesStatusFilter}
            />
          )}

          {activeTab === 'invoices' && invoicesSubTab === 'received' && (
            <ReceivedInvoicesTable
              key={refreshKey}
              searchQuery={debouncedSearch}
              month={filters.month}
              year={filters.year}
              statusFilter={expensesStatusFilter}
              refreshKey={refreshKey}
              onNewInvoice={() => setReceivedInvoiceModal({ invoice: null, isNew: true })}
              onBatchImport={() => setBatchImportOpen(true)}
              onBankImport={() => setBankImportOpen(true)}
              onDeduplicate={async () => {
                if (
                  !confirm(
                    'Pašalinti pasikartojančias sąskaitas? Paliekama naujausia versija su failu (jei yra).'
                  )
                ) {
                  return;
                }
                const { removed } = await ReceivedInvoiceService.deduplicateAll();
                setRefreshKey((prev) => prev + 1);
                alert(removed > 0 ? `Pašalinta ${removed} dublikatų.` : 'Dublikatų nerasta.');
              }}
              onOpenInvoice={(invoice) => setReceivedInvoiceModal({ invoice, isNew: false })}
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

      <ReceivedInvoicesBatchModal
        isOpen={batchImportOpen}
        onClose={() => setBatchImportOpen(false)}
        onCompleted={() => setRefreshKey((prev) => prev + 1)}
      />

      <IssuedInvoicesBatchModal
        isOpen={issuedBatchImportOpen}
        onClose={() => setIssuedBatchImportOpen(false)}
        onCompleted={() => setRefreshKey((prev) => prev + 1)}
      />

      <BankStatementImportModal
        isOpen={bankImportOpen}
        onClose={() => setBankImportOpen(false)}
        onCompleted={() => setRefreshKey((prev) => prev + 1)}
      />

      <ReceivedInvoiceModal
        invoice={receivedInvoiceModal?.invoice ?? null}
        isOpen={!!receivedInvoiceModal}
        isNew={receivedInvoiceModal?.isNew ?? false}
        onClose={() => setReceivedInvoiceModal(null)}
        onSaved={() => setRefreshKey((prev) => prev + 1)}
        onOpenExisting={(existing) =>
          setReceivedInvoiceModal({ invoice: existing, isNew: false })
        }
      />

      {showReminders && (
        <ReminderNotifications
          onClose={() => setShowReminders(false)}
          onOpenEditModal={handleOpenEditModalFromReminder}
        />
      )}

      <WeekNumbersModal isOpen={isWeekNumbersModalOpen} onClose={() => setIsWeekNumbersModalOpen(false)} />

      {isAdmin && <BankImportProgressToast />}
    </>
  );
}
