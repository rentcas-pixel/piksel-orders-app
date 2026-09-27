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
import { isPikselOwnedRegularScreen } from '@/lib/barter-placement';
import { modalBtnPrimary, modalBtnSecondary } from '@/lib/portal-ui';
import { loadPikselScreenCatalog, type PikselCatalogScreen } from '@/lib/screen-catalog';
import {
  createBarterTestOrder,
  createTestOrderDraft,
  ensureDemoTestOrders,
  getTestOrder,
  getTestOrderActivityMap,
  listTestOrders,
  subscribeTestOrders,
  syncBarterTestOrder,
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
  const [draftBarter, setDraftBarter] = useState(false);
  const [barterFrom, setBarterFrom] = useState('');
  const [barterTo, setBarterTo] = useState('');
  const [barterPrice, setBarterPrice] = useState(0);
  const [barterScreenIds, setBarterScreenIds] = useState<string[]>([]);
  const [pikselScreens, setPikselScreens] = useState<PikselCatalogScreen[]>([]);
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
    setDraftBarter(false);
    setBarterFrom('');
    setBarterTo('');
    setBarterPrice(0);
    setBarterScreenIds([]);
    setBuyerKind('agency');
    setBuyerName('');
  };

  useEffect(() => {
    if (!creating || !draftBarter || pikselScreens.length > 0) return;
    let cancelled = false;
    void loadPikselScreenCatalog()
      .then((rows) => {
        if (!cancelled) setPikselScreens(rows.filter(isPikselOwnedRegularScreen));
      })
      .catch(() => {
        if (!cancelled) setPikselScreens([]);
      });
    return () => {
      cancelled = true;
    };
  }, [creating, draftBarter, pikselScreens.length]);

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
        <AppShell onAddOrder={() => setCreating(true)} userEmail={session.email}>
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
              if (draftBarter) {
                if (!barterFrom || !barterTo) {
                  window.alert('Nurodykite barterio datas.');
                  return;
                }
                const selected = pikselScreens
                  .filter((screen) => barterScreenIds.includes(screen.id))
                  .map((screen) => ({ id: screen.id, name: screen.name, city: screen.city }));
                if (!selected.length) {
                  window.alert('Pasirinkite bent vieną Piksel ekraną.');
                  return;
                }
                const agreed = Number(barterPrice);
                const created = createBarterTestOrder({
                  client: name,
                  agency: buyer,
                  from: barterFrom,
                  to: barterTo,
                  price: Number.isFinite(agreed) && agreed > 0 ? agreed : 0,
                  screens: selected,
                });
                void syncBarterTestOrder(created).catch(() => {});
                setCreating(false);
                resetDraft();
                reload();
                return;
              }
              const created = createTestOrderDraft({ client: name, agency: buyer });
              setCreating(false);
              resetDraft();
              router.push(`/skaiciuokle/index.html?testOrderId=${encodeURIComponent(created.id)}#calculator`);
            }}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Naujas test orderis</h2>
            <label className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
              <input
                type="checkbox"
                checked={draftBarter}
                onChange={(event) => {
                  const next = event.target.checked;
                  setDraftBarter(next);
                  if (next && !barterFrom) {
                    const start = new Date();
                    const end = new Date(start);
                    end.setDate(end.getDate() + 6);
                    const iso = (date: Date) => {
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      return `${date.getFullYear()}-${month}-${day}`;
                    };
                    setBarterFrom(iso(start));
                    setBarterTo(iso(end));
                  }
                }}
                className="h-4 w-4"
              />
              Barteris
            </label>
            {!draftBarter && (
            <p className="mt-1 text-sm text-gray-500">
              Įrašykite pavadinimą, pasirinkite agentūrą arba klientą, tada tęskite į skaičiuoklę.
            </p>
            )}
            <div className="mt-4 space-y-3">
              {draftBarter && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={barterFrom}
                      onChange={(event) => setBarterFrom(event.target.value)}
                      placeholder="yyyy-mm-dd"
                      aria-label="Barterio data nuo"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <span className="text-gray-500">→</span>
                    <input
                      type="text"
                      value={barterTo}
                      onChange={(event) => setBarterTo(event.target.value)}
                      placeholder="yyyy-mm-dd"
                      aria-label="Barterio data iki"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                    />
                  </div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sutarta suma, €
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={barterPrice}
                      onChange={(event) =>
                        setBarterPrice(event.target.value === '' ? 0 : Number(event.target.value))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                    />
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Tik Piksel ekranai. Valandų išdėstymas nesiunčiamas.
                  </p>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {pikselScreens.map((screen) => (
                      <label
                        key={screen.id}
                        className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
                      >
                        <input
                          type="checkbox"
                          checked={barterScreenIds.includes(screen.id)}
                          onChange={() =>
                            setBarterScreenIds((prev) =>
                              prev.includes(screen.id)
                                ? prev.filter((id) => id !== screen.id)
                                : [...prev, screen.id]
                            )
                          }
                        />
                        <span>
                          {screen.name}
                          {screen.city ? ` · ${screen.city}` : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
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
                {draftBarter ? 'Išsaugoti' : 'Išsaugoti ir tęsti'}
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
