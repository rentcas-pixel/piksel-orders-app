'use client';

import { useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { InvoicesFiltersBar } from '@/components/InvoicesFiltersBar';
import { InvoicesTable } from '@/components/InvoicesTable';

import type { IssuedInvoicePaymentFilter } from '@/lib/issued-invoice-filters';

const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

interface AgencyInvoicesPanelProps {
  agency: string;
  portalMode?: boolean;
}

export function AgencyInvoicesPanel({ agency, portalMode = false }: AgencyInvoicesPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [paymentFilter, setPaymentFilter] = useState<IssuedInvoicePaymentFilter>('all');
  const debouncedSearch = useDebounce(searchQuery, 400);

  return (
    <>
      <InvoicesFiltersBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        month={month}
        year={year}
        onMonthYearChange={(nextMonth, nextYear) => {
          setMonth(nextMonth);
          setYear(nextYear);
        }}
        paymentFilter={paymentFilter}
        onPaymentFilterChange={setPaymentFilter}
      />
      <InvoicesTable
        agency={agency}
        portalMode={portalMode}
        searchQuery={debouncedSearch}
        month={month}
        year={year}
        paymentFilter={paymentFilter}
      />
    </>
  );
}
