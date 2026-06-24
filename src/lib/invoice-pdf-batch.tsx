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

export async function downloadInvoicesZip(
  invoices: Invoice[],
  year: string,
  month: string
): Promise<void> {
  if (invoices.length === 0) return;

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const invoice of invoices) {
    const blob = await generateInvoicePdfBlob(invoice);
    const filename = uniqueZipEntryName(buildInvoicePdfFilename(invoice), usedNames);
    zip.file(filename, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = buildInvoicesZipFilename(year, month);
  anchor.click();
  URL.revokeObjectURL(url);
}
