import { unstable_cache } from 'next/cache';
import type { AgencyRecord } from '@/lib/agency-auth';
import { listAgencyInvoicesServer } from '@/lib/agency-invoice-match';
import {
  AGENCY_PERIOD_TAB_ORDER_FIELDS,
  fetchAgencyOrdersForPeriodTab,
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
          const result = await fetchAgencyOrdersForPeriodTab({
            filterParams: {
              agencyMatchValues: matchValues,
              searchQuery,
              filters,
              periodTab: tab,
            },
            page: 1,
            perPage: 1,
            sort: '-updated',
            fields: AGENCY_PERIOD_TAB_ORDER_FIELDS,
            timeoutMs: 20000,
            getOrders: (opts) =>
              getOrdersServer(opts).then((page) => ({
                items: page.items ?? [],
                totalItems: page.totalItems ?? 0,
                totalPages: page.totalPages ?? 1,
              })),
          });
          return [tab, result.totalItems] as const;
        })
      );
      return Object.fromEntries(entries) as AgencyPeriodCounts;
    },
    ['agency-period-counts', 'v2', matchValues.join(','), filterKey],
    { revalidate: 60 }
  )();
}
