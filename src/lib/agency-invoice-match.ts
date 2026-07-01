import type { AgencyRecord } from '@/lib/agency-auth';
import { getOrdersServer } from '@/lib/pocketbase-server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isCombinedInvoiceOrder, isStandaloneInvoiceOrder } from '@/lib/invoice-utils';
import type { Invoice, Order } from '@/types';

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function escapePocketBaseValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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

export function buildAgencyMatchValues(
  agency: Pick<AgencyRecord, 'name' | 'pocketbase_values'>
): string[] {
  return [...new Set([agency.name, ...agency.pocketbase_values].map((v) => v.trim()).filter(Boolean))];
}

function orderAgencyMatches(orderAgency: string, matchValues: string[]): boolean {
  const agency = normalizeLabel(orderAgency);
  if (!agency) return false;
  return matchValues.some((value) => {
    const key = normalizeLabel(value);
    return key && (agency === key || agency.includes(key) || key.includes(agency));
  });
}

async function fetchOrdersByIds(orderIds: string[]): Promise<Order[]> {
  const uniqueIds = [...new Set(orderIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const batchSize = 50;
  const batches: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    batches.push(uniqueIds.slice(i, i + batchSize));
  }

  const batchResults = await Promise.all(
    batches.map(async (batch) => {
      const filter = batch.map((id) => `id="${escapePocketBaseValue(id)}"`).join(' || ');
      const result = await getOrdersServer({
        page: 1,
        perPage: batchSize,
        filter,
        fields: 'id,client,agency',
        timeoutMs: 20000,
      });
      return result.items;
    })
  );

  return batchResults.flat();
}

/** Sutapatinimas pagal sąskaitose minimus užsakymus — ne visas PB agentūros katalogas. */
export async function fetchAgencyInvoiceMatchContext(
  agency: Pick<AgencyRecord, 'name' | 'pocketbase_values'>,
  referencedOrderIds: Set<string>
): Promise<AgencyInvoiceMatchContext> {
  const matchValues = buildAgencyMatchValues(agency);
  const orderIds = new Set<string>();
  const clientKeys = new Set<string>();

  const orders = await fetchOrdersByIds([...referencedOrderIds]);
  for (const order of orders) {
    if (!orderAgencyMatches(order.agency ?? '', matchValues)) continue;
    orderIds.add(order.id);
    const client = order.client?.trim();
    if (client) clientKeys.add(normalizeLabel(client));
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

function collectReferencedOrderIds(
  invoices: Invoice[],
  linesByInvoice: Map<string, string[]>
): Set<string> {
  const referencedOrderIds = new Set<string>();
  for (const invoice of invoices) {
    for (const orderId of getLinkedOrderIdsForInvoice(invoice, linesByInvoice)) {
      referencedOrderIds.add(orderId);
    }
  }
  return referencedOrderIds;
}

/** Agentūrų portalui — Supabase sąskaitos + tik PB užsakymai, susieti su sąskaitomis. */
export async function listAgencyInvoicesServer(
  agency: Pick<AgencyRecord, 'name' | 'pocketbase_values'>
): Promise<Invoice[]> {
  const supabase = createSupabaseAdminClient();
  const [invoicesResult, linesResult] = await Promise.all([
    supabase.from('invoices').select('*').order('invoice_date', { ascending: false }),
    supabase.from('invoice_lines').select('invoice_id, order_id'),
  ]);

  if (invoicesResult.error) {
    throw new Error(invoicesResult.error.message);
  }
  if (linesResult.error) {
    throw new Error(linesResult.error.message);
  }

  const invoices = (invoicesResult.data ?? []) as Invoice[];
  const linesByInvoice = buildInvoiceLinesMap(linesResult.data ?? []);
  const referencedOrderIds = collectReferencedOrderIds(invoices, linesByInvoice);
  const ctx = await fetchAgencyInvoiceMatchContext(agency, referencedOrderIds);

  return filterInvoicesForAgency(invoices, ctx, linesByInvoice);
}
