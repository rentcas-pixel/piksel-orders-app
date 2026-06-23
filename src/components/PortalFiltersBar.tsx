'use client';

import { useEffect, useState } from 'react';
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { OrdersListFilters } from '@/lib/orders-filters';
import {
  invoiceFilterOptions,
  mediaFilterOptions,
  statusTabs,
  yearTabs,
} from '@/lib/filter-options';
import { FilterDropdown, filterControlClass } from '@/components/FilterDropdown';
import { FilterTabGroup } from '@/components/FilterTabGroup';
import { MonthTabNavigator } from '@/components/MonthTabNavigator';

interface PortalFiltersBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: OrdersListFilters;
  onFiltersChange: (filters: OrdersListFilters) => void;
  showMonthYear?: boolean;
  embedded?: boolean;
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </div>
  );
}

function countSecondaryFilters(filters: OrdersListFilters): number {
  return [filters.agency, filters.client, filters.media_received, filters.invoice_sent].filter(Boolean)
    .length;
}

export function PortalFiltersBar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  showMonthYear = true,
  embedded = false,
}: PortalFiltersBarProps) {
  const secondaryActiveCount = countSecondaryFilters(filters);
  const [secondaryOpen, setSecondaryOpen] = useState(secondaryActiveCount > 0);

  useEffect(() => {
    if (secondaryActiveCount > 0) setSecondaryOpen(true);
  }, [secondaryActiveCount]);

  const handleFilterChange = (key: keyof OrdersListFilters, value: string | boolean) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearSecondary = () => {
    onFiltersChange({
      ...filters,
      agency: '',
      client: '',
      media_received: '',
      invoice_sent: '',
    });
  };

  const content = (
    <div className="space-y-3">
      <div className={`relative ${filterControlClass}`}>
        <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Ieškoti pagal klientą, agentūrą, užsakymo nr..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 w-full rounded-lg bg-transparent pl-10 pr-3 text-sm focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5">
        <FilterTabGroup
          label="Statusas"
          value={filters.status}
          options={statusTabs}
          onChange={(v) => handleFilterChange('status', v)}
        />
        {showMonthYear && (
          <>
            <MonthTabNavigator
              month={filters.month}
              year={filters.year || '2026'}
              onChange={(month, year) =>
                onFiltersChange({ ...filters, month, year })
              }
            />
            <FilterTabGroup
              label="Metai"
              value={filters.year || '2026'}
              options={yearTabs}
              onChange={(v) => handleFilterChange('year', v)}
            />
          </>
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
        <button
          type="button"
          onClick={() => setSecondaryOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ChevronDownIcon
            className={`h-4 w-4 transition-transform ${secondaryOpen ? 'rotate-180' : ''}`}
          />
          Papildomi filtrai
          {secondaryActiveCount > 0 && (
            <span className="rounded-md bg-gray-900 px-1.5 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-gray-900">
              {secondaryActiveCount}
            </span>
          )}
        </button>

        {secondaryOpen && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Agentūra">
              <div className={filterControlClass}>
                <input
                  type="text"
                  placeholder="Pvz. BPN"
                  value={filters.agency}
                  onChange={(e) => handleFilterChange('agency', e.target.value)}
                  className="h-10 w-full rounded-lg bg-transparent px-3.5 text-sm focus:outline-none"
                />
              </div>
            </FilterField>
            <FilterField label="Klientas">
              <div className={filterControlClass}>
                <input
                  type="text"
                  placeholder="Pvz. Maxima"
                  value={filters.client}
                  onChange={(e) => handleFilterChange('client', e.target.value)}
                  className="h-10 w-full rounded-lg bg-transparent px-3.5 text-sm focus:outline-none"
                />
              </div>
            </FilterField>
            <FilterField label="Media">
              <FilterDropdown
                value={filters.media_received}
                options={mediaFilterOptions}
                placeholder="Visi"
                onChange={(v) => handleFilterChange('media_received', v)}
              />
            </FilterField>
            <FilterField label="Sąskaita">
              <FilterDropdown
                value={filters.invoice_sent}
                options={invoiceFilterOptions}
                placeholder="Visos"
                onChange={(v) => handleFilterChange('invoice_sent', v)}
              />
            </FilterField>
          </div>
        )}

        {secondaryOpen && secondaryActiveCount > 0 && (
          <button
            type="button"
            onClick={clearSecondary}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Išvalyti papildomus
          </button>
        )}
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3">
      {content}
    </div>
  );
}
