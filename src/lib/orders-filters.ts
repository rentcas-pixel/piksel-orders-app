export interface OrdersListFilters {
  status: string;
  month: string;
  year: string;
  client: string;
  agency: string;
  media_received: string;
  invoice_sent: string;
}

export function buildOrdersListFilter(params: {
  searchQuery: string;
  filters: OrdersListFilters;
  calendarYear?: number;
  calendarMonth?: number;
}): string {
  const parts: string[] = [];
  const { searchQuery, filters, calendarYear, calendarMonth } = params;

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
  } else if (filters.month && filters.year) {
    const y = parseInt(filters.year, 10);
    const m = parseInt(filters.month, 10);
    const lastDay = new Date(y, m, 0).getDate();
    const startDate = `${filters.year}-${filters.month.padStart(2, '0')}-01`;
    const endDate = `${filters.year}-${filters.month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    parts.push(`(from<="${endDate}" && to>="${startDate}")`);
  } else if (filters.year) {
    parts.push(`(from<="${filters.year}-12-31" && to>="${filters.year}-01-01")`);
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
