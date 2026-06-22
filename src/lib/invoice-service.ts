import { supabase } from '@/lib/supabase';
import type { Invoice, InvoiceSaveInput } from '@/types';
import {
  DEFAULT_INVOICE_SEQUENCE,
  formatPikNumber,
  INVOICE_SEED_ORDER_ID,
  isInvoiceListable,
  parseInvoiceNumber,
} from '@/lib/invoice-utils';

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

  static async getLatestForOrder(orderId: string): Promise<Invoice | null> {
    const invoices = await this.getByOrderId(orderId);
    return invoices[0] ?? null;
  }

  static async saveInvoice(input: InvoiceSaveInput): Promise<Invoice> {
    const existing = await this.getLatestForOrder(input.order_id);
    if (existing) {
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

  static async updateInvoice(
    id: string,
    input: InvoiceSaveInput
  ): Promise<Invoice> {
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
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
  }

  static async getAll(limit = 250): Promise<Invoice[]> {
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
}
