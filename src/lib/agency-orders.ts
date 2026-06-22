import { format, startOfDay, subDays } from 'date-fns';
import {
  createCampaignCalculator,
  type CampaignBundle,
  type CampaignScreen,
} from '@/lib/campaign-calculator';
import { PocketBaseService } from '@/lib/pocketbase';
import { resolveListMonthYear } from '@/lib/orders-filters';
import { toCampaignOrderInput, toCampaignScreen } from '@/lib/reklamos-planas-data';
import { getCanonicalAgencyLabel } from '@/lib/agency-names';

export type AgencyPeriodTab = 'all' | 'current' | 'future' | 'past';
export type AgencyViewMode = 'list' | 'calendar';

export interface AgencyListFilters {
  status: string;
  month: string;
  year: string;
  client: string;
}

function todayIso(): string {
  return format(startOfDay(new Date()), 'yyyy-MM-dd');
}

export function getPeriodFilter(tab: AgencyPeriodTab): string {
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

export function buildAgencyOrdersFilter(params: {
  agency: string;
  searchQuery: string;
  filters: AgencyListFilters;
  periodTab: AgencyPeriodTab;
}): string {
  const parts: string[] = [];
  const { agency, searchQuery, filters, periodTab } = params;

  if (agency.trim()) {
    parts.push(`agency~"${agency.trim()}"`);
  }

  if (searchQuery.trim()) {
    parts.push(
      `(client~"${searchQuery}" || agency~"${searchQuery}" || invoice_id~"${searchQuery}")`
    );
  }

  if (filters.status === 'taip') {
    parts.push('approved=true');
  } else if (filters.status === 'ne') {
    parts.push('approved=false');
  }

  if (filters.client.trim()) {
    parts.push(`client~"${filters.client}"`);
  }

  const { month: resolvedMonth, year: resolvedYear } = resolveListMonthYear(
    filters.month,
    filters.year
  );

  if (resolvedMonth && resolvedYear) {
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

  const periodFilter = getPeriodFilter(periodTab);
  if (periodFilter) parts.push(periodFilter);

  return parts.join(' && ');
}

/** Kalendoriaus mėnesiui — be einamos/būsimos/buvusios skirtuko */
export function buildAgencyCalendarFilter(params: {
  agency: string;
  searchQuery: string;
  filters: Pick<AgencyListFilters, 'status' | 'client'>;
  year: number;
  month: number;
}): string {
  const monthStr = String(params.month).padStart(2, '0');
  const yearStr = String(params.year);
  return buildAgencyOrdersFilter({
    agency: params.agency,
    searchQuery: params.searchQuery,
    filters: {
      status: params.filters.status,
      client: params.filters.client,
      month: monthStr,
      year: yearStr,
    },
    periodTab: 'all',
  });
}

export type AgencyPeriodCounts = Record<AgencyPeriodTab, number>;

const PERIOD_TABS: AgencyPeriodTab[] = ['all', 'current', 'future', 'past'];

export async function fetchAgencyPeriodCounts(params: {
  agency: string;
  searchQuery: string;
  filters: AgencyListFilters;
}): Promise<AgencyPeriodCounts> {
  const entries = await Promise.all(
    PERIOD_TABS.map(async (tab) => {
      const filter = buildAgencyOrdersFilter({ ...params, periodTab: tab });
      const result = await PocketBaseService.getOrders({
        page: 1,
        perPage: 1,
        filter,
      });
      return [tab, result.totalItems ?? 0] as const;
    })
  );
  return Object.fromEntries(entries) as AgencyPeriodCounts;
}

function resolveCityLabel(screen: CampaignScreen): string {
  const display = screen.city_display?.trim();
  if (display) return display;
  const city = screen.city?.trim();
  if (!city) return 'Kita';
  const lower = city.toLowerCase();
  if (lower.includes('viln')) return 'Vilnius';
  if (lower.includes('kaun')) return 'Kaunas';
  return city.charAt(0).toUpperCase() + city.slice(1);
}

function citySortKey(label: string): number {
  const lower = label.toLowerCase();
  if (lower.includes('viln')) return 0;
  if (lower.includes('kaun')) return 1;
  return 2;
}

export interface CityOtsRow {
  label: string;
  ots: number;
  screenCount: number;
}

/** @deprecated Naudoti computeCityOtsBreakdown */
export interface CityOtsSummary {
  vilnius: number;
  kaunas: number;
}

export function computeCityOtsBreakdown(
  order: ReturnType<typeof toCampaignOrderInput>,
  allScreens: CampaignScreen[],
  bundles: CampaignBundle[]
): CityOtsRow[] {
  const calc = createCampaignCalculator(order, allScreens, bundles, null);
  const selectedIds = new Set(order.screens.filter(Boolean));
  const byCity = new Map<string, { ots: number; screenCount: number }>();

  for (const screen of allScreens) {
    if (!selectedIds.has(screen.id) || calc.isScreenDisabled(screen)) continue;
    const label = resolveCityLabel(screen);
    const entry = byCity.get(label) ?? { ots: 0, screenCount: 0 };
    entry.ots += calc.ots(screen);
    entry.screenCount += 1;
    byCity.set(label, entry);
  }

  return Array.from(byCity.entries())
    .map(([label, stats]) => ({
      label,
      ots: stats.ots,
      screenCount: stats.screenCount,
    }))
    .sort((a, b) => {
      const orderDiff = citySortKey(a.label) - citySortKey(b.label);
      if (orderDiff !== 0) return orderDiff;
      return a.label.localeCompare(b.label, 'lt');
    });
}

export function computeCityOts(
  order: ReturnType<typeof toCampaignOrderInput>,
  allScreens: CampaignScreen[],
  bundles: CampaignBundle[]
): CityOtsSummary {
  const rows = computeCityOtsBreakdown(order, allScreens, bundles);
  const result: CityOtsSummary = { vilnius: 0, kaunas: 0 };
  for (const row of rows) {
    const lower = row.label.toLowerCase();
    if (lower.includes('viln')) result.vilnius += row.ots;
    else if (lower.includes('kaun')) result.kaunas += row.ots;
  }
  return result;
}

export async function loadCampaignExportData(orderId: string) {
  const fullOrder = await PocketBaseService.getOrder(orderId);
  const [screenRecords, bundles] = await Promise.all([
    PocketBaseService.getCampaignScreens(!!fullOrder.viaduct),
    PocketBaseService.getBundles(),
  ]);
  const campaignOrder = toCampaignOrderInput(
    fullOrder as unknown as Record<string, unknown>
  );
  const screens = screenRecords.map((r) =>
    toCampaignScreen(r as Record<string, unknown>)
  );
  return { campaignOrder, screens, bundles, fullOrder };
}

export async function fetchAgencyOptions(): Promise<string[]> {
  const result = await PocketBaseService.getOrders({
    page: 1,
    perPage: 500,
    sort: 'agency',
  });
  const labels = new Map<string, string>();
  for (const order of result.items) {
    const raw = (order.agency || '').trim();
    if (!raw || raw === '-') continue;
    const label = getCanonicalAgencyLabel(raw);
    const key = label.toLowerCase();
    if (!labels.has(key)) labels.set(key, label);
  }
  return Array.from(labels.values()).sort((a, b) => a.localeCompare(b, 'lt'));
}

export function isRecentlyUpdated(updated: string, days = 7): boolean {
  try {
    const updatedDate = new Date(updated);
    return updatedDate >= subDays(new Date(), days);
  } catch {
    return false;
  }
}

export function formatOts(value: number): string {
  return new Intl.NumberFormat('lt-LT', { maximumFractionDigits: 0 }).format(
    Math.round(value)
  );
}
