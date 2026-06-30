import { agencyUnauthorizedResponse, getAgencySession } from '@/lib/agency-auth';
import { fetchAgencyOrderIdsServer } from '@/lib/agency-orders';
import { isCombinedInvoiceOrder, isStandaloneInvoiceOrder } from '@/lib/invoice-utils';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Invoice } from '@/types';

async function getOrderIdsForInvoice(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  invoice: Invoice
): Promise<string[]> {
  const { data: lines } = await supabase
    .from('invoice_lines')
    .select('order_id')
    .eq('invoice_id', invoice.id);

  if (lines && lines.length > 0) {
    return lines.map((row) => row.order_id);
  }
  if (!isCombinedInvoiceOrder(invoice.order_id) && !isStandaloneInvoiceOrder(invoice.order_id)) {
    return [invoice.order_id];
  }
  return [];
}

export async function GET() {
  const session = await getAgencySession();
  if (!session) return agencyUnauthorizedResponse();

  const orderIds = await fetchAgencyOrderIdsServer(session.agency.pocketbase_values);
  const supabase = createSupabaseAdminClient();
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*')
    .order('invoice_date', { ascending: false });

  if (error) {
    return Response.json({ error: 'Nepavyko užkrauti sąskaitų.' }, { status: 500 });
  }

  const seen = new Set<string>();
  const items: Invoice[] = [];

  for (const invoice of invoices ?? []) {
    if (seen.has(invoice.id)) continue;
    if (isStandaloneInvoiceOrder(invoice.order_id)) continue;

    const linkedOrderIds = await getOrderIdsForInvoice(supabase, invoice as Invoice);
    const matchesAgency =
      orderIds.has(invoice.order_id) || linkedOrderIds.some((id) => orderIds.has(id));
    if (!matchesAgency) continue;

    seen.add(invoice.id);
    items.push(invoice as Invoice);
  }

  return Response.json({ items });
}
