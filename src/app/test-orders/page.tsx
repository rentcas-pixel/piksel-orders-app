'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { AgencySelect } from '@/components/AgencySelect';
import { EditOrderModal } from '@/components/EditOrderModal';
import { OrdersTable } from '@/components/OrdersTable';
import { PortalFiltersBar } from '@/components/PortalFiltersBar';
import { useAppSession } from '@/hooks/useAppSession';
import { useDebounce, useDebouncedSearchQuery } from '@/hooks/useDebounce';
import { CANONICAL_AGENCY_OPTIONS, sortAgenciesByOrderFrequency } from '@/lib/agency-names';
import type { OrdersListFilters } from '@/lib/orders-filters';
import { modalBtnPrimary, modalBtnSecondary } from '@/lib/portal-ui';
import {
  createTestOrderDraft,
  ensureDemoTestOrders,
  getTestOrder,
  getTestOrderActivityMap,
  listTestOrders,
  subscribeTestOrders,
  upsertTestOrder,
  type TestOrder,
} from '@/lib/test-orders';
import type { Order } from '@/types';

const EMPTY_FILTERS: OrdersListFilters = {
  status: '',
  month: '',
  year: '',
  dateFrom: '',
  dateTo: '',
  client: '',
  agency: '',
  media_received: '',
  invoice_sent: '',
};

const PREFETCH = [
  '/skaiciuokle/styles.css?v=20260921-softg',
  '/skaiciuokle/plan-paint.js?v=20260921-1',
  '/skaiciuokle/app.js?v=20260925-planat',
  '/skaiciuokle/screen-catalog.js?v=20260721-photos',
];

