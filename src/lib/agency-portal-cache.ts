import { unstable_cache } from 'next/cache';
import type { AgencyRecord } from '@/lib/agency-auth';
import { listAgencyInvoicesServer } from '@/lib/agency-invoice-match';
import {
  buildAgencyOrdersFilter,
  type AgencyListFilters,
  type AgencyPeriodCounts,
  type AgencyPeriodTab,
} from '@/lib/agency-orders';
import { getOrdersServer } from '@/lib/pocketbase-server';
import type { Invoice } from '@/types';

const PERIOD_TABS: AgencyPeriodTab[] = ['all', 'current', 'future', 'past'];

function filtersCacheKey(filters: AgencyListFilters, searchQuery: string): string {
  return [
    searchQuery.trim().toLowerCase(),
    filters.status,
    filters.month,
    filters.year,
    filters.client.trim().toLowerCase(),
    filters.showStaleUnapproved ? '1' : '0',
  ].join('|');
}

export function getAgencyInvoicesCached(
  agency: Pick<AgencyRecord, 'id' | 'name' | 'pocketbase_values'>
): Promise<Invoice[]> {
  return unstable_cache(
    () => listAgencyInvoicesServer(agency),
    ['agency-invoices', agency.id],
    { revalidate: 120, tags: [`agency-invoices-${agency.id}`] }
  )();
}

export function getAgencyPeriodCountsCached(
  matchValues: string[],
  searchQuery: string,
  filters: AgencyListFilters
): Promise<AgencyPeriodCounts> {
  const filterKey = filtersCacheKey(filters, searchQuery);
  return unstable_cache(
    async () => {
      const entries = await Promise.all(
        PERIOD_TABS.map(async (tab) => {
          const filter = buildAgencyOrdersFilter({
            agencyMatchValues: matchValues,
            searchQuery,
            filters,
            periodTab: tab,
          });
          const result = await getOrdersServer({
            page: 1,
            perPage: 1,
            filter,
            fields: 'id',
            timeoutMs: 20000,
          });
          return [tab, result.totalItems ?? 0] as const;
        })
      );
      return Object.fromEntries(entries) as AgencyPeriodCounts;
    },
    ['agency-period-counts', matchValues.join(','), filterKey],
    { revalidate: 60 }
  )();
}
