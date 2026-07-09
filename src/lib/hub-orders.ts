import { fetchOrdersForPeriodTab, type OrdersFetcher } from '@/lib/order-list-pipeline';
import {
  buildOrdersListFilter,
  isSplitAwareOrdersPeriodTab,
  type OrdersListFilters,
  type OrdersPeriodTab,
} from '@/lib/orders-filters';
import { SupabaseService } from '@/lib/supabase-service';
import type { Order } from '@/types';

export type HubOrdersPageResult = {
  items: Order[];
  totalItems: number;
  totalPages: number;
};

export type HubOrdersFilterParams = {
  searchQuery: string;
  filters: OrdersListFilters;
  periodTab: OrdersPeriodTab;
};

export async function fetchHubOrdersForPeriodTab(params: {
  filterParams: HubOrdersFilterParams;
  page: number;
  perPage: number;
  sort: string;
  fields?: string;
  timeoutMs?: number;
  getOrders: OrdersFetcher<Order>;
}): Promise<HubOrdersPageResult> {
  const { filterParams, page, perPage, sort, fields, timeoutMs, getOrders } = params;
  const filter = isSplitAwareOrdersPeriodTab(filterParams.periodTab)
    ? buildOrdersListFilter({ ...filterParams, widePeriodTab: true })
    : buildOrdersListFilter(filterParams);

  return fetchOrdersForPeriodTab({
    filter,
    periodTab: filterParams.periodTab,
    page,
    perPage,
    sort,
    fields,
    timeoutMs,
    getOrders,
    getBillingPeriods: (orderIds) => SupabaseService.getOrderBillingPeriods(orderIds),
  });
}
