'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRightOnRectangleIcon, CalendarDaysIcon, CameraIcon, DocumentTextIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '@/hooks/useDebounce';
import { AgencyInvoicesPanel } from '@/components/agency/AgencyInvoicesPanel';
import { AgencyPhotoPanel } from '@/components/agency/AgencyPhotoPanel';
import { AgencyOrdersTable } from '@/components/agency/AgencyOrdersTable';
import { AgencyOrdersCalendar } from '@/components/agency/AgencyOrdersCalendar';
import { EditOrderModal } from '@/components/EditOrderModal';
import { AgencySearchFilters } from '@/components/agency/AgencySearchFilters';
import { type AgencyListFilters, type AgencyPeriodTab, type AgencyViewMode } from '@/lib/agency-orders';
import { agencyLogout, AgencyNoLinkError, fetchAgencyInvoices, fetchAgencyMe } from '@/lib/agency-portal-api';
import { getClientAgencyPaths } from '@/lib/agency-portal-paths';
import { getPhotoProofUrl } from '@/lib/photo-proof';
import { Order } from '@/types';

type AgencyPortalTab = AgencyViewMode | 'invoices' | 'photo';

const agencyViewTabs: {
  id: AgencyPortalTab;
  label: string;
  icon: typeof TableCellsIcon;
}[] = [
  { id: 'list', label: 'Kampanijos', icon: TableCellsIcon },
  { id: 'calendar', label: 'Kalendorius', icon: CalendarDaysIcon },
  { id: 'invoices', label: 'Sąskaitos', icon: DocumentTextIcon },
  { id: 'photo', label: 'Photo', icon: CameraIcon },
];

function AgencyPortalContent() {
  const router = useRouter();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [agency, setAgency] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [tab, setTab] = useState<AgencyPortalTab>('list');
  const photoProofUrl = useMemo(
    () => (agency ? getPhotoProofUrl(agency, { embed: true }) : null),
    [agency]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [periodTab, setPeriodTab] = useState<AgencyPeriodTab>('current');
  const [filters, setFilters] = useState<AgencyListFilters>({
    status: 'taip',
    month: '',
    year: String(new Date().getFullYear()),
    client: '',
    showStaleUnapproved: false,
  });

  const debouncedSearch = useDebounce(searchQuery, 400);
  const debouncedClient = useDebounce(filters.client, 400);
  const debouncedFilters = useMemo(
    () => ({ ...filters, client: debouncedClient }),
    [filters, debouncedClient]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const me = await fetchAgencyMe();
        if (!cancelled) {
          setAgency(me.agency.name);
          setSessionError(null);
          document.title = `${me.agency.name} — Piksel`;
          void fetchAgencyInvoices().catch(() => undefined);
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof AgencyNoLinkError) {
          setSessionError(error.message);
          return;
        }
        router.replace(getClientAgencyPaths().login);
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogout = async () => {
    await agencyLogout();
    router.push(getClientAgencyPaths().login);
    router.refresh();
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Kraunama...
      </div>
    );
  }

  if (sessionError || !agency) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-4">
        <p className="text-gray-700 dark:text-gray-200 max-w-md">
          {sessionError ?? 'Nepavyko užkrauti agentūros portalo.'}
        </p>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Atsijungti
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center">
            <Image
              src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
              alt="Piksel"
              width={200}
              height={64}
              className="h-12 w-auto dark:invert"
              priority
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-gray-400">Agentūra</p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">{agency}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Atsijungti"
              title="Atsijungti"
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <nav
          className="mb-4 inline-flex rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-1"
          aria-label="Agentūros navigacija"
        >
          {agencyViewTabs.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            const photoDisabled = id === 'photo' && !photoProofUrl;
            return (
              <button
                key={id}
                type="button"
                disabled={photoDisabled}
                title={
                  photoDisabled
                    ? 'Photo Proof šiai agentūrai dar nesukonfigūruotas'
                    : undefined
                }
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  active
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </nav>

        {tab === 'invoices' ? (
          <AgencyInvoicesPanel agency={agency} portalMode />
        ) : tab === 'photo' ? (
          <AgencyPhotoPanel url={photoProofUrl} />
        ) : (
          <>
            <AgencySearchFilters
              agency={agency}
              mode={tab}
              countSearchQuery={debouncedSearch}
              countFilters={debouncedFilters}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filters={filters}
              onFiltersChange={setFilters}
              periodTab={periodTab}
              onPeriodTabChange={setPeriodTab}
              portalMode
            />

            {tab === 'list' ? (
              <AgencyOrdersTable
                agency={agency}
                searchQuery={debouncedSearch}
                filters={debouncedFilters}
                periodTab={periodTab}
                onOrderClick={setSelectedOrder}
                portalMode
              />
            ) : (
              <AgencyOrdersCalendar
                agency={agency}
                searchQuery={debouncedSearch}
                filters={debouncedFilters}
                onOrderClick={setSelectedOrder}
                portalMode
              />
            )}
          </>
        )}
      </main>

      <EditOrderModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        variant="agency"
      />
    </div>
  );
}

export default function AgencyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500">
          Kraunama...
        </div>
      }
    >
      <AgencyPortalContent />
    </Suspense>
  );
}
