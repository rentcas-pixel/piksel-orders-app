import {
  addDays,
  createStandaloneInvoiceOrder,
  formatInvoiceDate,
} from '@/lib/invoice-utils';
import { normalizeIssuedInvoiceAmounts } from '@/lib/issued-invoice-amounts';
import type { MistralIssuedInvoiceExtraction } from '@/lib/mistral-issued-invoice-ocr';
import { InvoiceService } from '@/lib/invoice-service';
import type { Invoice, InvoiceSaveInput } from '@/types';

export const ISSUED_BATCH_IMPORT_MAX_FILES = 100;
export const ISSUED_BATCH_IMPORT_CONCURRENCY = 1;

export type IssuedBatchItemStatus =
  | 'queued'
  | 'scanning'
  | 'saving'
  | 'created'
  | 'updated'
  | 'error';

export interface IssuedBatchImportItem {
  id: string;
  file: File;
  status: IssuedBatchItemStatus;
  buyerName?: string;
  invoiceNumber?: string;
  totalAmount?: number;
  amountExVat?: number;
  error?: string;
}

export function extractionToIssuedInvoiceInput(
  data: MistralIssuedInvoiceExtraction
): InvoiceSaveInput | null {
  if (!data.buyer_name?.trim()) return null;
  if (!data.invoice_number?.trim()) return null;

  const totals = normalizeIssuedInvoiceAmounts(data);
  if (!totals) return null;

  const today = formatInvoiceDate(new Date());
  const invoice_date = data.invoice_date || today;

  return {
    order_id: createStandaloneInvoiceOrder().id,
    invoice_number: data.invoice_number.trim(),
    amount: totals.amount,
    vat_amount: totals.vat_amount,
    total_amount: totals.total_amount,
    invoice_date,
    due_date: data.due_date || addDays(invoice_date, 14),
    buyer_name: data.buyer_name.trim(),
    buyer_company_code: data.buyer_company_code?.trim() || null,
    buyer_vat_code: data.buyer_vat_code?.trim() || null,
    buyer_address: data.buyer_address?.trim() || null,
    line_description: data.line_description?.trim() || null,
    period_from: data.period_from || null,
    period_to: data.period_to || null,
    file_url: null,
    file_name: null,
  };
}

export async function scanIssuedInvoiceFile(
  file: File
): Promise<MistralIssuedInvoiceExtraction> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/ocr/issued-invoice', {
    method: 'POST',
    body: formData,
  });

  const raw = await response.text();
  let payload: { data?: MistralIssuedInvoiceExtraction; error?: string };
  try {
    payload = JSON.parse(raw) as { data?: MistralIssuedInvoiceExtraction; error?: string };
  } catch {
    throw new Error(
      response.ok
        ? 'Neteisingas serverio atsakymas'
        : 'Serverio klaida importuojant PDF (perkraukite puslapį ir bandykite dar kartą)'
    );
  }

  if (!response.ok) {
    throw new Error(payload.error || 'OCR klaida');
  }
  if (!payload.data) {
    throw new Error('Tuščias OCR atsakymas');
  }
  return payload.data;
}

async function saveWithOptionalFileColumns(
  invoiceId: string | null,
  input: InvoiceSaveInput,
  create: boolean
): Promise<Invoice> {
  const payload = { ...input };

  const attempt = async (includeFileFields: boolean) => {
    const row = includeFileFields
      ? payload
      : {
          ...payload,
          file_url: undefined,
          file_name: undefined,
        };

    if (create) {
      return InvoiceService.createImported(row);
    }
    if (!invoiceId) throw new Error('Trūksta sąskaitos ID');
    return InvoiceService.updateInvoice(invoiceId, row);
  };

  try {
    return await attempt(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/file_url|file_name|column/i.test(message)) {
      return attempt(false);
    }
    throw error;
  }
}

export async function saveIssuedInvoiceFromExtraction(
  file: File,
  input: InvoiceSaveInput
): Promise<{ invoice: Invoice; action: 'created' | 'updated' }> {
  const duplicate = await InvoiceService.findByInvoiceNumber(input.invoice_number);

  let invoice: Invoice;
  let action: 'created' | 'updated';

  if (duplicate) {
    invoice = await saveWithOptionalFileColumns(duplicate.id, input, false);
    action = 'updated';
  } else {
    invoice = await saveWithOptionalFileColumns(null, input, true);
    action = 'created';
  }

  try {
    const uploaded = await InvoiceService.uploadFile(invoice.id, file);
    invoice = await saveWithOptionalFileColumns(invoice.id, {
      ...input,
      file_url: uploaded.file_url,
      file_name: uploaded.file_name,
    }, false);
  } catch (uploadError) {
    console.error('issued invoice file upload:', uploadError);
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

export async function runIssuedBatchImport(options: {
  items: IssuedBatchImportItem[];
  onItemChange: (id: string, patch: Partial<IssuedBatchImportItem>) => void;
  isCancelled: () => boolean;
}): Promise<void> {
  const { items, onItemChange, isCancelled } = options;

  await runWithConcurrency(
    items,
    ISSUED_BATCH_IMPORT_CONCURRENCY,
    async (item) => {
      if (isCancelled()) return;

      onItemChange(item.id, { status: 'scanning', error: undefined });

      try {
        const extracted = await scanIssuedInvoiceFile(item.file);
        if (isCancelled()) return;

        const input = extractionToIssuedInvoiceInput(extracted);
        if (!input) {
          onItemChange(item.id, {
            status: 'error',
            error: 'Nepavyko ištraukti privalomų laukų (pirkėjas, numeris arba suma)',
          });
          return;
        }

        onItemChange(item.id, {
          status: 'saving',
          buyerName: input.buyer_name,
          invoiceNumber: input.invoice_number,
          amountExVat: input.amount,
          totalAmount: input.total_amount,
        });

        const { invoice, action } = await saveIssuedInvoiceFromExtraction(item.file, input);

        onItemChange(item.id, {
          status: action === 'updated' ? 'updated' : 'created',
          buyerName: invoice.buyer_name,
          invoiceNumber: invoice.invoice_number,
          amountExVat: Number(invoice.amount),
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

export function createIssuedBatchItems(files: File[]): IssuedBatchImportItem[] {
  return files.map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    file,
    status: 'queued' as const,
  }));
}
