'use client';

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { DocumentArrowDownIcon, FolderArrowDownIcon, PlusCircleIcon, QueueListIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import type { Invoice } from '@/types';
import { InvoiceService } from '@/lib/invoice-service';
import { fetchAgencyInvoices } from '@/lib/agency-portal-api';
import { downloadIssuedInvoicePdf, downloadInvoicesZip } from '@/lib/invoice-pdf-batch';
import { formatInvoiceListDescription } from '@/components/InvoiceLineDescription';
import { InvoiceListTotalsSummary } from '@/components/InvoiceListTotalsSummary';
import { formatEuro, sumInvoiceAmountBreakdowns, compareInvoiceNumbers } from '@/lib/invoice-utils';
import {
  issuedToPaymentRow,
} from '@/lib/payment-tracking';
import {
  matchesIssuedInvoicePaymentFilter,
  type IssuedInvoicePaymentFilter,
} from '@/lib/issued-invoice-filters';
import { invoiceMatchesPeriod } from '@/lib/balance-summary';
import { resolveListMonthYear } from '@/lib/orders-filters';
import {
  portalCardClass,
  portalExportBtnClass,
  portalRowHoverClass,
  portalTdClass,
  portalStickyThClass,
  portalStickyTheadClass,
  portalTableScrollClass,
  portalToolbarClass,
} from '@/lib/portal-ui';
import { PortalSearchField } from '@/components/PortalSearchField';

import { InvoicePaymentStatusBadge } from '@/components/InvoicePaymentStatusBadge';
import {
  nextOverdueSort,
  type OverdueSortDirection,
} from '@/lib/invoice-payment-table';

interface InvoicesTableProps {
  agency?: string;
  portalMode?: boolean;
  searchQuery: string;
  searchInput?: string;
  onSearchInputChange?: (query: string) => void;
  month: string;
  year: string;
  paymentFilter?: IssuedInvoicePaymentFilter;
  refreshKey?: number;
  onNewInvoice?: () => void;
  onBatchImport?: () => void;
  onOpenInvoice?: (invoice: Invoice) => void;
}

function formatDate(value: string) {
  try {
    return format(new Date(value), 'yyyy-MM-dd');
  } catch {
    return value;
  }
}

export function InvoicesTable({
  agency,
  portalMode = false,
  searchQuery,
  searchInput,
  onSearchInputChange,
  month,
  year,
  paymentFilter = 'all',
  refreshKey = 0,
  onNewInvoice,
  onBatchImport,
  onOpenInvoice,
}: InvoicesTableProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [overdueSort, setOverdueSort] = useState<OverdueSortDirection | null>(null);
  const [numberSort, setNumberSort] = useState<OverdueSortDirection | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (portalMode) {
        setInvoices(await fetchAgencyInvoices());
      } else {
        setInvoices(await InvoiceService.getAll());
      }
    } catch (error) {
      console.error('Sąskaitos:', error);
      setInvoices([]);
      setLoadError(
        error instanceof Error ? error.message : 'Nepavyko užkrauti sąskaitų.'
      );
    } finally {
      setLoading(false);
    }
  }, [portalMode]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices, refreshKey]);

  useEffect(() => {
    if (paymentFilter === 'overdue') {
      setNumberSort(null);
      setOverdueSort('desc');
    } else {
      setOverdueSort(null);
    }
  }, [paymentFilter]);

  const handleDownloadPdf = async (invoice: Invoice, event: MouseEvent) => {
    event.stopPropagation();
    if (downloadingId || zipping) return;
    setDownloadingId(invoice.id);
    try {
      await downloadIssuedInvoicePdf(invoice);
    } catch (error) {
      console.error('PDF:', error);
      alert('Klaida atsisiunčiant PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const { month: resolvedMonth, year: resolvedYear } = useMemo(
    () => resolveListMonthYear(month, year),
    [month, year]
  );

  const periodInvoices = useMemo(() => {
    if (!resolvedYear) return invoices;
    return invoices.filter((inv) => invoiceMatchesPeriod(inv.invoice_date, month, year));
  }, [invoices, month, year, resolvedYear]);

  const filtered = useMemo(() => {
    return periodInvoices.filter((inv) => {
      if (!matchesIssuedInvoicePaymentFilter(issuedToPaymentRow(inv).status, paymentFilter)) {
        return false;
      }

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
  }, [periodInvoices, searchQuery, paymentFilter]);

  const sorted = useMemo(() => {
    if (overdueSort) {
      return [...filtered].sort((a, b) => {
        const daysA = issuedToPaymentRow(a).daysOverdue;
        const daysB = issuedToPaymentRow(b).daysOverdue;
        if (daysA !== daysB) {
          return overdueSort === 'desc' ? daysB - daysA : daysA - daysB;
        }
        return b.invoice_date.localeCompare(a.invoice_date);
      });
    }

    if (numberSort) {
      return [...filtered].sort((a, b) => {
        const cmp = compareInvoiceNumbers(a.invoice_number, b.invoice_number);
        if (cmp !== 0) {
          return numberSort === 'desc' ? -cmp : cmp;
        }
        return b.invoice_date.localeCompare(a.invoice_date);
      });
    }

    return [...filtered].sort((a, b) => {
      const amountDiff = Number(b.amount) - Number(a.amount);
      if (amountDiff !== 0) return amountDiff;
      return b.invoice_date.localeCompare(a.invoice_date);
    });
  }, [filtered, overdueSort, numberSort]);

  const totals = useMemo(() => sumInvoiceAmountBreakdowns(filtered), [filtered]);

  const invoiceCountLabel =
    filtered.length === 1 ? '1 sąskaita' : `${filtered.length} sąskaitų`;

  const emptyTableMessage = useMemo(() => {
    if (loadError) return loadError;
    if (portalMode && !loading && invoices.length === 0) {
      return 'Sąskaitų nerasta.';
    }
    if (portalMode && !loading && invoices.length > 0 && periodInvoices.length === 0) {
      if (!resolvedMonth) {
        return `Šiais metais (${resolvedYear}) sąskaitų nėra. Iš viso turite ${invoices.length} sąskaitų — pabandykite kitus metus.`;
      }
      return `Šį mėnesį sąskaitų nėra. Iš viso turite ${invoices.length} sąskaitų — pasirinkite kitą mėnesį arba „Visi“.`;
    }
    if (paymentFilter === 'all') return 'Šį mėnesį sąskaitų nerasta.';
    if (paymentFilter === 'paid') return 'Šį mėnesį apmokėtų sąskaitų nerasta.';
    if (paymentFilter === 'overdue') return 'Šį mėnesį vėluojančių sąskaitų nerasta.';
    return 'Šį mėnesį neapmokėtų sąskaitų nerasta.';
  }, [
    loadError,
    portalMode,
    loading,
    invoices.length,
    periodInvoices.length,
    resolvedMonth,
    resolvedYear,
    paymentFilter,
  ]);

  const invoicesWithFile = useMemo(
    () => filtered.filter((invoice) => invoice.file_url),
    [filtered]
  );

  const handleDownloadZip = async () => {
    if (zipping || downloadingId || filtered.length === 0) return;
    setZipping(true);
    try {
      await downloadInvoicesZip(filtered, resolvedYear, resolvedMonth);
    } catch (error) {
      console.error('ZIP:', error);
      alert('Klaida generuojant ZIP archyvą');
    } finally {
      setZipping(false);
    }
  };

  const columnCount = portalMode ? 6 : 8;

  return (
    <div className={portalCardClass}>
      <div className={`${portalToolbarClass} flex-wrap items-end gap-3`}>
        <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
          {loading ? (
            <span>Kraunama…</span>
          ) : (
            <InvoiceListTotalsSummary
              countLabel={invoiceCountLabel}
              fileCount={invoicesWithFile.length}
              amountExVat={totals.amount}
              vat={totals.vat}
              totalWithVat={totals.total}
            />
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          {onSearchInputChange && (
            <PortalSearchField
              value={searchInput ?? searchQuery}
              onChange={onSearchInputChange}
              placeholder="Ieškoti (klientas, agentūra, kampanija, sąskaita)…"
              className="w-full sm:w-56 md:w-64"
            />
          )}
          {onBatchImport && (
            <button
              type="button"
              onClick={onBatchImport}
              className={portalExportBtnClass}
              title="Importuoti PDF sąskaitas per OCR"
            >
              <QueueListIcon className="h-4 w-4" />
              Importuoti PDF
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleDownloadZip()}
            disabled={loading || zipping || filtered.length === 0}
            className={portalExportBtnClass}
            title="Atsisiųsti visas rodomas sąskaitas ZIP archyve (PDF)"
          >
            <FolderArrowDownIcon className="h-4 w-4" />
            {zipping ? 'Ruošiama…' : 'ZIP'}
          </button>
          {onNewInvoice && (
            <button type="button" onClick={onNewInvoice} className={portalExportBtnClass}>
              <PlusCircleIcon className="h-4 w-4" />
              Nauja sąskaita
            </button>
          )}
        </div>
      </div>

      <div className={portalTableScrollClass}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className={portalStickyTheadClass}>
            <tr>
              <th className={`${portalStickyThClass} whitespace-nowrap`}>Data</th>
              <th className={portalStickyThClass}>Pirkėjas</th>
              <th className={portalStickyThClass}>
                <button
                  type="button"
                  onClick={() => {
                    setOverdueSort(null);
                    setNumberSort((current) => nextOverdueSort(current));
                  }}
                  className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-gray-800 dark:hover:text-gray-200 ${
                    numberSort
                      ? 'font-semibold text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                  title={
                    numberSort === 'desc'
                      ? 'Rūšiuojama: didžiausias numeris. Spauskite — mažiausias'
                      : numberSort === 'asc'
                        ? 'Rūšiuojama: mažiausias numeris. Spauskite — numatytasis'
                        : 'Rūšiuoti pagal sąskaitos numerį'
                  }
                >
                  Nr.
                  <span className="normal-case text-gray-400 dark:text-gray-500">
                    {numberSort === 'desc' ? '↓' : numberSort === 'asc' ? '↑' : '↕'}
                  </span>
                </button>
              </th>
              <th className={portalStickyThClass}>Aprašymas</th>
              <th className={`${portalStickyThClass} text-right`}>
                <span className="inline-flex items-center gap-1">
                  Suma
                  {!portalMode && !overdueSort && !numberSort ? (
                    <span className="normal-case font-semibold text-blue-700 dark:text-blue-300">
                      ↓
                    </span>
                  ) : null}
                </span>
              </th>
              {!portalMode && (
                <>
                  <th className={portalStickyThClass}>Statusas</th>
                  <th className={`${portalStickyThClass} text-right`}>
                    <button
                      type="button"
                      onClick={() => {
                        setNumberSort(null);
                        setOverdueSort((current) => nextOverdueSort(current));
                      }}
                      className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-gray-800 dark:hover:text-gray-200 ${
                        overdueSort
                          ? 'font-semibold text-blue-700 dark:text-blue-300'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                      title={
                        overdueSort === 'desc'
                          ? 'Rūšiuojama: daugiausiai vėluoja. Spauskite — mažiausiai'
                          : overdueSort === 'asc'
                            ? 'Rūšiuojama: mažiausiai vėluoja. Spauskite — numatytasis'
                            : 'Rūšiuoti pagal vėlavimo dienas'
                      }
                    >
                      Vėluoja
                      <span className="normal-case text-gray-400 dark:text-gray-500">
                        {overdueSort === 'desc' ? '↓' : overdueSort === 'asc' ? '↑' : '↕'}
                      </span>
                    </button>
                  </th>
                </>
              )}
              <th className={`${portalStickyThClass} w-12 text-center`}>PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            {loading ? (
              <tr>
                <td colSpan={columnCount} className={`${portalTdClass} py-10 text-center text-gray-500`}>
                  Kraunama…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className={`${portalTdClass} py-10 text-center text-gray-500`}>
                  {emptyTableMessage}
                </td>
              </tr>
            ) : (
              sorted.map((invoice) => {
                const payment = issuedToPaymentRow(invoice);
                return (
                <tr
                  key={invoice.id}
                  className={onOpenInvoice ? `cursor-pointer ${portalRowHoverClass}` : ''}
                  onClick={() => onOpenInvoice?.(invoice)}
                >
                  <td className={`${portalTdClass} whitespace-nowrap tabular-nums`}>
                    {formatDate(invoice.invoice_date)}
                  </td>
                  <td className={`${portalTdClass} font-medium text-gray-900 dark:text-white`}>
                    {invoice.buyer_name}
                  </td>
                  <td className={`${portalTdClass} font-medium text-gray-900 dark:text-white`}>
                    {invoice.invoice_number}
                  </td>
                  <td className={`${portalTdClass} max-w-xs truncate`}>
                    {formatInvoiceListDescription(invoice.line_description)}
                  </td>
                  <td className={`${portalTdClass} text-right font-medium tabular-nums text-gray-900 dark:text-white`}>
                    {formatEuro(invoice.amount)}
                  </td>
                  {!portalMode && (
                    <>
                      <td className={`${portalTdClass} overflow-visible`}>
                        <InvoicePaymentStatusBadge payment={payment} />
                      </td>
                      <td
                        className={`${portalTdClass} text-right tabular-nums ${
                          payment.status === 'overdue'
                            ? 'font-semibold text-red-700 dark:text-red-300'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {payment.status === 'overdue' ? `${payment.daysOverdue} d.` : '—'}
                      </td>
                    </>
                  )}
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
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
