import { supabase } from '@/lib/supabase';
import { calculateVat, VAT_RATE } from '@/lib/invoice-utils';
import { getEffectivePaidAmount, isFullyPaid } from '@/lib/payment-allocation';
import type { ReceivedInvoice, ReceivedInvoiceInput } from '@/types';

export const EXPENSE_CATEGORIES = [
  { value: 'nuoma', label: 'Nuoma' },
  { value: 'it', label: 'IT / programinė įranga' },
  { value: 'transportas', label: 'Transportas' },
  { value: 'komunaliniai', label: 'Komunaliniai' },
  { value: 'reklama', label: 'Reklama' },
  { value: 'paslaugos', label: 'Paslaugos' },
  { value: 'kita', label: 'Kita' },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['value'];

export const INVOICE_CURRENCIES = ['EUR', 'USD', 'GBP'] as const;
export type InvoiceCurrency = (typeof INVOICE_CURRENCIES)[number];

export function formatReceivedInvoiceAmount(amount: number, currency: string | null | undefined): string {
  const code = (currency || 'EUR').toUpperCase();
  if (code === 'USD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (code === 'GBP') {
    return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `€${amount.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function isForeignCurrencyInvoice(
  invoice: Pick<ReceivedInvoice, 'currency' | 'seller_vat_code' | 'seller_company_code' | 'seller_name'>
): boolean {
  const currency = (invoice.currency || 'EUR').toUpperCase();
  if (currency !== 'EUR') return true;

  const vat = invoice.seller_vat_code?.trim().toUpperCase() ?? '';
  if (vat.startsWith('LT') && vat.length > 2) return false;

  const code = invoice.seller_company_code?.trim() ?? '';
  if (/^\d{9}$/.test(code)) return false;

  const seller = invoice.seller_name.toLowerCase();
  if (
    seller.includes('vercel') ||
    seller.includes('stripe') ||
    seller.includes('github') ||
    seller.includes('openai') ||
    seller.includes('google cloud') ||
    seller.includes('amazon web services') ||
    seller.includes('aws ')
  ) {
    return true;
  }

  return !invoice.seller_vat_code && !invoice.seller_company_code;
}

export function getExpenseCategoryLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function computeReceivedInvoiceTotals(amount: number, vatRate = VAT_RATE) {
  const vat_amount = calculateVat(amount, vatRate);
  const total_amount = Math.round((amount + vat_amount) * 100) / 100;
  return { amount, vat_amount, total_amount };
}

export type ReceivedInvoiceStatus = 'paid' | 'unpaid' | 'overdue';

export function getReceivedInvoiceStatus(
  invoice: Pick<ReceivedInvoice, 'payment_date' | 'due_date' | 'paid_amount' | 'total_amount'>
): ReceivedInvoiceStatus {
  const paid = getEffectivePaidAmount(invoice);
  if (isFullyPaid(Number(invoice.total_amount), paid)) return 'paid';
  if (invoice.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(invoice.due_date);
    due.setHours(0, 0, 0, 0);
    if (due < today) return 'overdue';
  }
  return 'unpaid';
}

function resolveUploadContentType(file: File): string {
  const name = file.name.toLowerCase();
  if (file.type) return file.type;
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (/\.(jpe?g|png|gif|webp)$/i.test(name)) return 'image/jpeg';
  return 'application/octet-stream';
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildReceivedInvoiceDuplicateKey(
  invoice: Pick<
    ReceivedInvoiceInput,
    'seller_name' | 'seller_company_code' | 'seller_vat_code' | 'invoice_number'
  >
): string | null {
  const number = invoice.invoice_number?.trim();
  if (!number) return null;

  const code = invoice.seller_company_code?.trim();
  if (code) return `code:${code}|${number.toLowerCase()}`;

  const vat = invoice.seller_vat_code?.trim();
  if (vat) return `vat:${vat.toUpperCase()}|${number.toLowerCase()}`;

  const name = invoice.seller_name?.trim();
  if (name) return `name:${normalizeText(name)}|${number.toLowerCase()}`;

  return null;
}

const CURRENCY_NOTE_RE = /(?:^|\n)__currency:([A-Z]{3})(?:\n|$)/;

function decodeCurrency(invoice: ReceivedInvoice): ReceivedInvoice {
  const fromColumn = invoice.currency?.trim();
  if (fromColumn) return { ...invoice, currency: fromColumn.toUpperCase() };
  const match = invoice.notes?.match(CURRENCY_NOTE_RE);
  if (match) return { ...invoice, currency: match[1] };
  return { ...invoice, currency: 'EUR' };
}

function encodeNotesWithCurrency(
  notes: string | null | undefined,
  currency: string | undefined
): string | null {
  const stripped = (notes ?? '').replace(CURRENCY_NOTE_RE, '').trim();
  const code = (currency || 'EUR').toUpperCase();
  if (code === 'EUR') return stripped || null;
  return stripped ? `${stripped}\n__currency:${code}` : `__currency:${code}`;
}

function isMissingCurrencyColumnError(error: { message?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase();
  return msg.includes('currency') && (msg.includes('column') || msg.includes('schema'));
}

function prepareDbPayload(
  input: ReceivedInvoiceInput & { clear_payment?: boolean },
  includeCurrencyColumn: boolean
): Record<string, unknown> {
  const currency = (input.currency || 'EUR').toUpperCase();
  const payload: Record<string, unknown> = {
    invoice_number: input.invoice_number?.trim() || null,
    seller_name: input.seller_name.trim(),
    seller_company_code: input.seller_company_code?.trim() || null,
    seller_vat_code: input.seller_vat_code?.trim() || null,
    seller_address: input.seller_address?.trim() || null,
    amount: input.amount,
    vat_amount: input.vat_amount,
    total_amount: input.total_amount,
    invoice_date: input.invoice_date,
    due_date: input.due_date?.trim() || null,
    payment_date: input.payment_date || null,
    ...(input.payment_date
      ? { paid_amount: Number(input.total_amount) }
      : input.clear_payment
        ? { paid_amount: 0 }
        : {}),
    category: input.category || null,
    description: input.description?.trim() || null,
    file_url: input.file_url ?? null,
    file_name: input.file_name ?? null,
    notes: includeCurrencyColumn
      ? input.notes?.trim() || null
      : encodeNotesWithCurrency(input.notes, currency),
    updated_at: new Date().toISOString(),
  };

  if (includeCurrencyColumn) {
    payload.currency = currency;
  }

  return payload;
}

export class ReceivedInvoiceService {
  static async getAll(): Promise<ReceivedInvoice[]> {
    const { data, error } = await supabase
      .from('received_invoices')
      .select('*')
      .order('invoice_date', { ascending: false });

    if (error) {
      console.error('received_invoices getAll:', error);
      return [];
    }
    return (data ?? []).map(decodeCurrency);
  }

  static async getById(id: string): Promise<ReceivedInvoice | null> {
    const { data, error } = await supabase
      .from('received_invoices')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('received_invoices getById:', error);
      return null;
    }
    return data ? decodeCurrency(data) : null;
  }

  static async findDuplicate(
    input: Pick<
      ReceivedInvoiceInput,
      'seller_name' | 'seller_company_code' | 'seller_vat_code' | 'invoice_number'
    >,
    excludeId?: string
  ): Promise<ReceivedInvoice | null> {
    const number = input.invoice_number?.trim();
    if (!number) return null;

    const code = input.seller_company_code?.trim();
    if (code) {
      let query = supabase
        .from('received_invoices')
        .select('*')
        .eq('seller_company_code', code)
        .eq('invoice_number', number);
      if (excludeId) query = query.neq('id', excludeId);
      const { data, error } = await query.maybeSingle();
      if (error) console.error('received_invoices findDuplicate:', error);
      if (data) return decodeCurrency(data);
    }

    const vat = input.seller_vat_code?.trim();
    if (vat) {
      let query = supabase
        .from('received_invoices')
        .select('*')
        .eq('seller_vat_code', vat)
        .eq('invoice_number', number);
      if (excludeId) query = query.neq('id', excludeId);
      const { data, error } = await query.maybeSingle();
      if (error) console.error('received_invoices findDuplicate:', error);
      if (data) return decodeCurrency(data);
    }

    const name = input.seller_name?.trim();
    if (name) {
      let query = supabase.from('received_invoices').select('*').eq('invoice_number', number);
      if (excludeId) query = query.neq('id', excludeId);
      const { data, error } = await query;
      if (error) {
        console.error('received_invoices findDuplicate:', error);
        return null;
      }
      const normalized = normalizeText(name);
      const found = (data ?? []).find((row) => normalizeText(row.seller_name) === normalized);
      return found ? decodeCurrency(found) : null;
    }

    return null;
  }

  static async create(input: ReceivedInvoiceInput): Promise<ReceivedInvoice> {
    let payload = prepareDbPayload(input, true);
    let result = await supabase.from('received_invoices').insert([payload]).select().single();

    if (result.error && isMissingCurrencyColumnError(result.error)) {
      payload = prepareDbPayload(input, false);
      result = await supabase.from('received_invoices').insert([payload]).select().single();
    }

    if (result.error) throw result.error;
    return decodeCurrency(result.data);
  }

  static async update(id: string, input: ReceivedInvoiceInput): Promise<ReceivedInvoice> {
    let payload = prepareDbPayload(input, true);
    let result = await supabase
      .from('received_invoices')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (result.error && isMissingCurrencyColumnError(result.error)) {
      payload = prepareDbPayload(input, false);
      result = await supabase
        .from('received_invoices')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    }

    if (result.error) throw result.error;
    return decodeCurrency(result.data);
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase.from('received_invoices').delete().eq('id', id);
    if (error) throw error;
  }

  static async markAsPaid(id: string, paymentDate: string): Promise<ReceivedInvoice> {
    const { data: existing, error: fetchError } = await supabase
      .from('received_invoices')
      .select('total_amount')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('received_invoices')
      .update({
        payment_date: paymentDate,
        paid_amount: Number(existing.total_amount),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return decodeCurrency(data);
  }

  static async clearPaymentDate(id: string): Promise<ReceivedInvoice> {
    await supabase.from('payment_allocations').delete().eq('received_invoice_id', id);

    const { data, error } = await supabase
      .from('received_invoices')
      .update({
        payment_date: null,
        paid_amount: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return decodeCurrency(data);
  }

  static async uploadFile(invoiceId: string, file: File): Promise<{ file_url: string; file_name: string }> {
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
      storagePath = `received-invoices/${invoiceId}/${Date.now()}_${stem}.pdf`;
      body = new Blob([buf], { type: 'application/pdf' });
      contentType = 'application/pdf';

      let uploadError = (
        await supabase.storage.from('files').upload(storagePath, body, { contentType })
      ).error;

      if (uploadError && /mime|content.?type/i.test(uploadError.message)) {
        storagePath = `received-invoices/${invoiceId}/${Date.now()}_${stem}.png`;
        body = new Blob([buf], { type: 'image/png' });
        contentType = 'image/png';
        uploadError = (
          await supabase.storage.from('files').upload(storagePath, body, { contentType })
        ).error;
      }

      if (uploadError) throw uploadError;
    } else {
      storagePath = `received-invoices/${invoiceId}/${Date.now()}_${safeBaseName}`;
      body = file;
      contentType = resolveUploadContentType(file);

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

  static async deduplicateAll(): Promise<{ removed: number }> {
    const all = await this.getAll();
    const groups = new Map<string, ReceivedInvoice[]>();

    for (const invoice of all) {
      const key = buildReceivedInvoiceDuplicateKey(invoice) ?? `solo:${invoice.id}`;
      const list = groups.get(key) ?? [];
      list.push(invoice);
      groups.set(key, list);
    }

    let removed = 0;
    for (const group of groups.values()) {
      if (group.length <= 1) continue;

      group.sort((a, b) => {
        const aHasFile = a.file_url ? 1 : 0;
        const bHasFile = b.file_url ? 1 : 0;
        if (aHasFile !== bHasFile) return bHasFile - aHasFile;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      const [, ...duplicates] = group;
      for (const duplicate of duplicates) {
        await this.delete(duplicate.id);
        removed += 1;
      }
    }

    return { removed };
  }
}