export default function TestOrdersPage() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useAppSession();
  const [orders, setOrders] = useState<TestOrder[]>([]);
  const [editing, setEditing] = useState<Order | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [buyerKind, setBuyerKind] = useState<'agency' | 'client'>('agency');
  const [buyerName, setBuyerName] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<OrdersListFilters>(EMPTY_FILTERS);
  const searchQuery = useDebouncedSearchQuery(searchInput);
  const debouncedClient = useDebounce(filters.client, 400);
  const debouncedAgency = useDebounce(filters.agency, 400);
  const debouncedFilters = useMemo(
    () => ({ ...filters, client: debouncedClient, agency: debouncedAgency }),
    [filters, debouncedClient, debouncedAgency]
  );

  const reload = useCallback(() => {
    setOrders(listTestOrders());
  }, []);

  const refreshOpenOrder = useCallback(() => {
    setOrders(listTestOrders());
    setEditing((current) => {
      if (!current) return current;
      const next = getTestOrder(current.id);
      if (!next) return current;
      const planChanged =
        String(next.details?.planChangedAt || '') !== String(current.details?.planChangedAt || '');
      const screensChanged = (next.screens || []).join() !== (current.screens || []).join();
      if (
        next.updated !== current.updated ||
        next.from !== current.from ||
        next.to !== current.to ||
        next.final_price !== current.final_price ||
        next.approved !== current.approved ||
        screensChanged ||
        planChanged
      ) {
        return next;
      }
      return current;
    });
  }, []);

  useEffect(() => {
    for (const href of PREFETCH) {
      if (document.querySelector(`link[rel="prefetch"][href="${href}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      document.head.appendChild(link);
    }
    ensureDemoTestOrders();
    reload();
    const openId = new URLSearchParams(window.location.search).get('open');
    if (openId) {
      const opened = getTestOrder(openId);
      if (opened) setEditing(opened);
      window.history.replaceState({}, '', '/test-orders');
    }
  }, [reload]);

  useEffect(
    () => subscribeTestOrders(() => refreshOpenOrder(), { hydrateFromCampaigns: false }),
    [refreshOpenOrder]
  );

  const activityMap = useMemo(() => getTestOrderActivityMap(orders), [orders]);
  const agencyOptions = useMemo(
    () => sortAgenciesByOrderFrequency(CANONICAL_AGENCY_OPTIONS, orders.map((order) => order.agency || '')),
    [orders]
  );

  const toggleLocalInvoice = useCallback(
    (order: Order, field: 'invoice_issued' | 'invoice_sent', value: boolean) => {
      const existing = getTestOrder(order.id) || (order as TestOrder);
      upsertTestOrder({ ...existing, [field]: value });
      reload();
    },
    [reload]
  );

  const resetDraft = () => {
    setDraftName('');
    setBuyerKind('agency');
    setBuyerName('');
  };

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        Kraunama…
      </div>
    );
  }

  if (!session) {
    if (typeof window !== 'undefined') window.location.assign('/login');
    return null;
  }

  return (
    <>
      <div className="play-vertical-grid min-h-screen bg-gray-50 dark:bg-gray-900">
        <AppShell onAddOrder={() => {}} userEmail={session.email}>
          <main className="container mx-auto px-4 py-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Test orderiai</h1>
                <p className="mt-1 text-sm text-amber-800">
                  Sandbox: ta pati kampanijų lentelė. Saugoma localStorage — į live nerašoma.
                </p>
              </div>
              <button type="button" className={modalBtnPrimary} onClick={() => setCreating(true)}>
                Sukurti
              </button>
            </div>
            <div className="mb-4">
              <PortalFiltersBar
                searchQuery={searchInput}
                onSearchChange={setSearchInput}
                filters={filters}
                onFiltersChange={setFilters}
                showMonthYear
                showSearch={false}
              />
            </div>
            <OrdersTable
              searchQuery={searchQuery}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              filters={debouncedFilters}
              portalStyle
              localOrders={orders}
              localActivityMap={activityMap}
              onLocalInvoiceToggle={toggleLocalInvoice}
              onEditOrder={(order) => setEditing(order)}
            />
          </main>
        </AppShell>
      </div>
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
            onSubmit={(event) => {
              event.preventDefault();
              const name = draftName.trim();
              const buyer = buyerName.trim();
              if (!name) {
                window.alert('Įrašykite pavadinimą');
                return;
              }
              if (!buyer) {
                window.alert(buyerKind === 'agency' ? 'Pasirinkite agentūrą' : 'Įrašykite klientą');
                return;
              }
              const created = createTestOrderDraft({ client: name, agency: buyer });
              setCreating(false);
              resetDraft();
              router.push(`/skaiciuokle/index.html?testOrderId=${encodeURIComponent(created.id)}#calculator`);
            }}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Naujas test orderis</h2>
            <p className="mt-1 text-sm text-gray-500">
              Įrašykite pavadinimą, pasirinkite agentūrą arba klientą, tada tęskite į skaičiuoklę.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Pavadinimas
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="Pvz. Testinė vasaros kampanija"
                  autoFocus
                />
              </label>
              <fieldset>
                <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipas</legend>
                <div className="mt-2 flex gap-4 text-sm text-gray-700 dark:text-gray-300">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="buyerKind"
                      checked={buyerKind === 'agency'}
                      onChange={() => {
                        setBuyerKind('agency');
                        setBuyerName('');
                      }}
                    />
                    Agentūra
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="buyerKind"
                      checked={buyerKind === 'client'}
                      onChange={() => {
                        setBuyerKind('client');
                        setBuyerName('');
                      }}
                    />
                    Klientas
                  </label>
                </div>
              </fieldset>
              {buyerKind === 'agency' ? (
                <div>
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Agentūra</span>
                  <AgencySelect
                    className="mt-1"
                    value={buyerName}
                    options={agencyOptions}
                    onChange={setBuyerName}
                    required
                  />
                </div>
              ) : (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Klientas
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                    value={buyerName}
                    onChange={(event) => setBuyerName(event.target.value)}
                    placeholder="Pvz. RIMI"
                    required
                  />
                </label>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={modalBtnSecondary}
                onClick={() => {
                  setCreating(false);
                  resetDraft();
                }}
              >
                Atšaukti
              </button>
              <button type="submit" className={modalBtnPrimary}>
                Išsaugoti ir tęsti
              </button>
            </div>
          </form>
        </div>
      )}
      <EditOrderModal
        order={editing}
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        onOrderUpdated={(order) => {
          reload();
          const next = getTestOrder(order.id);
          if (next) setEditing(next);
        }}
      />
    </>
  );
}
