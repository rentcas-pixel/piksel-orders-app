'use client';

import { useState } from 'react';
import { useDebouncedSearchQuery } from '@/hooks/useDebounce';
import { InvoicesFiltersBar } from '@/components/InvoicesFiltersBar';
import { InvoicesTable } from '@/components/InvoicesTable';

import type { IssuedInvoicePaymentFilter } from '@/lib/issued-invoice-filters';

interface AgencyInvoicesPanelProps {
  agency: string;
  portalMode?: boolean;
}

export function AgencyInvoicesPanel({ agency, portalMode = false }: AgencyInvoicesPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<IssuedInvoicePaymentFilter>('all');
  const debouncedSearch = useDebouncedSearchQuery(searchQuery);

  return (
    <>
      <InvoicesFiltersBar
        month={month}
        year={year}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onMonthYearChange={(nextMonth, nextYear) => {
          setMonth(nextMonth);
          setYear(nextYear);
          setDateFrom('');
          setDateTo('');
        }}
        onDateRangeChange={(nextFrom, nextTo) => {
          setDateFrom(nextFrom);
          setDateTo(nextTo);
        }}
        paymentFilter={paymentFilter}
        onPaymentFilterChange={setPaymentFilter}
        hidePaymentFilter={portalMode}
      />
      <InvoicesTable
        agency={agency}
        portalMode={portalMode}
        searchQuery={debouncedSearch}
        searchInput={searchQuery}
        onSearchInputChange={setSearchQuery}
        month={month}
        year={year}
        dateFrom={dateFrom}
        dateTo={dateTo}
        paymentFilter={paymentFilter}
      />
    </>
  );
}
