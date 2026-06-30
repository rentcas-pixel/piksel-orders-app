'use client';

import JSZip from 'jszip';
import type { ReceivedInvoice } from '@/types';
import {
  describeReceivedInvoiceFile,
  fetchReceivedInvoiceFileBlob,
  resolveReceivedInvoiceDownloadName,
} from '@/lib/received-invoice-file';

function uniqueZipEntryName(filename: string, used: Set<string>): string {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }

  const dot = filename.lastIndexOf('.');
  const base = dot >= 0 ? filename.slice(0, dot) : filename;
  const ext = dot >= 0 ? filename.slice(dot) : '';
  let index = 2;

  while (used.has(`${base} (${index})${ext}`)) index += 1;

  const unique = `${base} (${index})${ext}`;
  used.add(unique);
  return unique;
}

function buildReceivedInvoicesZipFilename(year: string, month: string): string {
  return month
    ? `Gautos_saskaitos_${year}-${month}.zip`
    : `Gautos_saskaitos_${year}.zip`;
}

export async function downloadReceivedInvoicesZip(
  invoices: ReceivedInvoice[],
  year: string,
  month: string
): Promise<void> {
  const withFiles = invoices.filter((invoice) => invoice.file_url);
  if (withFiles.length === 0) return;

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const invoice of withFiles) {
    try {
      const blob = await fetchReceivedInvoiceFileBlob(invoice);
      const filename = uniqueZipEntryName(resolveReceivedInvoiceDownloadName(invoice), usedNames);
      zip.file(filename, blob);
    } catch (error) {
      const label = describeReceivedInvoiceFile(invoice);
      throw new Error(
        error instanceof Error
          ? `${error.message.replace(/\.$/, '')} — ${label}.`
          : `Nepavyko atsisiųsti failo — ${label}.`
      );
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = buildReceivedInvoicesZipFilename(year, month);
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
