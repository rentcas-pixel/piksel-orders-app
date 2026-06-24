'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { DocumentArrowDownIcon, FolderArrowDownIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import type { Invoice } from '@/types';
import { InvoiceDocumentPreview } from '@/components/InvoiceDocumentPreview';
import { InvoiceService } from '@/lib/invoice-service';
import { buildInvoicePdfFilename, downloadInvoicePdfFromElement, INVOICE_PDF_WIDTH_PX, resolveInvoicePdfCaptureElement } from '@/lib/invoice-pdf';
import { formatInvoiceListDescription } from '@/components/InvoiceLineDescription';
import { downloadInvoicesZip } from '@/lib/invoice-pdf-batch';
import { formatEuro } from '@/lib/invoice-utils';
import { resolveListMonthYear } from '@/lib/orders-filters';
import {
  portalCardClass,
  portalExportBtnClass,
  portalRowHoverClass,
  portalTdClass,
  portalThClass,
  portalTheadClass,
  portalToolbarClass,
} from '@/lib/portal-ui';

interface InvoicesTableProps {
  searchQuery: string;
  month: string;
  year: string;
  refreshKey: number;
  onNewInvoice: () => void;
  onOpenInvoice: (invoice: Invoice) => void;
}

function formatDate(value: string) {
  try {
    return format(new Date(value), 'yyyy-MM-dd');
  } catch {
    return value;
  }
}

