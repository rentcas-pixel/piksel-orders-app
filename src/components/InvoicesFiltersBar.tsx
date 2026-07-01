'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { FilterTabGroup } from '@/components/FilterTabGroup';
import { filterControlClass } from '@/components/FilterDropdown';
import { MonthTabNavigator } from '@/components/MonthTabNavigator';
import { getYearTabOptions } from '@/lib/filter-options';
import {
  ISSUED_PAYMENT_FILTER_OPTIONS,
  type IssuedInvoicePaymentFilter,
} from '@/lib/issued-invoice-filters';

interface InvoicesFiltersBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  month: string;
  year: string;
  onMonthYearChange: (month: string, year: string) => void;
  paymentFilter: IssuedInvoicePaymentFilter;
  onPaymentFilterChange: (filter: IssuedInvoicePaymentFilter) => void;
  hidePaymentFilter?: boolean;
}

export function InvoicesFiltersBar({
  searchQuery,
  onSearchChange,
  month,
  year,
  onMonthYearChange,
  paymentFilter,
  onPaymentFilterChange,
  hidePaymentFilter = false,
}: InvoicesFiltersBarProps) {
  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-800">
      <div className="space-y-3">
        <div className={`relative ${filterControlClass}`}>
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Ieškoti (klientas, agentūra, kampanija, sąskaita)…"
            className="h-10 w-full rounded-lg bg-transparent pl-10 pr-3 text-sm focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5">
          <MonthTabNavigator
            month={month}
            year={year || String(new Date().getFullYear())}
            onChange={onMonthYearChange}
          />
          <FilterTabGroup
            label="Metai"
            value={year || String(new Date().getFullYear())}
            options={getYearTabOptions()}
            onChange={(v) => onMonthYearChange(month, v)}
          />
          {!hidePaymentFilter && (
            <FilterTabGroup
              label="Apmokėjimas"
              value={paymentFilter}
              options={ISSUED_PAYMENT_FILTER_OPTIONS}
              onChange={(v) => onPaymentFilterChange(v as IssuedInvoicePaymentFilter)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
