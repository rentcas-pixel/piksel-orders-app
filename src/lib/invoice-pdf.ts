import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { Invoice } from '@/types';

/** A4 plotis 96 DPI — html2canvas reikia fiksuoto pločio. */
export const INVOICE_PDF_WIDTH_PX = 794;
export const INVOICE_PDF_MIN_HEIGHT_PX = 1123;

/** Viršutinė / apatinė paraštė kiekviename PDF lape (mm). */
const PDF_PAGE_MARGIN_TOP_MM = 5;
const PDF_PAGE_MARGIN_BOTTOM_MM = 8;
const PDF_PAGE_WIDTH_MM = 210;
const PDF_PAGE_HEIGHT_MM = 297;
const PDF_CONTENT_HEIGHT_MM =
  PDF_PAGE_HEIGHT_MM - PDF_PAGE_MARGIN_TOP_MM - PDF_PAGE_MARGIN_BOTTOM_MM;

/** html2canvas turi fiksuoti patį sąskaitos šabloną, ne išorinį wrapperį. */
export function resolveInvoicePdfCaptureElement(container: HTMLElement): HTMLElement {
  const nested = container.querySelector('[data-invoice-document-root]');
  if (nested instanceof HTMLElement) return nested;
  return container;
}

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
  element.style.minHeight = 'auto';
  element.style.height = 'auto';
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

/** DOM Y koordinatės (px) — lūžti tik po lentelės eilučių. */
function collectInvoiceRowBreakPointsPx(root: HTMLElement): number[] {
  const rootTop = root.getBoundingClientRect().top;
  const points: number[] = [];

  root.querySelectorAll('tbody tr').forEach((row) => {
    const bottom = row.getBoundingClientRect().bottom - rootTop;
    if (bottom > 0) points.push(Math.round(bottom));
  });

  return points.sort((a, b) => a - b);
}

function resolveChunkEndPx(
  offsetY: number,
  maxSlicePx: number,
  canvasHeight: number,
  breakPointsCanvas: number[]
): number {
  const idealEnd = Math.min(offsetY + maxSlicePx, canvasHeight);
  if (idealEnd >= canvasHeight) return canvasHeight;

  const minChunkPx = Math.max(32, Math.floor(maxSlicePx * 0.12));
  const rowCandidates = breakPointsCanvas.filter(
    (point) => point > offsetY + minChunkPx && point <= idealEnd
  );
  if (rowCandidates.length > 0) return rowCandidates[rowCandidates.length - 1]!;
  return idealEnd;
}

function addCanvasSliceToPdf(
  pdf: jsPDF,
  source: HTMLCanvasElement,
  offsetY: number,
  chunkHeight: number,
  pageIndex: number
): void {
  if (pageIndex > 0) pdf.addPage();

  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = source.width;
  pageCanvas.height = chunkHeight;
  const ctx = pageCanvas.getContext('2d');
  if (!ctx) throw new Error('Nepavyko paruošti sąskaitos PDF');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
  ctx.drawImage(
    source,
    0,
    offsetY,
    source.width,
    chunkHeight,
    0,
    0,
    source.width,
    chunkHeight
  );

  const chunkImgHeight = (chunkHeight * PDF_PAGE_WIDTH_MM) / source.width;
  pdf.addImage(
    pageCanvas.toDataURL('image/jpeg', 0.92),
    'JPEG',
    0,
    PDF_PAGE_MARGIN_TOP_MM,
    PDF_PAGE_WIDTH_MM,
    chunkImgHeight
  );
}

export async function invoicePdfBlobFromElement(
  element: HTMLElement,
  options?: { keepInPlace?: boolean }
): Promise<Blob> {
  const captureTarget = resolveInvoicePdfCaptureElement(element);
  const restore = await prepareElementForCapture(captureTarget, options?.keepInPlace ?? false);

  try {
    const width = INVOICE_PDF_WIDTH_PX;
    const captureHeight = captureTarget.scrollHeight;
    const domBreakPoints = collectInvoiceRowBreakPointsPx(captureTarget);

    const canvas = await html2canvas(captureTarget, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width,
      height: captureHeight,
      windowWidth: width,
      scrollX: 0,
      scrollY: 0,
      onclone: (_doc, clonedElement) => {
        const el = clonedElement as HTMLElement;
        el.style.width = `${INVOICE_PDF_WIDTH_PX}px`;
        el.style.minHeight = 'auto';
        el.style.height = 'auto';
        el.style.maxWidth = `${INVOICE_PDF_WIDTH_PX}px`;
      },
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgHeightMm = (canvas.height * PDF_PAGE_WIDTH_MM) / canvas.width;
    const domToCanvasScale = canvas.height / captureTarget.scrollHeight;
    const breakPointsCanvas = domBreakPoints.map((point) =>
      Math.round(point * domToCanvasScale)
    );

    if (imgHeightMm <= PDF_CONTENT_HEIGHT_MM) {
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.92),
        'JPEG',
        0,
        PDF_PAGE_MARGIN_TOP_MM,
        PDF_PAGE_WIDTH_MM,
        imgHeightMm
      );
    } else {
      const maxSlicePx = Math.max(
        1,
        Math.floor((PDF_CONTENT_HEIGHT_MM / imgHeightMm) * canvas.height)
      );
      let offsetY = 0;
      let pageIndex = 0;

      while (offsetY < canvas.height) {
        const chunkEnd = resolveChunkEndPx(
          offsetY,
          maxSlicePx,
          canvas.height,
          breakPointsCanvas
        );
        const chunkHeight = Math.max(1, chunkEnd - offsetY);
        addCanvasSliceToPdf(pdf, canvas, offsetY, chunkHeight, pageIndex);
        offsetY = chunkEnd;
        pageIndex += 1;
      }
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
  return month ? `Israsytos_saskaitos_${year}-${month}.zip` : `Israsytos_saskaitos_${year}.zip`;
}
