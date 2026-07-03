import { supabase } from '@/lib/supabase';
import { listAgencyInvoicesServer } from '@/lib/agency-invoice-match';
import {
  type OrderInvoiceCoverage,
  periodCoversBillingMonth,
  periodsOverlap,
} from '@/lib/invoice-month-status';
import {
  computeInvoiceTotals,
  getInvoiceVatRate,
  isCombinedInvoiceOrder,
  isStandaloneInvoiceOrder,
} from '@/lib/invoice-utils';
import type { Invoice, InvoiceLine, InvoiceLineInput, InvoiceSaveInput } from '@/types';
import {
  DEFAULT_INVOICE_SEQUENCE,
  formatPikNumber,
  INVOICE_SEED_ORDER_ID,
  isInvoiceListable,
  parseInvoiceNumber,
} from '@/lib/invoice-utils';
import { SupabaseService } from '@/lib/supabase-service';
import { PocketBaseService } from '@/lib/pocketbase';
import { isMultiMonthOrder } from '@/lib/invoice-utils';

export class InvoiceService {
  static async getLastInvoiceSequence(): Promise<number> {
    try {
      const { data, error } = await supabase.from('invoices').select('invoice_number');

      if (error) throw error;

      let maxSeq = DEFAULT_INVOICE_SEQUENCE;
      for (const row of data ?? []) {
        const seq = parseInvoiceNumber(row.invoice_number);
        if (seq > maxSeq) maxSeq = seq;
      }
      return maxSeq;
    } catch (error) {
      console.error('getLastInvoiceSequence:', error);
      return DEFAULT_INVOICE_SEQUENCE;
    }
  }

  static async getNextInvoiceNumber(): Promise<string> {
    const seq = await this.getLastInvoiceSequence();
    return formatPikNumber(seq + 1);
  }

