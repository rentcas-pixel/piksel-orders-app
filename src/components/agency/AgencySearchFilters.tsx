'use client';

import { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { FilterDropdown, filterControlClass, type FilterOption } from '@/components/FilterDropdown';
import {
  fetchAgencyPeriodCounts as fetchAgencyPeriodCountsLocal,
  type AgencyListFilters,
  type AgencyPeriodCounts,
  type AgencyPeriodTab,
  type AgencyViewMode,
} from '@/lib/agency-orders';
import { fetchAgencyPeriodCounts as fetchAgencyPeriodCountsApi } from '@/lib/agency-portal-api';

interface AgencySearchFiltersProps {
  agency: string;
  mode: AgencyViewMode;
  countSearchQuery: string;
  countFilters: AgencyListFilters;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: AgencyListFilters;
  onFiltersChange: (filters: AgencyListFilters) => void;
  periodTab: AgencyPeriodTab;
  onPeriodTabChange: (tab: AgencyPeriodTab) => void;
  portalMode?: boolean;
}

const months: FilterOption[] = [
  { value: '01', label: 'Sausis' },
  { value: '02', label: 'Vasaris' },
  { value: '03', label: 'Kovas' },
  { value: '04', label: 'Balandis' },
  { value: '05', label: 'Gegužė' },
  { value: '06', label: 'Birželis' },
  { value: '07', label: 'Liepa' },
  { value: '08', label: 'Rugpjūtis' },
  { value: '09', label: 'Rugsėjis' },
  { value: '10', label: 'Spalis' },
  { value: '11', label: 'Lapkritis' },
  { value: '12', label: 'Gruodis' },
];

const years: FilterOption[] = Array.from({ length: 5 }, (_, i) => {
  const y = new Date().getFullYear() - 2 + i;
  return { value: String(y), label: String(y) };
});

const statuses: FilterOption[] = [
  { value: '', label: 'Visi statusai' },
  { value: 'taip', label: 'Patvirtinta' },
  { value: 'ne', label: 'Nepatvirtinta' },
];

const periodTabs: { key: AgencyPeriodTab; label: string }[] = [
  { key: 'all', label: 'Visos' },
  { key: 'current', label: 'Einamos' },
  { key: 'future', label: 'Būsimos' },
  { key: 'past', label: 'Buvusios' },
];

export function AgencySearchFilters({
  agency,
  mode,
  countSearchQuery,
  countFilters,
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  periodTab,
  onPeriodTabChange,
  portalMode = false,
}: AgencySearchFiltersProps) {
  const [periodCounts, setPeriodCounts] = useState<AgencyPeriodCounts>({
    all: 0,
    current: 0,
    future: 0,
    past: 0,
  });
  const [countsLoading, setCountsLoading] = useState(false);

  const monthOptions = useMemo<FilterOption[]>(
    () => [{ value: '', label: 'Visi mėnesiai' }, ...months],
    []
  );

  const yearOptions = useMemo<FilterOption[]>(
    () => [{ value: '', label: 'Visi metai' }, ...years],
    []
  );

  useEffect(() => {
    if (mode !== 'list' || !agency.trim()) return;

    let cancelled = false;
    const load = async () => {
      setCountsLoading(true);
      try {
        const counts = portalMode
          ? await fetchAgencyPeriodCountsApi({
              searchQuery: countSearchQuery,
              filters: countFilters,
            })
          : await fetchAgencyPeriodCountsLocal({
              agency,
              searchQuery: countSearchQuery,
              filters: countFilters,
            });
        if (!cancelled) setPeriodCounts(counts);
      } catch {
        if (!cancelled) {
          setPeriodCounts({ all: 0, current: 0, future: 0, past: 0 });
        }
      } finally {
        if (!cancelled) setCountsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [agency, countSearchQuery, countFilters, mode, portalMode]);

  const handleFilterChange = (key: keyof AgencyListFilters, value: string | boolean) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const showStaleToggle = filters.status === '' || filters.status === 'ne';

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-stretch">
        <div className={`relative min-w-0 flex-1 ${filterControlClass}`}>
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Ieškoti pagal klientą, užsakymo nr..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-full w-full rounded-lg bg-transparent pl-10 pr-3 text-sm focus:outline-none"
          />
        </div>

        <div
          className={`flex flex-col gap-2 sm:flex-row sm:items-stretch ${
            mode === 'list' ? 'xl:w-[28rem]' : 'xl:w-44'
          }`}
        >
          <FilterDropdown
            value={filters.status}
            options={statuses}
            placeholder="Statusas"
            onChange={(v) => handleFilterChange('status', v)}
          />

          {mode === 'list' && (
            <>
              <FilterDropdown
                value={filters.month}
                options={monthOptions}
                placeholder="Mėnesis"
                onChange={(v) => handleFilterChange('month', v)}
              />
              <FilterDropdown
                value={filters.year}
                options={yearOptions}
                placeholder="Metai"
                onChange={(v) => handleFilterChange('year', v)}
              />
            </>
          )}
        </div>
      </div>

      {mode === 'list' && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="inline-flex flex-wrap gap-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-1">
            {periodTabs.map((tab) => {
              const active = periodTab === tab.key;
              const count = periodCounts[tab.key];
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onPeriodTabChange(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`min-w-[1.25rem] rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${
                      active
                        ? 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {countsLoading ? '…' : count}
                  </span>
                </button>
              );
            })}
          </div>

          {showStaleToggle && (
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!filters.showStaleUnapproved}
                onChange={(e) => handleFilterChange('showStaleUnapproved', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-gray-900 focus:ring-gray-500"
              />
              Senos nepatvirtintos (&gt;1 mėn.)
            </label>
          )}
        </div>
      )}
    </div>
  );
}
