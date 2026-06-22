'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '@/hooks/useDebounce';
import { AgencyOrdersTable } from '@/components/agency/AgencyOrdersTable';
import { AgencyOrdersCalendar } from '@/components/agency/AgencyOrdersCalendar';
import { EditOrderModal } from '@/components/EditOrderModal';
import { AgencySearchFilters } from '@/components/agency/AgencySearchFilters';
import { type AgencyListFilters, type AgencyPeriodTab, type AgencyViewMode } from '@/lib/agency-orders';
import { Order } from '@/types';

/** Mockup: rodoma kaip prisijungusi agentūra. Vidinei peržiūrai: ?agency=BPN */
const MOCK_AGENCY_NAME = 'Open';

function AgencyPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const agency = searchParams.get('agency')?.trim() || MOCK_AGENCY_NAME;

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<AgencyViewMode>('list');
  const [periodTab, setPeriodTab] = useState<AgencyPeriodTab>('current');
  const [filters, setFilters] = useState<AgencyListFilters>({
    status: 'taip',
    month: '',
    year: String(new Date().getFullYear()),
    client: '',
  });

  const debouncedSearch = useDebounce(searchQuery, 400);
  const debouncedClient = useDebounce(filters.client, 400);
  const debouncedFilters = useMemo(
    () => ({ ...filters, client: debouncedClient }),
    [filters, debouncedClient]
  );

  useEffect(() => {
    document.title = `${agency} — Piksel`;
  }, [agency]);

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
              onClick={() => router.push('/agency/login')}
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
        <AgencySearchFilters
          agency={agency}
          countSearchQuery={debouncedSearch}
          countFilters={debouncedFilters}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          periodTab={periodTab}
          onPeriodTabChange={setPeriodTab}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {viewMode === 'list' ? (
          <AgencyOrdersTable
            agency={agency}
            searchQuery={debouncedSearch}
            filters={debouncedFilters}
            periodTab={periodTab}
            onOrderClick={setSelectedOrder}
          />
        ) : (
          <AgencyOrdersCalendar
            agency={agency}
            searchQuery={debouncedSearch}
            filters={debouncedFilters}
            onOrderClick={setSelectedOrder}
          />
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