  static async getLinesForInvoice(invoiceId: string): Promise<InvoiceLine[]> {
    const { data, error } = await supabase
      .from('invoice_lines')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('getLinesForInvoice:', error);
      return [];
    }
    return (data ?? []) as InvoiceLine[];
  }

  static async hasInvoiceLines(invoiceId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('invoice_lines')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_id', invoiceId);

    if (error) {
      console.error('hasInvoiceLines:', error);
      return false;
    }
    return (count ?? 0) > 0;
  }

  static async getInvoiceIdForOrder(orderId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('invoice_lines')
      .select('invoice_id')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('getInvoiceIdForOrder:', error);
      return null;
    }
    return data?.invoice_id ?? null;
  }

  static async getLatestForOrder(orderId: string): Promise<Invoice | null> {
    const linkedId = await this.getInvoiceIdForOrder(orderId);
    if (linkedId) {
      const invoice = await this.getById(linkedId);
      if (invoice) return invoice;
    }

    const invoices = await this.getByOrderId(orderId);
    return invoices[0] ?? null;
  }

  static async getForOrderBillingMonth(
    orderId: string,
    month: string,
    year: string
  ): Promise<Invoice | null> {
    const billing = { month: month.padStart(2, '0'), year };
    const invoices = await this.getByOrderId(orderId);

    for (const invoice of invoices) {
      if (isCombinedInvoiceOrder(invoice.order_id)) continue;
      if (
        periodCoversBillingMonth(
          invoice.period_from,
          invoice.period_to,
          invoice.invoice_date,
          billing
        )
      ) {
        return invoice;
      }
    }

    const { data: lines, error } = await supabase
      .from('invoice_lines')
      .select('invoice_id, period_from, period_to, invoices!inner(id, order_id, invoice_date, period_from, period_to)')
      .eq('order_id', orderId);

    if (error) {
      console.error('getForOrderBillingMonth lines:', error);
      return null;
    }

    for (const line of lines ?? []) {
      const invoice = line.invoices as unknown as Invoice | null;
      if (!invoice) continue;
      if (
        periodCoversBillingMonth(
          line.period_from ?? invoice.period_from,
          line.period_to ?? invoice.period_to,
          invoice.invoice_date,
          billing
        )
      ) {
        return this.getById(invoice.id);
      }
    }

    return null;
  }

  static async getOrderInvoiceCoverages(orderIds: string[]): Promise<OrderInvoiceCoverage[]> {
    const uniqueOrderIds = [...new Set(orderIds.filter(Boolean))];
    if (uniqueOrderIds.length === 0) return [];

    const coverages: OrderInvoiceCoverage[] = [];

    const { data: directInvoices, error: directError } = await supabase
      .from('invoices')
      .select('id, order_id, period_from, period_to, invoice_date')
      .in('order_id', uniqueOrderIds);

    if (directError) {
      console.error('getOrderInvoiceCoverages direct:', directError);
    } else {
      for (const invoice of directInvoices ?? []) {
        if (isCombinedInvoiceOrder(invoice.order_id) || isStandaloneInvoiceOrder(invoice.order_id)) {
          continue;
        }
        coverages.push({
          orderId: invoice.order_id,
          invoiceId: invoice.id,
          periodFrom: invoice.period_from,
          periodTo: invoice.period_to,
          invoiceDate: invoice.invoice_date,
        });
      }
    }

    const { data: lines, error: lineError } = await supabase
      .from('invoice_lines')
      .select('order_id, period_from, period_to, invoice_id, invoices!inner(invoice_date, period_from, period_to)')
      .in('order_id', uniqueOrderIds);

    if (lineError) {
      console.error('getOrderInvoiceCoverages lines:', lineError);
      return coverages;
    }

    for (const line of lines ?? []) {
      const invoice = line.invoices as unknown as {
        invoice_date: string;
        period_from?: string | null;
        period_to?: string | null;
      } | null;
      if (!invoice) continue;
      coverages.push({
        orderId: line.order_id,
        invoiceId: line.invoice_id,
        periodFrom: line.period_from ?? invoice.period_from ?? null,
        periodTo: line.period_to ?? invoice.period_to ?? null,
        invoiceDate: invoice.invoice_date,
      });
    }

    return coverages;
  }

  static async syncLegacyInvoiceStatus(orderId: string): Promise<void> {
    const coverages = await this.getOrderInvoiceCoverages([orderId]);
    const orderCoverages = coverages.filter((entry) => entry.orderId === orderId);

    let order = null;
    try {
      order = await PocketBaseService.getOrder(orderId);
    } catch {
      order = null;
    }

    if (order && isMultiMonthOrder(order)) {
      if (orderCoverages.length > 0) {
        await SupabaseService.applyCoverageMonthFlags(
          orderId,
          orderCoverages.map((entry) => ({
            periodFrom: entry.periodFrom,
            periodTo: entry.periodTo,
            invoiceDate: entry.invoiceDate,
          }))
        );
      }
      await SupabaseService.upsertInvoiceStatus(orderId, {
        invoice_issued: false,
        invoice_sent: false,
      });
      return;
    }

    const hasAny = orderCoverages.length > 0;
    await SupabaseService.upsertInvoiceStatus(orderId, {
      invoice_issued: hasAny,
      ...(hasAny ? {} : { invoice_sent: false }),
    });
  }

  static async getById(id: string): Promise<Invoice | null> {
    const { data, error } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
    if (error) {
      console.error('getById:', error);
      return null;
    }
    return data;
  }

  static async getOrderIdsForInvoice(invoiceId: string): Promise<string[]> {
    const lines = await this.getLinesForInvoice(invoiceId);
    if (lines.length > 0) {
      return lines.map((l) => l.order_id);
    }
    const invoice = await this.getById(invoiceId);
    if (invoice && !isCombinedInvoiceOrder(invoice.order_id) && !isStandaloneInvoiceOrder(invoice.order_id)) {
      return [invoice.order_id];
    }
    return [];
  }

  static async saveInvoice(input: InvoiceSaveInput): Promise<Invoice> {
    let existing: Invoice | null = null;

    if (input.period_from && input.period_to) {
      const invoices = await this.getByOrderId(input.order_id);
      existing =
        invoices.find(
          (invoice) =>
            !isCombinedInvoiceOrder(invoice.order_id) &&
            periodsOverlap(
              invoice.period_from,
              invoice.period_to,
              input.period_from!,
              input.period_to!
            )
        ) ?? null;
    }

    if (!existing) {
      const latest = await this.getLatestForOrder(input.order_id);
      if (latest && !isCombinedInvoiceOrder(latest.order_id)) {
        if (!input.period_from || !input.period_to) {
          existing = latest;
        }
      }
    }

    if (existing && !isCombinedInvoiceOrder(existing.order_id)) {
      return this.updateInvoice(existing.id, input);
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert([
        {
          ...input,
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async saveCombinedInvoice(
    input: InvoiceSaveInput,
    lines: InvoiceLineInput[],
    existingInvoiceId?: string | null
  ): Promise<Invoice> {
    let invoice: Invoice;
    const previousOrderIds = existingInvoiceId
      ? await this.getOrderIdsForInvoice(existingInvoiceId)
      : [];

    if (existingInvoiceId) {
      invoice = await this.updateInvoice(existingInvoiceId, input);
      const { error: delError } = await supabase
        .from('invoice_lines')
        .delete()
        .eq('invoice_id', existingInvoiceId);
      if (delError) throw delError;
    } else {
      const { data, error } = await supabase
        .from('invoices')
        .insert([{ ...input, updated_at: new Date().toISOString() }])
        .select()
        .single();
      if (error) throw error;
      invoice = data;
    }

    const rows = lines.map((line) => ({
      ...line,
      invoice_id: invoice.id,
    }));

    const { error: lineError } = await supabase.from('invoice_lines').insert(rows);
    if (lineError) throw lineError;

    const orderIds = lines.map((l) => l.order_id);
    const removedOrderIds = previousOrderIds.filter((id) => !orderIds.includes(id));

    await Promise.all(
      orderIds.map((orderId) => InvoiceService.syncLegacyInvoiceStatus(orderId))
    );

    await Promise.all(
      removedOrderIds.map((orderId) => InvoiceService.syncLegacyInvoiceStatus(orderId))
    );

    return invoice;
  }

  /** Pašalina vieną užsakymą iš sujungtos sąskaitos ir atstato jo būseną. */
  static async removeOrderFromCombinedInvoice(
    invoiceId: string,
    orderId: string
  ): Promise<Invoice | null> {
    const invoice = await this.getById(invoiceId);
    if (!invoice) return null;

    const { error: delError } = await supabase
      .from('invoice_lines')
      .delete()
      .eq('invoice_id', invoiceId)
      .eq('order_id', orderId);
    if (delError) throw delError;

    await InvoiceService.syncLegacyInvoiceStatus(orderId);

    const remainingLines = await this.getLinesForInvoice(invoiceId);
    if (remainingLines.length === 0) {
      const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
      if (error) throw error;
      return null;
    }

    const vatRate = getInvoiceVatRate(invoice);
    const totals = computeInvoiceTotals(
      remainingLines.map((line) => Number(line.amount)),
      vatRate
    );
    const firstLine = remainingLines[0];

    return this.updateInvoice(invoiceId, {
      order_id: invoice.order_id,
      invoice_number: invoice.invoice_number,
      amount: totals.amount,
      vat_amount: totals.vat_amount,
      total_amount: totals.total_amount,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      buyer_name: invoice.buyer_name,
      buyer_company_code: invoice.buyer_company_code,
      buyer_vat_code: invoice.buyer_vat_code,
      buyer_address: invoice.buyer_address,
      line_description: firstLine.line_description,
      period_from: firstLine.period_from,
      period_to: firstLine.period_to,
    });
  }

  static async updateInvoice(id: string, input: InvoiceSaveInput): Promise<Invoice> {
    const { data, error } = await supabase
      .from('invoices')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteInvoice(id: string): Promise<void> {
    const orderIds = await this.getOrderIdsForInvoice(id);

    const { error: lineError } = await supabase.from('invoice_lines').delete().eq('invoice_id', id);
    if (lineError) throw lineError;

    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;

    await Promise.all(orderIds.map((orderId) => InvoiceService.syncLegacyInvoiceStatus(orderId)));
  }

  static async getAllForDateRange(startDate: string, endDate: string): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .not('buyer_name', 'is', null)
      .neq('buyer_name', '')
      .neq('order_id', INVOICE_SEED_ORDER_ID)
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)
      .order('invoice_date', { ascending: false });

    if (error) {
      console.error('getAllForDateRange:', error);
      return [];
    }
    return (data ?? []).filter(isInvoiceListable);
  }

  static async getAll(limit = 500): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .not('buyer_name', 'is', null)
      .neq('buyer_name', '')
      .neq('order_id', INVOICE_SEED_ORDER_ID)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('getAll invoices:', error);
      return [];
    }
    return (data ?? []).filter(isInvoiceListable);
  }

  static async markAsPaid(id: string, paymentDate: string): Promise<Invoice> {
    const { data: existing, error: fetchError } = await supabase
      .from('invoices')
      .select('total_amount')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('invoices')
      .update({
        payment_date: paymentDate,
        paid_amount: Number(existing.total_amount),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async clearPaymentDate(id: string): Promise<Invoice> {
    await supabase.from('payment_allocations').delete().eq('issued_invoice_id', id);

    const { data, error } = await supabase
      .from('invoices')
      .update({
        payment_date: null,
        paid_amount: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /** Sąskaitos, susietos su agentūros užsakymais (agentūrų portalui). */
  static async getForAgency(agency: string): Promise<Invoice[]> {
    return listAgencyInvoicesServer({
      name: agency,
      pocketbase_values: [agency],
    });
  }

  static async getByOrderId(orderId: string): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('getByOrderId:', error);
      return [];
    }
    return data ?? [];
  }

  static async findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null> {
    const normalized = invoiceNumber.trim();
    if (!normalized) return null;

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('invoice_number', normalized)
      .maybeSingle();

    if (error) {
      console.error('findByInvoiceNumber:', error);
      return null;
    }
    return data;
  }

  static async createImported(input: InvoiceSaveInput): Promise<Invoice> {
    const { data, error } = await supabase
      .from('invoices')
      .insert([
        {
          ...input,
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async uploadFile(
    invoiceId: string,
    file: File
  ): Promise<{ file_url: string; file_name: string }> {
    const safeBaseName = file.name.replace(/[/\\]/g, '-');
    const isPdf =
      safeBaseName.toLowerCase().endsWith('.pdf') ||
      (file.type || '').toLowerCase() === 'application/pdf';

    let storagePath: string;
    let body: Blob;
    let contentType: string;

    if (isPdf) {
      const stem = safeBaseName.replace(/\.pdf$/i, '').trim() || 'invoice';
      const buf = await file.arrayBuffer();
      storagePath = `issued-invoices/${invoiceId}/${Date.now()}_${stem}.pdf`;
      body = new Blob([buf], { type: 'application/pdf' });
      contentType = 'application/pdf';

      let uploadError = (
        await supabase.storage.from('files').upload(storagePath, body, { contentType })
      ).error;

      if (uploadError && /mime|content.?type/i.test(uploadError.message)) {
        storagePath = `issued-invoices/${invoiceId}/${Date.now()}_${stem}.png`;
        body = new Blob([buf], { type: 'image/png' });
        contentType = 'image/png';
        uploadError = (
          await supabase.storage.from('files').upload(storagePath, body, { contentType })
        ).error;
      }

      if (uploadError) throw uploadError;
    } else {
      storagePath = `issued-invoices/${invoiceId}/${Date.now()}_${safeBaseName}`;
      body = file;
      contentType = file.type || 'application/octet-stream';

      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(storagePath, body, { contentType });

      if (uploadError) throw uploadError;
    }

    const { data: urlData } = supabase.storage.from('files').getPublicUrl(storagePath);
    if (!urlData.publicUrl) {
      throw new Error('Nepavyko gauti failo URL');
    }

    return { file_url: urlData.publicUrl, file_name: file.name };
  }
}