export function InvoicesTable({
  searchQuery,
  month,
  year,
  refreshKey,
  onNewInvoice,
  onOpenInvoice,
}: InvoicesTableProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [pdfInvoice, setPdfInvoice] = useState<Invoice | null>(null);
  const pdfHostRef = useRef<HTMLDivElement>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      setInvoices(await InvoiceService.getAll());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices, refreshKey]);

  useEffect(() => {
    if (!pdfInvoice || !pdfHostRef.current) return;

    const run = async () => {
      await new Promise((r) => setTimeout(r, 50));
      const element = pdfHostRef.current
        ? resolveInvoicePdfCaptureElement(pdfHostRef.current)
        : null;
      if (!element) return;
      try {
        await downloadInvoicePdfFromElement(element, buildInvoicePdfFilename(pdfInvoice));
      } catch (error) {
        console.error('PDF:', error);
        alert('Klaida generuojant PDF');
      } finally {
        setPdfInvoice(null);
        setDownloadingId(null);
      }
    };

    void run();
  }, [pdfInvoice]);

  const handleDownloadPdf = (invoice: Invoice, event: MouseEvent) => {
    event.stopPropagation();
    if (downloadingId || zipping) return;
    setDownloadingId(invoice.id);
    setPdfInvoice(invoice);
  };

  const { month: resolvedMonth, year: resolvedYear } = useMemo(
    () => resolveListMonthYear(month, year),
    [month, year]
  );

  const monthInvoices = useMemo(() => {
    const periodPrefix = `${resolvedYear}-${resolvedMonth}`;
    return invoices.filter((inv) => inv.invoice_date.startsWith(periodPrefix));
  }, [invoices, resolvedMonth, resolvedYear]);

  const handleDownloadMonthZip = async () => {
    if (zipping || downloadingId || monthInvoices.length === 0) return;
    setZipping(true);
    try {
      await downloadInvoicesZip(monthInvoices, resolvedYear, resolvedMonth);
    } catch (error) {
      console.error('ZIP:', error);
      alert('Klaida generuojant ZIP archyvą');
    } finally {
      setZipping(false);
    }
  };

  const filtered = useMemo(() => {
    const periodPrefix = `${resolvedYear}-${resolvedMonth}`;

    return invoices.filter((inv) => {
      if (!inv.invoice_date.startsWith(periodPrefix)) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const haystack = [
        inv.invoice_number,
        inv.buyer_name,
        inv.line_description ?? '',
        inv.order_id,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [invoices, searchQuery, resolvedMonth, resolvedYear]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, inv) => ({
          amount: acc.amount + Number(inv.amount),
          vat: acc.vat + Number(inv.vat_amount),
          total: acc.total + Number(inv.total_amount),
        }),
        { amount: 0, vat: 0, total: 0 }
      ),
    [filtered]
  );

  const invoiceCountLabel =
    filtered.length === 1 ? '1 sąskaita' : `${filtered.length} sąskaitų`;

  return (
    <div className={portalCardClass}>
      {pdfInvoice && (
        <div
          ref={pdfHostRef}
          className="pointer-events-none fixed left-0 top-0 -z-50 opacity-0"
          style={{ width: INVOICE_PDF_WIDTH_PX }}
          aria-hidden
        >
          <InvoiceDocumentPreview invoice={pdfInvoice} forPdf />
        </div>
      )}

      <div className={`${portalToolbarClass} flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
          {loading ? (
            <span>Kraunama…</span>
          ) : (
            <>
              <span className="font-medium text-gray-700 dark:text-gray-300">{invoiceCountLabel}</span>
              <span className="tabular-nums">
                Be PVM:{' '}
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatEuro(totals.amount)}
                </span>
              </span>
              <span className="tabular-nums">
                PVM:{' '}
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatEuro(totals.vat)}
                </span>
              </span>
              <span className="tabular-nums">
                Su PVM:{' '}
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatEuro(totals.total)}
                </span>
              </span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleDownloadMonthZip()}
            disabled={loading || zipping || monthInvoices.length === 0}
            className={portalExportBtnClass}
            title="Atsisiųsti visų mėnesio sąskaitų ZIP"
          >
            <FolderArrowDownIcon className="h-4 w-4" />
            {zipping ? 'Ruošiama…' : 'ZIP mėnuo'}
          </button>
          <button type="button" onClick={onNewInvoice} className={portalExportBtnClass}>
            <PlusCircleIcon className="h-4 w-4" />
            Nauja sąskaita
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className={portalTheadClass}>
            <tr>
              <th className={portalThClass}>Nr.</th>
              <th className={portalThClass}>Data</th>
              <th className={portalThClass}>Pirkėjas</th>
              <th className={portalThClass}>Aprašymas</th>
              <th className={`${portalThClass} text-right`}>Suma</th>
              <th className={`${portalThClass} w-12 text-center`}>PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            {loading ? (
              <tr>
                <td colSpan={6} className={`${portalTdClass} py-10 text-center text-gray-500`}>
                  Kraunama…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className={`${portalTdClass} py-10 text-center text-gray-500`}>
                  Šį mėnesį sąskaitų nerasta.
                </td>
              </tr>
            ) : (
              filtered.map((invoice) => (
                <tr
                  key={invoice.id}
                  className={`cursor-pointer ${portalRowHoverClass}`}
                  onClick={() => onOpenInvoice(invoice)}
                >
                  <td className={`${portalTdClass} font-medium text-gray-900 dark:text-white`}>
                    {invoice.invoice_number}
                  </td>
                  <td className={portalTdClass}>{formatDate(invoice.invoice_date)}</td>
                  <td className={portalTdClass}>{invoice.buyer_name}</td>
                  <td className={`${portalTdClass} max-w-xs truncate`}>
                    {formatInvoiceListDescription(invoice.line_description)}
                  </td>
                  <td className={`${portalTdClass} text-right font-medium tabular-nums text-gray-900 dark:text-white`}>
                    {formatEuro(invoice.total_amount)}
                  </td>
                  <td className={`${portalTdClass} text-center`}>
                    <button
                      type="button"
                      onClick={(event) => handleDownloadPdf(invoice, event)}
                      disabled={downloadingId === invoice.id || zipping}
                      className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 dark:hover:bg-gray-700 dark:hover:text-white"
                      title="Atsisiųsti PDF"
                      aria-label={`Atsisiųsti ${invoice.invoice_number} PDF`}
                    >
                      <DocumentArrowDownIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
