import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { Invoice } from '@/types';

/** A4 plotis 96 DPI — html2canvas reikia fiksuoto pločio. */
export const INVOICE_PDF_WIDTH_PX = 794;
export const INVOICE_PDF_MIN_HEIGHT_PX = 1123;

/** Trumpas pavadinimas PDF failui — be UAB, IĮ ir pan. */
export function shortBuyerNameForFilename(name: string): string {
  let s = name.trim();
  if (!s) return 'Saskaita';

  s = s.replace(/^Akcinė bendrovė\s+"([^"]+)"\s*$/i, '$1');
  s = s.replace(/^Asociacija\s+"([^"]+)"\s*$/i, '$1');
  s = s.replace(/^"([^"]+)"$/, '$1');

  const suffixRe =
    /,?\s*(UAB|AB|IĮ|VšĮ|MB|CB|ZUB|TUB|SIA|AS|filialas)\s*$/i;
  const prefixRe = /^(UAB|AB|IĮ|VšĮ|MB|CB|Akcinė bendrovė|Asociacija)\s+/i;

  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s.replace(suffixRe, '').trim();
    s = s.replace(prefixRe, '').trim();
  }

  s = s.replace(/,\s*$/, '').trim();
  s = s.replace(/[/\\:*?"<>|]/g, '').trim();

  return s || 'Saskaita';
}

export function buildInvoicePdfFilename(
  invoice: Pick<Invoice, 'invoice_number' | 'buyer_name' | 'invoice_date'>
): string {
  const buyer = shortBuyerNameForFilename(invoice.buyer_name || 'Saskaita');
  return `${invoice.invoice_number} - ${buyer} - ${invoice.invoice_date}.pdf`;
}

async function waitForImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
}

async function prepareElementForCapture(
  element: HTMLElement,
  keepInPlace = false
): Promise<() => void> {
  const prev = {
    width: element.style.width,
    minHeight: element.style.minHeight,
    maxWidth: element.style.maxWidth,
    position: element.style.position,
    left: element.style.left,
    top: element.style.top,
    zIndex: element.style.zIndex,
  };

  element.style.width = `${INVOICE_PDF_WIDTH_PX}px`;
  element.style.minHeight = `${INVOICE_PDF_MIN_HEIGHT_PX}px`;
  element.style.maxWidth = `${INVOICE_PDF_WIDTH_PX}px`;

  if (!keepInPlace) {
    element.style.position = 'fixed';
    element.style.left = '0';
    element.style.top = '0';
    element.style.zIndex = '-1';
  }

  await document.fonts.ready;
  await waitForImages(element);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  return () => {
    element.style.width = prev.width;
    element.style.minHeight = prev.minHeight;
    element.style.maxWidth = prev.maxWidth;
    element.style.position = prev.position;
    element.style.left = prev.left;
    element.style.top = prev.top;
    element.style.zIndex = prev.zIndex;
  };
}

export async function invoicePdfBlobFromElement(
  element: HTMLElement,
  options?: { keepInPlace?: boolean }
): Promise<Blob> {
  const restore = await prepareElementForCapture(element, options?.keepInPlace ?? false);

  try {
    const width = INVOICE_PDF_WIDTH_PX;
    const height = Math.max(element.scrollHeight, INVOICE_PDF_MIN_HEIGHT_PX);

    const canvas = await html2canvas(element, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width,
      height,
      windowWidth: width,
      scrollX: 0,
      scrollY: 0,
      onclone: (_doc, clonedElement) => {
        const el = clonedElement as HTMLElement;
        el.style.width = `${INVOICE_PDF_WIDTH_PX}px`;
        el.style.minHeight = `${INVOICE_PDF_MIN_HEIGHT_PX}px`;
        el.style.maxWidth = `${INVOICE_PDF_WIDTH_PX}px`;
      },
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      const scale = pageHeight / imgHeight;
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth * scale, pageHeight);
    }
    return pdf.output('blob');
  } finally {
    restore();
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadInvoicePdfFromElement(
  element: HTMLElement,
  filename: string,
  options?: { keepInPlace?: boolean }
): Promise<void> {
  const blob = await invoicePdfBlobFromElement(element, options);
  triggerBlobDownload(blob, filename);
}

export function buildInvoicesZipFilename(year: string, month: string): string {
  return `Saskaitos ${year}-${month}.zip`;
}
