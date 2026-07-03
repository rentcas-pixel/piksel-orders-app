import { PocketBaseService } from '@/lib/pocketbase';
import { buildLineDescription } from '@/lib/invoice-locale';
import {
  defaultInvoiceDate,
  invoiceDateForBillingPeriod,
  resolveInvoiceAmountAndPeriod,
} from '@/lib/invoice-utils';
import { resolveListMonthYear } from '@/lib/orders-filters';
import { resolveBillingContext } from '@/lib/invoice-month-status';
import { SupabaseService } from '@/lib/supabase-service';
import type { InvoiceLineInput, Order } from '@/types';

export interface CombinedInvoiceCandidate {
  order: Order;
  monthlyAmount: number;
  periodFrom: string;
  periodTo: string;
  lineDescription: string;
  invoiceIssued: boolean;
}

function buildMonthOverlapFilter(month: string, year: string): string {
  const { month: resolvedMonth, year: resolvedYear } = resolveListMonthYear(month, year);
  if (!resolvedMonth || !resolvedYear) return '';

  const y = parseInt(resolvedYear, 10);
  const m = parseInt(resolvedMonth, 10);
  const lastDay = new Date(y, m, 0).getDate();
  const monthStr = String(m).padStart(2, '0');
  const startDate = `${resolvedYear}-${monthStr}-01`;
  const endDate = `${resolvedYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  return `(from<="${endDate}" && to>="${startDate}")`;
}

function buildSearchFilter(query: string): string {
  const q = query.trim();
  if (!q) return '';
  if (q.toLowerCase().startsWith('viad')) {
    return `(client~"${q}" || agency~"${q}" || invoice_id~"${q}" || viaduct=true)`;
  }
  return `(client~"${q}" || agency~"${q}" || invoice_id~"${q}")`;
}

export function matchesCandidateSearch(
  candidate: CombinedInvoiceCandidate,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const o = candidate.order;
  const haystack = [o.client, o.agency, o.invoice_id].join(' ').toLowerCase();
  if (haystack.includes(q)) return true;
  if (q.startsWith('viad') && o.viaduct) return true;
  return false;
}

export async function fetchCombinedInvoiceCandidates(params: {
  month: string;
  year: string;
  search?: string;
  client?: string;
  agency?: string;
  onlyUninvoiced?: boolean;
}): Promise<CombinedInvoiceCandidate[]> {
  const parts = ['approved=true', buildMonthOverlapFilter(params.month, params.year)].filter(Boolean);

  const searchFilter = buildSearchFilter(params.search ?? '');
  if (searchFilter) parts.push(searchFilter);

  if (params.client?.trim()) {
    parts.push(`client~"${params.client.trim()}"`);
  }
  if (params.agency?.trim()) {
    parts.push(`agency~"${params.agency.trim()}"`);
  }

  const filter = parts.join(' && ');
  const result = await PocketBaseService.getOrders({
    page: 1,
    perPage: 500,
    sort: 'client,from',
    filter,
  });

  const orders = result.items ?? [];
  const { month: resolvedMonth, year: resolvedYear } = resolveListMonthYear(params.month, params.year);
  const billingContext = resolveBillingContext(params.month, params.year);
  const statusMap = await SupabaseService.getMonthInvoiceStatuses(orders, billingContext);
  const invoiceDay = invoiceDateForBillingPeriod(resolvedMonth, resolvedYear);

  const candidates: CombinedInvoiceCandidate[] = [];

  for (const order of orders) {
    const invoiceIssued = statusMap[order.id]?.invoice_issued ?? false;
    if (params.onlyUninvoiced !== false && invoiceIssued) continue;

    const resolved = resolveInvoiceAmountAndPeriod(order, invoiceDay, 'monthly');
    candidates.push({
      order,
      monthlyAmount: resolved.amount,
      periodFrom: resolved.from,
      periodTo: resolved.to,
      lineDescription: buildLineDescription(order, resolved.from, resolved.to, 'lt'),
      invoiceIssued,
    });
  }

  return candidates;
}

export function normalizeClientKey(client: string): string {
  return client.trim().toLowerCase();
}

/** Grupavimo raktas sujungtai sąskaitai (ne visada = tikslus client laukas). */
export function resolveCombineGroupKey(order: Pick<Order, 'client'>): string {
  const client = order.client?.trim() ?? '';
  if (!client) return 'client:';

  if (/^perlas\s+ejp\b/i.test(client)) return 'combine:perlas-ejp';
  if (/^perlas\b/i.test(client)) return 'combine:perlas';

  return `client:${normalizeClientKey(client)}`;
}

export function formatCombineGroupLabel(
  groupKey: string,
  sampleOrder?: Pick<Order, 'client'>
): string {
  if (groupKey === 'combine:perlas-ejp') return 'Perlas EJP';
  if (groupKey === 'combine:perlas') return 'Perlas';
  if (groupKey.startsWith('client:')) {
    const fromKey = groupKey.slice(7).trim();
    return sampleOrder?.client?.trim() || fromKey;
  }
  return sampleOrder?.client?.trim() || groupKey;
}

export function ordersShareCombineGroup(orders: Order[]): boolean {
  if (orders.length === 0) return false;
  const keys = new Set(orders.map(resolveCombineGroupKey));
  if (keys.size !== 1) return false;
  const key = [...keys][0];
  return key !== 'client:';
}

/** Pirkėjo paieškos etiketė billing_companies lentelėje (numatytasis modale). */
export function resolveBuyerLookupLabel(orders: Order[]): string {
  if (orders.length === 0) return '';

  const agencies = [...new Set(orders.map((o) => o.agency?.trim()).filter(Boolean))];
  if (agencies.length === 1) return agencies[0];

  const groupKeys = new Set(orders.map(resolveCombineGroupKey));
  if (groupKeys.size === 1) {
    const groupKey = [...groupKeys][0];
    if (groupKey === 'combine:perlas-ejp') return 'EJP';
    if (groupKey === 'combine:perlas') return 'Perlas';
    if (groupKey.startsWith('client:')) {
      const client = orders[0].client?.trim();
      if (client) return client;
    }
  }

  return orders[0].agency?.trim() || orders[0].client?.trim() || '';
}

/** Ar galima sujungti — bet kokios 2+ kampanijos; pirkėją nustatote modale. */
export function validateCombinableOrders(orders: Order[]): string | null {
  if (orders.length < 2) return null;
  return resolveBuyerLookupLabel(orders);
}

/** @deprecated Naudok validateCombinableOrders */
export function validateSameClient(orders: Order[]): string | null {
  return validateCombinableOrders(orders);
}

export function buildLineInputsFromCandidates(
  candidates: CombinedInvoiceCandidate[]
): InvoiceLineInput[] {
  return candidates.map((c, index) => ({
    order_id: c.order.id,
    line_description: c.lineDescription,
    period_from: c.periodFrom,
    period_to: c.periodTo,
    amount: c.monthlyAmount,
    sort_order: index,
  }));
}
