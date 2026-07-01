import type { AgencyRecord } from '@/lib/agency-auth';
import { buildAgencyMatchClause } from '@/lib/agency-orders';
import { getOrdersServer } from '@/lib/pocketbase-server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isCombinedInvoiceOrder, isStandaloneInvoiceOrder } from '@/lib/invoice-utils';
import type { Invoice } from '@/types';

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface AgencyInvoiceMatchContext {
  orderIds: Set<string>;
  clientKeys: Set<string>;
  buyerKeys: Set<string>;
}

export function buildAgencyBuyerKeys(
  agency: Pick<AgencyRecord, 'name' | 'pocketbase_values'>
): Set<string> {
  const keys = new Set<string>();
  for (const value of [agency.name, ...agency.pocketbase_values]) {
    const key = normalizeLabel(value);
    if (key) keys.add(key);
  }
  return keys;
}

export async function fetchAgencyInvoiceMatchContext(
  matchValues: string[],
  agency: Pick<AgencyRecord, 'name' | 'pocketbase_values'>
): Promise<AgencyInvoiceMatchContext> {
  const orderIds = new Set<string>();
  const clientKeys = new Set<string>();
  const filter = buildAgencyMatchClause(matchValues);

  if (filter) {
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const result = await getOrdersServer({
        page,
        perPage: 200,
        filter,
        sort: '-updated',
      });
      totalPages = result.totalPages ?? 1;
      for (const order of result.items) {
        orderIds.add(order.id);
        const client = order.client?.trim();
        if (client) clientKeys.add(normalizeLabel(client));
      }
      page += 1;
    }
  }

  return {
    orderIds,
    clientKeys,
    buyerKeys: buildAgencyBuyerKeys(agency),
  };
}

function labelMatchesAny(label: string, keys: Set<string>): boolean {
  const key = normalizeLabel(label);
  if (!key || keys.size === 0) return false;
  if (keys.has(key)) return true;
  for (const candidate of keys) {
    if (key.includes(candidate) || candidate.includes(key)) return true;
  }
  return false;
}

export function invoiceMatchesAgency(
  invoice: Pick<Invoice, 'order_id' | 'buyer_name'>,
  linkedOrderIds: string[],
  ctx: AgencyInvoiceMatchContext
): boolean {
  if (ctx.orderIds.has(invoice.order_id)) return true;
  if (linkedOrderIds.some((id) => ctx.orderIds.has(id))) return true;
  if (labelMatchesAny(invoice.buyer_name ?? '', ctx.clientKeys)) return true;
  if (labelMatchesAny(invoice.buyer_name ?? '', ctx.buyerKeys)) return true;
  return false;
}

function buildInvoiceLinesMap(
  lines: { invoice_id: string; order_id: string }[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const line of lines) {
    const existing = map.get(line.invoice_id) ?? [];
    existing.push(line.order_id);
    map.set(line.invoice_id, existing);
  }
  return map;
}

export function getLinkedOrderIdsForInvoice(
  invoice: Pick<Invoice, 'id' | 'order_id'>,
  linesByInvoice: Map<string, string[]>
): string[] {
  const fromLines = linesByInvoice.get(invoice.id);
  if (fromLines && fromLines.length > 0) return fromLines;
  if (!isCombinedInvoiceOrder(invoice.order_id) && !isStandaloneInvoiceOrder(invoice.order_id)) {
    return [invoice.order_id];
  }
  return [];
}

export function filterInvoicesForAgency(
  invoices: Invoice[],
  ctx: AgencyInvoiceMatchContext,
  linesByInvoice: Map<string, string[]>
): Invoice[] {
  return invoices.filter((invoice) => {
    const linkedOrderIds = getLinkedOrderIdsForInvoice(invoice, linesByInvoice);
    return invoiceMatchesAgency(invoice, linkedOrderIds, ctx);
  });
}

/** Agentūrų portalui — 3 paralelūs užklausimai, be N+1 ciklo. */
export async function listAgencyInvoicesServer(
  matchValues: string[],
  agency: Pick<AgencyRecord, 'name' | 'pocketbase_values'>
): Promise<Invoice[]> {
  const supabase = createSupabaseAdminClient();
  const [ctx, invoicesResult, linesResult] = await Promise.all([
    fetchAgencyInvoiceMatchContext(matchValues, agency),
    supabase.from('invoices').select('*').order('invoice_date', { ascending: false }),
    supabase.from('invoice_lines').select('invoice_id, order_id'),
  ]);

  if (invoicesResult.error) {
    throw new Error(invoicesResult.error.message);
  }
  if (linesResult.error) {
    throw new Error(linesResult.error.message);
  }

  const linesByInvoice = buildInvoiceLinesMap(linesResult.data ?? []);
  return filterInvoicesForAgency((invoicesResult.data ?? []) as Invoice[], ctx, linesByInvoice);
}
