import { format, startOfDay, subDays, subMonths } from 'date-fns';

export type OrdersPeriodTab = 'all' | 'current' | 'future' | 'past';
export type OrdersViewMode = 'list' | 'calendar';

function todayIso(): string {
  return format(startOfDay(new Date()), 'yyyy-MM-dd');
}

function getPeriodFilter(tab: OrdersPeriodTab): string {
  const today = todayIso();
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

export interface OrdersListFilters {
  status: string;
  month: string;
  year: string;
  client: string;
  agency: string;
  media_received: string;
  invoice_sent: string;
}

/** Data (YYYY-MM-DD): nepatvirtintos nuo šios datos dar „aktualios“. */
export function staleUnapprovedCutoffIso(): string {
  return format(subMonths(startOfDay(new Date()), 1), 'yyyy-MM-dd');
}

/** PocketBase: slėpti senas nepatvirtintas (pagal `from`), palikti patvirtintas. */
export function buildHideStaleUnapprovedClause(): string {
  const cutoff = staleUnapprovedCutoffIso();
  return `(approved=true || from>="${cutoff}")`;
}

export function isStaleUnapprovedOrder(order: { approved: boolean; from: string }): boolean {
  if (order.approved) return false;
  try {
    const start = startOfDay(new Date(`${order.from}T00:00:00`));
    const cutoff = subMonths(startOfDay(new Date()), 1);
    return start < cutoff;
  } catch {
    return false;
  }
}

/** Konvertuoja tab reikšmes (past/current/future) į konkretų MM ir metus */
export function resolveListMonthYear(
  month: string,
  year: string
): { month: string; year: string } {
  const yearNum = parseInt(year, 10) || new Date().getFullYear();

  if (month === '') {
    return { month: '', year: year.trim() ? String(yearNum) : '' };
  }

  if (/^\d{1,2}$/.test(month)) {
    return { month: month.padStart(2, '0'), year: String(yearNum) };
  }

  const tab = month || 'current';
  let monthNum = new Date().getMonth() + 1;

  if (tab === 'past') {
    monthNum -= 1;
    if (monthNum < 1) monthNum = 12;
  } else if (tab === 'future') {
    monthNum += 1;
    if (monthNum > 12) monthNum = 1;
  }

  return { month: String(monthNum).padStart(2, '0'), year: String(yearNum) };
}

/** Senos reikšmės (current/past/future) arba skaičius → MM */
export function normalizeFilterMonth(month: string): string {
  if (month === '') return '';
  if (/^\d{1,2}$/.test(month)) return month.padStart(2, '0');
  return resolveListMonthYear(month, String(new Date().getFullYear())).month;
}

export function buildOrdersListFilter(params: {
  searchQuery: string;
  filters: OrdersListFilters;
  periodTab?: OrdersPeriodTab;
  calendarYear?: number;
  calendarMonth?: number;
}): string {
  const parts: string[] = [];
  const { searchQuery, filters, periodTab, calendarYear, calendarMonth } = params;
  const { month: resolvedMonth, year: resolvedYear } = resolveListMonthYear(
    filters.month,
    filters.year
  );

  if (searchQuery.trim()) {
    if (searchQuery.toLowerCase().startsWith('viad')) {
      parts.push(
        `(client~"${searchQuery}" || agency~"${searchQuery}" || invoice_id~"${searchQuery}" || viaduct=true)`
      );
    } else {
      parts.push(
        `(client~"${searchQuery}" || agency~"${searchQuery}" || invoice_id~"${searchQuery}")`
      );
    }
  }

  if (filters.status === 'taip') {
    parts.push('approved=true');
  } else if (filters.status === 'ne') {
    parts.push('approved=false');
  }

  if (filters.client.trim()) {
    parts.push(`client~"${filters.client}"`);
  }

  if (filters.agency.trim()) {
    parts.push(`agency~"${filters.agency}"`);
  }

  if (filters.media_received === 'true') {
    parts.push('media_received=true');
  } else if (filters.media_received === 'false') {
    parts.push('media_received=false');
  }

  if (calendarYear !== undefined && calendarMonth !== undefined) {
    const y = calendarYear;
    const m = calendarMonth;
    const lastDay = new Date(y, m, 0).getDate();
    const monthStr = String(m).padStart(2, '0');
    const startDate = `${y}-${monthStr}-01`;
    const endDate = `${y}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    parts.push(`(from<="${endDate}" && to>="${startDate}")`);
  } else if (resolvedMonth && resolvedYear) {
    const y = parseInt(resolvedYear, 10);
    const m = parseInt(resolvedMonth, 10);
    const lastDay = new Date(y, m, 0).getDate();
    const startDate = `${resolvedYear}-${resolvedMonth}-01`;
    const endDate = `${resolvedYear}-${resolvedMonth}-${String(lastDay).padStart(2, '0')}`;
    parts.push(`(from<="${endDate}" && to>="${startDate}")`);
  } else if (resolvedMonth) {
    const m = parseInt(resolvedMonth, 10);
    const monthStr = resolvedMonth;
    const yearFrom = new Date().getFullYear() - 8;
    const yearTo = new Date().getFullYear() + 2;
    const monthClauses: string[] = [];
    for (let y = yearFrom; y <= yearTo; y += 1) {
      const lastDay = new Date(y, m, 0).getDate();
      const startDate = `${y}-${monthStr}-01`;
      const endDate = `${y}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
      monthClauses.push(`(from<="${endDate}" && to>="${startDate}")`);
    }
    parts.push(`(${monthClauses.join(' || ')})`);
  } else if (resolvedYear) {
    parts.push(`(from<="${resolvedYear}-12-31" && to>="${resolvedYear}-01-01")`);
  }

  if (periodTab) {
    const periodFilter = getPeriodFilter(periodTab);
    if (periodFilter) parts.push(periodFilter);
  }

  return parts.join(' && ');
}

export function buildOrdersCalendarFilter(params: {
  searchQuery: string;
  filters: OrdersListFilters;
  year: number;
  month: number;
}): string {
  return buildOrdersListFilter({
    searchQuery: params.searchQuery,
    filters: params.filters,
    calendarYear: params.year,
    calendarMonth: params.month,
  });
}

export function isRecentlyUpdated(updated: string, days = 7): boolean {
  try {
    return new Date(updated) >= subDays(new Date(), days);
  } catch {
    return false;
  }
}
