import type { ReceivedInvoice } from '@/types';

export function isPdfFileName(name: string | null | undefined): boolean {
  return (name ?? '').toLowerCase().endsWith('.pdf');
}

export function isImageFileName(name: string | null | undefined): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(name ?? '');
}

export function detectReceivedInvoiceMime(bytes: ArrayBuffer, fileName?: string | null): string {
  const name = (fileName ?? '').toLowerCase();
  if (isPdfFileName(name)) return 'application/pdf';

  const header = new Uint8Array(bytes.slice(0, 4));
  if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
    return 'application/pdf';
  }
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
    return 'image/png';
  }
  if (header[0] === 0xff && header[1] === 0xd8) {
    return 'image/jpeg';
  }

  if (name.endsWith('.png')) return 'image/png';
  if (/\.(jpe?g)$/.test(name)) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

export type ReceivedInvoiceFileRef = Pick<
  ReceivedInvoice,
  'id' | 'file_url' | 'file_name' | 'seller_name' | 'invoice_number' | 'invoice_date'
>;

export function describeReceivedInvoiceFile(invoice: ReceivedInvoiceFileRef): string {
  const seller = invoice.seller_name?.trim() || 'sąskaita';
  const number = invoice.invoice_number?.trim();
  return number ? `${seller} (${number})` : seller;
}

export function resolveReceivedInvoiceDownloadName(
  invoice: Pick<ReceivedInvoice, 'file_name' | 'seller_name' | 'invoice_number' | 'invoice_date'>
): string {
  if (invoice.file_name?.trim()) return invoice.file_name.trim();

  const seller = invoice.seller_name.replace(/[/\\]/g, '-').trim() || 'saskaita';
  const number = invoice.invoice_number?.replace(/[/\\]/g, '-').trim();
  if (number) return `${seller}-${number}.pdf`;
  return `${seller}-${invoice.invoice_date}.pdf`;
}

export async function fetchReceivedInvoiceFileBlob(
  invoice: ReceivedInvoiceFileRef
): Promise<Blob> {
  if (!invoice.file_url) {
    throw new Error('Sąskaita neturi failo.');
  }

  let response: Response | null = null;

  if (invoice.id) {
    response = await fetch(`/api/received-invoices/${invoice.id}/file`, { cache: 'no-store' });
  }

  if (!response?.ok) {
    response = await fetch(invoice.file_url, { cache: 'no-store' });
  }

  if (!response.ok) {
    throw new Error(
      `Nepavyko atsisiųsti failo: ${describeReceivedInvoiceFile(invoice)} (${response.status}).`
    );
  }

  const bytes = await response.arrayBuffer();
  const mime = detectReceivedInvoiceMime(bytes, invoice.file_name);
  return new Blob([bytes], { type: mime });
}

export async function downloadReceivedInvoiceFile(invoice: ReceivedInvoiceFileRef): Promise<void> {
  const blob = await fetchReceivedInvoiceFileBlob(invoice);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = resolveReceivedInvoiceDownloadName(invoice);
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
