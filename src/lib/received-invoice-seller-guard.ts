import { PIKSEL_SELLER } from '@/lib/invoice-utils';
import type { MistralReceivedInvoiceExtraction } from '@/lib/mistral-received-invoice-ocr';

const MONTH_NAMES_LT: Record<string, string> = {
  sausio: '01',
  vasario: '02',
  kovo: '03',
  balandžio: '04',
  gegužės: '05',
  birželio: '06',
  liepos: '07',
  rugpjūčio: '08',
  rugsėjo: '09',
  spalio: '10',
  lapkričio: '11',
  gruodžio: '12',
};

function cleanLine(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\u0000/g, '').trim();
}

function parseMoney(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const number = parseFloat(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

function parseLtLongDate(text: string): string | null {
  const match = text.match(
    /(\d{4})\s*m\.\s*(sausio|vasario|kovo|balandžio|gegužės|birželio|liepos|rugpjūčio|rugsėjo|spalio|lapkričio|gruodžio)\s+(\d{1,2})\s*d/i
  );
  if (!match) return null;
  const [, year, monthName, day] = match;
  const month = MONTH_NAMES_LT[monthName.toLowerCase()];
  if (!month) return null;
  return `${year}-${month}-${day.padStart(2, '0')}`;
}

export function isOwnCompanyAsReceivedSeller(
  extraction: Pick<
    MistralReceivedInvoiceExtraction,
    'seller_name' | 'seller_company_code' | 'seller_vat_code'
  >
): boolean {
  const name = (extraction.seller_name || '').toLowerCase();
  if (/videoarchitekt/i.test(name) || /piksel/i.test(name)) return true;

  const code = extraction.seller_company_code?.trim();
  if (code && code === PIKSEL_SELLER.companyCode) return true;

  const vat = extraction.seller_vat_code?.trim().toUpperCase();
  if (vat && vat === PIKSEL_SELLER.vatCode.toUpperCase()) return true;

  return false;
}

/**
 * When OCR mistakes Videoarchitektai (mokėtojas) for the seller, recover from PDF text.
 * Common on individual-activity invoices that label the issuer as "Gavėjas".
 */
export function correctReceivedSellerFromPdfText(
  extraction: MistralReceivedInvoiceExtraction,
  text: string
): MistralReceivedInvoiceExtraction {
  if (!isOwnCompanyAsReceivedSeller(extraction)) return extraction;

  const normalized = text.replace(/\r/g, '\n');
  const lines = normalized.split('\n').map(cleanLine).filter(Boolean);
  const blob = lines.join('\n');

  const issuedBy =
    blob.match(/Sąskaitą\s+išrašė:\s*([^\n]+)/i)?.[1]?.trim() ||
    blob.match(/Gavėjas:\s*([^\n]+?)(?:\s{2,}|\s+Mokėtojas:|$)/i)?.[1]?.trim() ||
    null;

  if (!issuedBy || isOwnCompanyAsReceivedSeller({ seller_name: issuedBy })) {
    return extraction;
  }

  const address =
    blob.match(
      /Gavėjas:[\s\S]*?Adresas:\s*([^\n]+?)(?:\s{2,}|\s+Adresas:|\s+a\/k:|\s+Bankas:|$)/i
    )?.[1]?.trim() || null;

  const invoiceNumber =
    blob.match(/Serija\s+(ES\s+Nr\.\s*\d+)/i)?.[1]?.replace(/\s+/g, ' ').trim() ||
    blob.match(/\b(ES\s*(?:Nr\.?\s*)?\d{3,})\b/i)?.[1]?.replace(/\s+/g, ' ').trim() ||
    extraction.invoice_number;

  const invoiceDate = parseLtLongDate(blob) || extraction.invoice_date;

  const totalMatch =
    blob.match(/Mokėtina\s+suma[^\d]*(\d+[.,]\d{2}|\d+)\s*€?/i) ||
    blob.match(/Viso:\s*[^\d]*(\d+[.,]\d{2}|\d+)\s*€?/i);
  const total = parseMoney(totalMatch?.[1]) ?? extraction.total_amount;

  // Individual activity invoices are usually without VAT.
  const hasVatLine = /PVM\s*(?:suma|%\s*\d)/i.test(blob) && !/be\s+PVM/i.test(blob);
  const amount = total;
  const vat_amount = hasVatLine ? extraction.vat_amount : 0;
  const total_amount = total;

  return {
    ...extraction,
    seller_name: issuedBy.replace(/\s+Individualios.*$/i, '').trim(),
    seller_company_code: null,
    seller_vat_code: null,
    seller_address: address,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    amount,
    vat_amount,
    total_amount,
  };
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text || '';
  } finally {
    await parser.destroy();
  }
}

export async function guardReceivedInvoiceSeller(
  extraction: MistralReceivedInvoiceExtraction,
  buffer: Buffer,
  mimeType: string
): Promise<MistralReceivedInvoiceExtraction> {
  if (!isOwnCompanyAsReceivedSeller(extraction)) return extraction;
  if (mimeType !== 'application/pdf') return extraction;

  try {
    const text = await extractPdfText(buffer);
    return correctReceivedSellerFromPdfText(extraction, text);
  } catch (error) {
    console.warn('Received invoice seller guard failed:', error);
    return extraction;
  }
}
