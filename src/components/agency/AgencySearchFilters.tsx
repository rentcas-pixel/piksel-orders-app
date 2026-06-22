'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import { FilterDropdown, filterControlClass, type FilterOption } from '@/components/FilterDropdown';
import {
  fetchAgencyPeriodCounts,
  type AgencyListFilters,
  type AgencyPeriodCounts,
  type AgencyPeriodTab,
  type AgencyViewMode,
} from '@/lib/agency-orders';

interface AgencySearchFiltersProps {
  agency: string;
  countSearchQuery: string;
  countFilters: AgencyListFilters;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: AgencyListFilters;
  onFiltersChange: (filters: AgencyListFilters) => void;
  periodTab: AgencyPeriodTab;
  onPeriodTabChange: (tab: AgencyPeriodTab) => void;
  viewMode: AgencyViewMode;
  onViewModeChange: (mode: AgencyViewMode) => void;
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
  countSearchQuery,
  countFilters,
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  periodTab,
  onPeriodTabChange,
  viewMode,
  onViewModeChange,
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
    if (viewMode !== 'list' || !agency.trim()) return;

    let cancelled = false;
    const load = async () => {
      setCountsLoading(true);
      try {
        const counts = await fetchAgencyPeriodCounts({
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
  }, [agency, countSearchQuery, countFilters, viewMode]);

  const handleFilterChange = (key: keyof AgencyListFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="mb-4 space-y-3">
      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-1">
        <button
          type="button"
          onClick={() => onViewModeChange('list')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
            viewMode === 'list'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
          }`}
        >
          <TableCellsIcon className="w-4 h-4" />
          Sąrašas
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('calendar')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
            viewMode === 'calendar'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
          }`}
        >
          <CalendarDaysIcon className="w-4 h-4" />
          Kalendorius
        </button>
      </div>

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
            viewMode === 'list' ? 'xl:w-[28rem]' : 'xl:w-44'
          }`}
        >
          <FilterDropdown
            value={filters.status}
            options={statuses}
            placeholder="Statusas"
            onChange={(v) => handleFilterChange('status', v)}
          />

          {viewMode === 'list' && (
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

      {viewMode === 'list' && (
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
      )}
    </div>
  );
}
