import {
  extractionToReceivedInvoiceInput,
  saveReceivedInvoiceFromExtraction,
} from '@/lib/received-invoice-batch';
import { processReceivedInvoiceOcr } from '@/lib/mistral-ocr-server';
import { createReceivedInvoiceAdminClient } from '@/lib/received-invoice-service';
import type { ReceivedInvoice } from '@/types';

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export type ReceivedInvoiceImportResult = {
  action: 'created' | 'updated';
  invoice: ReceivedInvoice;
  sellerName: string;
  invoiceNumber: string | null;
  totalAmount: number;
};

function resolveMimeType(filename: string, mimeType?: string): string {
  if (mimeType) return mimeType;
  const name = filename.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

export function isSupportedReceivedInvoiceFilename(filename: string): boolean {
  const name = filename.toLowerCase();
  return name.endsWith('.pdf') || /\.(jpe?g|png|webp)$/i.test(name);
}

export async function importReceivedInvoiceFile(file: File): Promise<ReceivedInvoiceImportResult> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY nerastas serveryje.');
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Failas per didelis (maks. 15 MB).');
  }

  const mimeType = resolveMimeType(file.name, file.type);
  if (mimeType !== 'application/pdf' && !mimeType.startsWith('image/')) {
    throw new Error('Palaikomi tik PDF ir paveikslėliai.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extracted = await processReceivedInvoiceOcr(apiKey, buffer, file.name, mimeType);
  const input = extractionToReceivedInvoiceInput(extracted);
  if (!input) {
    throw new Error('Nepavyko ištraukti privalomų laukų (tiekėjas arba suma).');
  }

  const adminClient = createReceivedInvoiceAdminClient();
  const { invoice, action } = await saveReceivedInvoiceFromExtraction(file, input, {
    client: adminClient,
  });

  return {
    action,
    invoice,
    sellerName: invoice.seller_name,
    invoiceNumber: invoice.invoice_number ?? null,
    totalAmount: Number(invoice.total_amount),
  };
}

export function fileFromBuffer(buffer: Buffer, filename: string, mimeType?: string): File {
  const type = resolveMimeType(filename, mimeType);
  return new File([new Uint8Array(buffer)], filename, { type });
}
