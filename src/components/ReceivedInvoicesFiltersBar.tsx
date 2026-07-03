'use client';

import { FilterTabGroup } from '@/components/FilterTabGroup';
import { MonthTabNavigator } from '@/components/MonthTabNavigator';
import { yearTabs } from '@/lib/filter-options';
import {
  ISSUED_PAYMENT_FILTER_OPTIONS,
  type IssuedInvoicePaymentFilter,
} from '@/lib/issued-invoice-filters';

interface ReceivedInvoicesFiltersBarProps {
  month: string;
  year: string;
  onMonthYearChange: (month: string, year: string) => void;
  statusFilter: IssuedInvoicePaymentFilter;
  onStatusFilterChange: (status: IssuedInvoicePaymentFilter) => void;
}

export function ReceivedInvoicesFiltersBar({
  month,
  year,
  onMonthYearChange,
  statusFilter,
  onStatusFilterChange,
}: ReceivedInvoicesFiltersBarProps) {
  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5">
        <MonthTabNavigator month={month} year={year || '2026'} onChange={onMonthYearChange} />
        <FilterTabGroup
          label="Metai"
          value={year || '2026'}
          options={yearTabs}
          onChange={(v) => onMonthYearChange(month, v)}
        />
        <FilterTabGroup
          label="Apmokėjimas"
          value={statusFilter}
          options={ISSUED_PAYMENT_FILTER_OPTIONS}
          onChange={(v) => onStatusFilterChange(v as IssuedInvoicePaymentFilter)}
        />
      </div>
    </div>
  );
}
