import type { Order } from '@/types';
import { filterOrdersForPeriodTab, type OrderBillingPeriodsMap } from '@/lib/order-billing-periods';
import {
  isSplitAwarePeriodTab,
  paginateItems,
  PERIOD_TAB_ORDER_FIELDS,
  SPLIT_AWARE_PERIOD_TAB_FETCH_LIMIT,
  type OrderListPeriodTab,
  type SplitAwarePeriodTab,
} from '@/lib/order-period-tabs';

export type OrdersPageResult<T extends Pick<Order, 'id' | 'from' | 'to'>> = {
  items: T[];
  totalItems: number;
  totalPages: number;
};

export type OrdersFetcher<T> = (params: {
  page: number;
  perPage: number;
  sort: string;
  filter: string;
  fields?: string;
  timeoutMs?: number;
}) => Promise<OrdersPageResult<T>>;

export type FetchOrdersForPeriodTabParams<T extends Pick<Order, 'id' | 'from' | 'to'>> = {
  filter: string;
  periodTab: OrderListPeriodTab;
  page: number;
  perPage: number;
  sort: string;
  fields?: string;
  timeoutMs?: number;
  getOrders: OrdersFetcher<T>;
  getBillingPeriods: (orderIds: string[]) => Promise<OrderBillingPeriodsMap>;
};

/**
 * Bendras order list srautas: PB fetch → billing periods → split tab post-filter → pagination.
 */
export async function fetchOrdersForPeriodTab<T extends Pick<Order, 'id' | 'from' | 'to'>>(
  params: FetchOrdersForPeriodTabParams<T>
): Promise<OrdersPageResult<T>> {
  const { filter, periodTab, page, perPage, sort, fields, timeoutMs, getOrders, getBillingPeriods } =
    params;

  if (!isSplitAwarePeriodTab(periodTab)) {
    return getOrders({ page, perPage, sort, filter, fields, timeoutMs });
  }

  const result = await getOrders({
    page: 1,
    perPage: SPLIT_AWARE_PERIOD_TAB_FETCH_LIMIT,
    sort,
    filter,
    fields: fields ?? PERIOD_TAB_ORDER_FIELDS,
    timeoutMs,
  });

  const periodsMap = await getBillingPeriods(result.items.map((item) => item.id));
  const filtered = filterOrdersForPeriodTab(
    result.items,
    periodTab as SplitAwarePeriodTab,
    periodsMap
  );
  return paginateItems(filtered, page, perPage);
}
