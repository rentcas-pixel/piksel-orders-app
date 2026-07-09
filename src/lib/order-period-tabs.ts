import { format, startOfDay } from 'date-fns';

export type OrderListPeriodTab = 'all' | 'current' | 'future' | 'past';
export type SplitAwarePeriodTab = 'current' | 'future' | 'past';

/** PB laukai periodų skirtukų post-filter (reikalingi from/to). */
export const PERIOD_TAB_ORDER_FIELDS = 'id,from,to';

/** Maks. PB įrašų skaičius prieš split-aware post-filter. */
export const SPLIT_AWARE_PERIOD_TAB_FETCH_LIMIT = 500;

export function periodTabTodayIso(referenceDate: Date = startOfDay(new Date())): string {
  return format(referenceDate, 'yyyy-MM-dd');
}

export function isSplitAwarePeriodTab(
  tab: OrderListPeriodTab | undefined
): tab is SplitAwarePeriodTab {
  return tab === 'current' || tab === 'future' || tab === 'past';
}

/** Standartinis PocketBase periodų filtras (be split post-filter). */
export function getPeriodTabPocketBaseFilter(
  tab: OrderListPeriodTab,
  options?: { wide?: boolean; today?: string }
): string {
  const today = options?.today ?? periodTabTodayIso();
  const wide = options?.wide ?? false;

  if (wide) {
    switch (tab) {
      case 'current':
        return `(from<="${today}" && to>="${today}")`;
      case 'future':
        return `to>="${today}"`;
      case 'past':
        return `from<="${today}"`;
      default:
        return '';
    }
  }

  switch (tab) {
    case 'current':
      return `(from<="${today}" && to>="${today}")`;
    case 'future':
      return `from>"${today}"`;
    case 'past':
      return `to<"${today}"`;
    default:
      return '';
  }
}

export function paginateItems<T>(
  items: T[],
  page: number,
  perPage: number
): { items: T[]; totalItems: number; totalPages: number } {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const offset = (page - 1) * perPage;
  return {
    items: items.slice(offset, offset + perPage),
    totalItems,
    totalPages,
  };
}
