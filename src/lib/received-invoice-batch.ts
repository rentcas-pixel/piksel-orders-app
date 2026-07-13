import { addDays, formatInvoiceDate } from '@/lib/invoice-utils';
import type { MistralReceivedInvoiceExtraction } from '@/lib/mistral-received-invoice-ocr';
import {
  computeReceivedInvoiceTotals,
  ReceivedInvoiceService,
} from '@/lib/received-invoice-service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReceivedInvoice, ReceivedInvoiceInput } from '@/types';

export const BATCH_IMPORT_MAX_FILES = 100;
export const BATCH_IMPORT_CONCURRENCY = 1;

export type BatchItemStatus =
  | 'queued'
  | 'scanning'
  | 'saving'
  | 'created'
  | 'updated'
  | 'error';

export interface BatchImportItem {
  id: string;
  file: File;
  status: BatchItemStatus;
  sellerName?: string;
  invoiceNumber?: string;
  totalAmount?: number;
  error?: string;
}

export function extractionToReceivedInvoiceInput(
  data: MistralReceivedInvoiceExtraction
): ReceivedInvoiceInput | null {
  if (!data.seller_name?.trim()) return null;

  const today = formatInvoiceDate(new Date());
  const invoice_date = data.invoice_date || today;

  let amount = data.amount ?? 0;
  let vat_amount = data.vat_amount ?? 0;
  let total_amount = data.total_amount ?? 0;
  const currency = (data.currency || 'EUR').toUpperCase();

  if (currency !== 'EUR') {
    amount = data.amount && data.amount > 0 ? data.amount : data.total_amount ?? 0;
    vat_amount = 0;
    total_amount = data.total_amount && data.total_amount > 0 ? data.total_amount : amount;
  } else if (amount > 0) {
    const totals = computeReceivedInvoiceTotals(amount);
    amount = totals.amount;
    vat_amount = data.vat_amount && data.vat_amount > 0 ? data.vat_amount : totals.vat_amount;
    total_amount = data.total_amount && data.total_amount > 0 ? data.total_amount : totals.total_amount;
  } else if (total_amount > 0) {
    const derived = computeReceivedInvoiceTotals(Math.round((total_amount / 1.21) * 100) / 100);
    amount = derived.amount;
    vat_amount = data.vat_amount && data.vat_amount > 0 ? data.vat_amount : derived.vat_amount;
    total_amount = data.total_amount ?? derived.total_amount;
  } else {
    return null;
  }

  return {
    seller_name: data.seller_name.trim(),
    seller_company_code: data.seller_company_code?.trim() || null,
    seller_vat_code: data.seller_vat_code?.trim() || null,
    seller_address: data.seller_address?.trim() || null,
    invoice_number: data.invoice_number?.trim() || null,
    invoice_date,
    due_date: data.due_date || addDays(invoice_date, 30),
    payment_date: null,
    category: 'kita',
    description: data.description?.trim() || null,
    notes: null,
    file_url: null,
    file_name: null,
    amount,
    vat_amount,
    total_amount,
    currency,
  };
}

export async function scanReceivedInvoiceFile(
  file: File
): Promise<MistralReceivedInvoiceExtraction> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/ocr/received-invoice', {
    method: 'POST',
    body: formData,
  });

  const raw = await response.text();
  let payload: { data?: MistralReceivedInvoiceExtraction; error?: string };
  try {
    payload = JSON.parse(raw) as { data?: MistralReceivedInvoiceExtraction; error?: string };
  } catch {
    throw new Error(
      response.ok
        ? 'Neteisingas serverio atsakymas'
        : `Serverio klaida (${response.status}). Patikrinkite ar Vercel turi MISTRAL_API_KEY.`
    );
  }

  if (!response.ok) {
    throw new Error(payload.error || `OCR klaida (${response.status})`);
  }
  if (!payload.data) {
    throw new Error('Tuščias OCR atsakymas');
  }
  return payload.data;
}

export async function saveReceivedInvoiceFromExtraction(
  file: File,
  input: ReceivedInvoiceInput,
  options?: { client?: SupabaseClient }
): Promise<{ invoice: ReceivedInvoice; action: 'created' | 'updated' }> {
  const client = options?.client;
  const duplicate = await ReceivedInvoiceService.findDuplicate(input, undefined, client);

  let invoice: ReceivedInvoice;
  let action: 'created' | 'updated';

  if (duplicate) {
    invoice = await ReceivedInvoiceService.update(duplicate.id, input, client);
    action = 'updated';
  } else {
    invoice = await ReceivedInvoiceService.create(input, client);
    action = 'created';
  }

  try {
    const uploaded = await ReceivedInvoiceService.uploadFile(invoice.id, file, client);
    invoice = await ReceivedInvoiceService.update(
      invoice.id,
      {
        ...input,
        file_url: uploaded.file_url,
        file_name: uploaded.file_name,
      },
      client
    );
  } catch (uploadError) {
    console.error('received invoice file upload:', uploadError);
  }

  return { invoice, action };
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
  isCancelled: () => boolean
): Promise<void> {
  let nextIndex = 0;

  async function runWorker() {
    while (!isCancelled()) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
}

export async function runBatchImport(options: {
  items: BatchImportItem[];
  onItemChange: (id: string, patch: Partial<BatchImportItem>) => void;
  isCancelled: () => boolean;
}): Promise<void> {
  const { items, onItemChange, isCancelled } = options;

  await runWithConcurrency(
    items,
    BATCH_IMPORT_CONCURRENCY,
    async (item) => {
      if (isCancelled()) return;

      onItemChange(item.id, { status: 'scanning', error: undefined });

      try {
        const extracted = await scanReceivedInvoiceFile(item.file);
        if (isCancelled()) return;

        const input = extractionToReceivedInvoiceInput(extracted);
        if (!input) {
          onItemChange(item.id, {
            status: 'error',
            error: 'Nepavyko ištraukti privalomų laukų (tiekėjas arba suma)',
          });
          return;
        }

        onItemChange(item.id, {
          status: 'saving',
          sellerName: input.seller_name,
          invoiceNumber: input.invoice_number ?? undefined,
          totalAmount: input.total_amount,
        });

        const { invoice, action } = await saveReceivedInvoiceFromExtraction(item.file, input);

        onItemChange(item.id, {
          status: action === 'updated' ? 'updated' : 'created',
          sellerName: invoice.seller_name,
          invoiceNumber: invoice.invoice_number ?? undefined,
          totalAmount: Number(invoice.total_amount),
        });
      } catch (error) {
        onItemChange(item.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Nežinoma klaida',
        });
      }
    },
    isCancelled
  );
}

export function createBatchItems(files: File[]): BatchImportItem[] {
  return files.map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    file,
    status: 'queued' as const,
  }));
}
