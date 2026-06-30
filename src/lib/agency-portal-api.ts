import type { AgencyRecord } from '@/lib/agency-auth';
import type { AgencyListFilters, AgencyPeriodTab } from '@/lib/agency-orders';
import type { Invoice, Order } from '@/types';

export class AgencyAuthError extends Error {
  constructor(message = 'Neprisijungęs') {
    super(message);
    this.name = 'AgencyAuthError';
  }
}

export class AgencyNoLinkError extends Error {
  constructor(message = 'Paskyra nepririšta prie agentūros.') {
    super(message);
    this.name = 'AgencyNoLinkError';
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    throw new AgencyAuthError();
  }
  if (response.status === 403) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new AgencyNoLinkError(body?.error);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchAgencyMe(): Promise<{ agency: AgencyRecord; email: string }> {
  return parseJson(await fetch('/api/agency/me', { cache: 'no-store' }));
}

export async function fetchAgencyOrders(params: {
  page?: number;
  perPage?: number;
  sort?: string;
  searchQuery?: string;
  filters?: AgencyListFilters;
  periodTab?: AgencyPeriodTab;
  calendarYear?: number;
  calendarMonth?: number;
  mode?: 'list' | 'calendar';
}): Promise<{ items: Order[]; totalItems: number; totalPages: number }> {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.perPage) search.set('perPage', String(params.perPage));
  if (params.sort) search.set('sort', params.sort);
  if (params.searchQuery) search.set('searchQuery', params.searchQuery);
  if (params.periodTab) search.set('periodTab', params.periodTab);
  if (params.mode) search.set('mode', params.mode);
  if (params.calendarYear) search.set('calendarYear', String(params.calendarYear));
  if (params.calendarMonth) search.set('calendarMonth', String(params.calendarMonth));
  if (params.filters) {
    search.set('status', params.filters.status);
    search.set('month', params.filters.month);
    search.set('year', params.filters.year);
    search.set('client', params.filters.client);
    search.set('showStaleUnapproved', params.filters.showStaleUnapproved ? '1' : '0');
  }
  return parseJson(await fetch(`/api/agency/orders?${search}`, { cache: 'no-store' }));
}

export async function fetchAgencyPeriodCounts(params: {
  searchQuery: string;
  filters: AgencyListFilters;
}): Promise<Record<AgencyPeriodTab, number>> {
  const search = new URLSearchParams({
    searchQuery: params.searchQuery,
    status: params.filters.status,
    month: params.filters.month,
    year: params.filters.year,
    client: params.filters.client,
    showStaleUnapproved: params.filters.showStaleUnapproved ? '1' : '0',
  });
  return parseJson(await fetch(`/api/agency/period-counts?${search}`, { cache: 'no-store' }));
}

export async function fetchAgencyInvoices(): Promise<Invoice[]> {
  const data = await parseJson<{ items: Invoice[] }>(
    await fetch('/api/agency/invoices', { cache: 'no-store' })
  );
  return data.items;
}

export async function agencyLogout(): Promise<void> {
  const { createSupabaseBrowserClient } = await import('@/lib/supabase/browser');
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.signOut();
}
