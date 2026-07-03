'use client';

import { FilterTabGroup } from '@/components/FilterTabGroup';
import { MonthTabNavigator } from '@/components/MonthTabNavigator';
import { getYearTabOptions } from '@/lib/filter-options';
import {
  ISSUED_PAYMENT_FILTER_OPTIONS,
  type IssuedInvoicePaymentFilter,
} from '@/lib/issued-invoice-filters';

interface InvoicesFiltersBarProps {
  month: string;
  year: string;
  onMonthYearChange: (month: string, year: string) => void;
  paymentFilter: IssuedInvoicePaymentFilter;
  onPaymentFilterChange: (filter: IssuedInvoicePaymentFilter) => void;
  hidePaymentFilter?: boolean;
}

export function InvoicesFiltersBar({
  month,
  year,
  onMonthYearChange,
  paymentFilter,
  onPaymentFilterChange,
  hidePaymentFilter = false,
}: InvoicesFiltersBarProps) {
  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-800">
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
  );
}
