'use client';

import { useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
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
  const [paymentFilter, setPaymentFilter] = useState<IssuedInvoicePaymentFilter>('all');
  const debouncedSearch = useDebounce(searchQuery, 400);

  return (
    <>
      <InvoicesFiltersBar
        month={month}
        year={year}
        onMonthYearChange={(nextMonth, nextYear) => {
          setMonth(nextMonth);
          setYear(nextYear);
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
        paymentFilter={paymentFilter}
      />
    </>
  );
}
