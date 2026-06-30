'use client';

import { createRoot } from 'react-dom/client';
import JSZip from 'jszip';
import type { Invoice } from '@/types';
import { InvoiceDocumentPreview } from '@/components/InvoiceDocumentPreview';
import {
  buildInvoicePdfFilename,
  buildInvoicesZipFilename,
  invoicePdfBlobFromElement,
  INVOICE_PDF_WIDTH_PX,
  resolveInvoicePdfCaptureElement,
} from '@/lib/invoice-pdf';

function uniqueZipEntryName(filename: string, used: Set<string>): string {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }
  const base = filename.replace(/\.pdf$/i, '');
  let index = 2;
  while (used.has(`${base} (${index}).pdf`)) index += 1;
  const unique = `${base} (${index}).pdf`;
  used.add(unique);
  return unique;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function generateInvoicePdfBlob(invoice: Invoice): Promise<Blob> {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:0;top:0;opacity:0;pointer-events:none;z-index:-1;width:${INVOICE_PDF_WIDTH_PX}px`;
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    root.render(<InvoiceDocumentPreview invoice={invoice} forPdf />);
    await document.fonts.ready;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      if (host.querySelector('[data-invoice-preview-ready="true"]')) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const element =
      host.querySelector('[data-invoice-document-root]') ??
      host.querySelector('[data-invoice-preview-ready="true"]') ??
      host.firstElementChild;
    if (!(element instanceof HTMLElement)) throw new Error('Nepavyko paruošti sąskaitos PDF');
    return await invoicePdfBlobFromElement(element);
  } finally {
    root.unmount();
    host.remove();
  }
}

/** PDF blob iš DB įrašo — naudojamas ZIP ir vienetiniam atsisiuntimui. */
export async function getIssuedInvoicePdfBlob(invoice: Invoice): Promise<Blob> {
  if (invoice.file_url) {
    const response = await fetch(invoice.file_url);
    if (!response.ok) throw new Error('Nepavyko atsisiųsti sąskaitos failo.');
    return await response.blob();
  }
  return generateInvoicePdfBlob(invoice);
}

/** Vienintelis atsisiuntimo kelias iš sąskaitų sąrašų, agentūros portalo ir pan. */
export async function downloadIssuedInvoicePdf(invoice: Invoice): Promise<void> {
  const blob = await getIssuedInvoicePdfBlob(invoice);
  triggerBlobDownload(
    blob,
    invoice.file_name?.trim() || buildInvoicePdfFilename(invoice)
  );
}

/** Sąskaitos modalo peržiūra — generuoja iš jau atvaizduoto DOM (neišsaugoti pakeitimai). */
export async function downloadIssuedInvoicePdfFromElement(
  element: HTMLElement,
  invoice: Pick<Invoice, 'invoice_number' | 'buyer_name' | 'invoice_date'>
): Promise<void> {
  const captureTarget = resolveInvoicePdfCaptureElement(element);
  const blob = await invoicePdfBlobFromElement(captureTarget, { keepInPlace: true });
  triggerBlobDownload(blob, buildInvoicePdfFilename(invoice));
}

export async function downloadInvoicesZip(
  invoices: Invoice[],
  year: string,
  month: string
): Promise<void> {
  if (invoices.length === 0) return;

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const invoice of invoices) {
    const blob = await getIssuedInvoicePdfBlob(invoice);
    const filename = uniqueZipEntryName(buildInvoicePdfFilename(invoice), usedNames);
    zip.file(filename, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerBlobDownload(zipBlob, buildInvoicesZipFilename(year, month));
}
