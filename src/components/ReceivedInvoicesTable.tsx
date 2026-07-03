'use client';

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { DocumentArrowDownIcon, PlusCircleIcon, QueueListIcon, BuildingLibraryIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import type { ReceivedInvoice } from '@/types';
import {
  ReceivedInvoicePreviewOverlay,
  useReceivedInvoiceFilePreview,
} from '@/components/ReceivedInvoiceFilePreview';
import {
  getExpenseCategoryLabel,
  formatReceivedInvoiceAmount,
  ReceivedInvoiceService,
} from '@/lib/received-invoice-service';
import { downloadReceivedInvoiceFile } from '@/lib/received-invoice-file';
import { downloadReceivedInvoicesZip } from '@/lib/received-invoice-zip';
import { InvoiceListTotalsSummary } from '@/components/InvoiceListTotalsSummary';
import { sumInvoiceAmountBreakdowns } from '@/lib/invoice-utils';
import { resolveListMonthYear } from '@/lib/orders-filters';
import {
  matchesIssuedInvoicePaymentFilter,
  type IssuedInvoicePaymentFilter,
} from '@/lib/issued-invoice-filters';
import {
  invoicePaymentStatusClass,
  invoicePaymentStatusLabel,
  nextOverdueSort,
  type OverdueSortDirection,
} from '@/lib/invoice-payment-table';
import { receivedToPaymentRow } from '@/lib/payment-tracking';
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

interface ReceivedInvoicesTableProps {
  searchQuery: string;
  searchInput?: string;
  onSearchInputChange?: (query: string) => void;
  month: string;
  year: string;
  statusFilter: IssuedInvoicePaymentFilter;
  refreshKey: number;
  onNewInvoice: () => void;
  onBatchImport: () => void;
  onBankImport: () => void;
  onDeduplicate: () => void;
  onOpenInvoice: (invoice: ReceivedInvoice) => void;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return format(new Date(value), 'yyyy-MM-dd');
  } catch {
    return value;
  }
}

function formatReceivedListDescription(invoice: ReceivedInvoice): string {
  const description = invoice.description?.trim();
  if (description) return description;
  return getExpenseCategoryLabel(invoice.category);
}

export function ReceivedInvoicesTable({
  searchQuery,
  searchInput,
  onSearchInputChange,
  month,
  year,
  statusFilter,
  refreshKey,
  onNewInvoice,
  onBatchImport,
  onBankImport,
  onDeduplicate,
  onOpenInvoice,
}: ReceivedInvoicesTableProps) {
  const [invoices, setInvoices] = useState<ReceivedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [overdueSort, setOverdueSort] = useState<OverdueSortDirection | null>(null);
  const [dateSort, setDateSort] = useState<OverdueSortDirection | null>(null);
  const { previewInvoice, showPreview, hidePreview, keepPreview, releasePreview } =
    useReceivedInvoiceFilePreview();

  const handleDownloadFile = useCallback(async (invoice: ReceivedInvoice, event: MouseEvent) => {
    event.stopPropagation();
    if (downloadingId || zipping || !invoice.file_url) return;

    setDownloadingId(invoice.id);
    try {
      await downloadReceivedInvoiceFile(invoice);
    } catch (error) {
      console.error('Download received invoice:', error);
      alert(error instanceof Error ? error.message : 'Nepavyko atsisiųsti failo.');
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId, zipping]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      setInvoices(await ReceivedInvoiceService.getAll());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices, refreshKey]);

  useEffect(() => {
    if (statusFilter === 'overdue') {
      setOverdueSort('desc');
      setDateSort(null);
    } else {
      setOverdueSort(null);
    }
  }, [statusFilter]);

  const { month: resolvedMonth, year: resolvedYear } = useMemo(
    () => resolveListMonthYear(month, year),
    [month, year]
  );

  const filtered = useMemo(() => {
    const periodPrefix = `${resolvedYear}-${resolvedMonth}`;
    const q = searchQuery.trim().toLowerCase();

    return invoices.filter((inv) => {
      if (!inv.invoice_date.startsWith(periodPrefix)) return false;

      const payment = receivedToPaymentRow(inv);
      if (!matchesIssuedInvoicePaymentFilter(payment.status, statusFilter)) return false;

      if (!q) return true;

      const haystack = [
        inv.seller_name,
        inv.invoice_number ?? '',
        inv.description ?? '',
        inv.category ?? '',
        getExpenseCategoryLabel(inv.category),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [invoices, searchQuery, resolvedMonth, resolvedYear, statusFilter]);

  const sorted = useMemo(() => {
    if (overdueSort) {
      return [...filtered].sort((a, b) => {
        const daysA = receivedToPaymentRow(a).daysOverdue;
        const daysB = receivedToPaymentRow(b).daysOverdue;
        if (daysA !== daysB) {
          return overdueSort === 'desc' ? daysB - daysA : daysA - daysB;
        }
        return b.invoice_date.localeCompare(a.invoice_date);
      });
    }

    if (dateSort) {
      return [...filtered].sort((a, b) => {
        const dateDiff = a.invoice_date.localeCompare(b.invoice_date);
        if (dateDiff !== 0) {
          return dateSort === 'desc' ? -dateDiff : dateDiff;
        }
        return Number(b.amount) - Number(a.amount);
      });
    }

    return [...filtered].sort((a, b) => {
      const amountDiff = Number(b.amount) - Number(a.amount);
      if (amountDiff !== 0) return amountDiff;
      return b.invoice_date.localeCompare(a.invoice_date);
    });
  }, [filtered, overdueSort, dateSort]);

  const totals = useMemo(() => sumInvoiceAmountBreakdowns(filtered), [filtered]);

  const invoiceCountLabel =
    filtered.length === 1 ? '1 sąskaita' : `${filtered.length} sąskaitų`;
  const downloadableInvoices = useMemo(
    () => filtered.filter((invoice) => invoice.file_url),
    [filtered]
  );

  const handleDownloadZip = useCallback(async () => {
    if (zipping || downloadingId || downloadableInvoices.length === 0) return;

    setZipping(true);
    try {
      await downloadReceivedInvoicesZip(downloadableInvoices, resolvedYear, resolvedMonth);
    } catch (error) {
      console.error('Download received invoices ZIP:', error);
      alert(error instanceof Error ? error.message : 'Nepavyko atsisiųsti ZIP.');
    } finally {
      setZipping(false);
    }
  }, [downloadableInvoices, downloadingId, resolvedMonth, resolvedYear, zipping]);

  return (
    <div className={portalCardClass}>
      <ReceivedInvoicePreviewOverlay
        invoice={previewInvoice}
        onMouseEnter={keepPreview}
        onMouseLeave={releasePreview}
      />

      <div className={`${portalToolbarClass} flex-wrap items-end gap-3`}>
        <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
          {loading ? (
            <span>Kraunama…</span>
          ) : (
            <InvoiceListTotalsSummary
              countLabel={invoiceCountLabel}
              fileCount={downloadableInvoices.length}
              amountExVat={totals.amount}
              vat={totals.vat}
              totalWithVat={totals.total}
              formatAmountExVat={(amount) => formatReceivedInvoiceAmount(amount, 'EUR')}
            />
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          {onSearchInputChange && (
            <PortalSearchField
              value={searchInput ?? searchQuery}
              onChange={onSearchInputChange}
              placeholder="Ieškoti (tiekėjas, sąskaitos nr., aprašymas)…"
              className="w-full sm:w-56 md:w-64"
            />
          )}
          <button
            type="button"
            onClick={() => void handleDownloadZip()}
            disabled={loading || zipping || downloadingId !== null || downloadableInvoices.length === 0}
            className={portalExportBtnClass}
            title="Atsisiųsti visų rodomų gautų sąskaitų failus ZIP archyve"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            {zipping ? 'Ruošiama ZIP…' : 'ZIP visos'}
          </button>
          <button type="button" onClick={onBankImport} className={portalExportBtnClass}>
            <BuildingLibraryIcon className="h-4 w-4" />
            Banko išrašas
          </button>
          <button type="button" onClick={onDeduplicate} className={portalExportBtnClass}>
            Pašalinti dublikatus
          </button>
          <button type="button" onClick={onBatchImport} className={portalExportBtnClass}>
            <QueueListIcon className="h-4 w-4" />
            Masinis importas
          </button>
          <button type="button" onClick={onNewInvoice} className={portalExportBtnClass}>
            <PlusCircleIcon className="h-4 w-4" />
            Nauja sąskaita
          </button>
        </div>
      </div>

      <div className={portalTableScrollClass}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className={portalStickyTheadClass}>
            <tr>
              <th className={`${portalStickyThClass} whitespace-nowrap`}>
                <button
                  type="button"
                  onClick={() => {
                    setOverdueSort(null);
                    setDateSort((current) => nextOverdueSort(current));
                  }}
                  className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-gray-800 dark:hover:text-gray-200 ${
                    dateSort
                      ? 'font-semibold text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                  title={
                    dateSort === 'desc'
                      ? 'Rūšiuojama: naujausios viršuje. Spauskite — seniausios'
                      : dateSort === 'asc'
                        ? 'Rūšiuojama: seniausios viršuje. Spauskite — numatytasis'
                        : 'Rūšiuoti pagal datą'
                  }
                >
                  Data
                  <span className="normal-case text-gray-400 dark:text-gray-500">
                    {dateSort === 'desc' ? '↓' : dateSort === 'asc' ? '↑' : '↕'}
                  </span>
                </button>
              </th>
              <th className={portalStickyThClass}>Tiekėjas</th>
              <th className={portalStickyThClass}>Nr.</th>
              <th className={portalStickyThClass}>Aprašymas</th>
              <th className={`${portalStickyThClass} text-right`}>
                <span className="inline-flex items-center gap-1">
                  Suma
                  {!overdueSort && !dateSort ? (
                    <span className="normal-case font-semibold text-blue-700 dark:text-blue-300">
                      ↓
                    </span>
                  ) : null}
                </span>
              </th>
              <th className={portalStickyThClass}>Statusas</th>
              <th className={`${portalStickyThClass} text-right`}>
                <button
                  type="button"
                  onClick={() => {
                    setDateSort(null);
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
              <th className={`${portalStickyThClass} w-12 text-center`}>PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            {loading ? (
              <tr>
                <td colSpan={8} className={`${portalTdClass} py-10 text-center text-gray-500`}>
                  Kraunama…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className={`${portalTdClass} py-10 text-center text-gray-500`}>
                  {statusFilter === 'all'
                    ? 'Šį mėnesį gautų sąskaitų nerasta.'
                    : statusFilter === 'paid'
                      ? 'Šį mėnesį apmokėtų sąskaitų nerasta.'
                      : statusFilter === 'overdue'
                        ? 'Šį mėnesį vėluojančių sąskaitų nerasta.'
                        : 'Šį mėnesį neapmokėtų sąskaitų nerasta.'}
                </td>
              </tr>
            ) : (
              sorted.map((invoice) => {
                const payment = receivedToPaymentRow(invoice);
                const hasFile = Boolean(invoice.file_url);
                return (
                  <tr
                    key={invoice.id}
                    className={`cursor-pointer ${portalRowHoverClass}`}
                    onClick={() => onOpenInvoice(invoice)}
                    onMouseEnter={() => {
                      if (hasFile) showPreview(invoice);
                    }}
                    onMouseLeave={hidePreview}
                  >
                    <td className={`${portalTdClass} whitespace-nowrap tabular-nums`}>
                      {formatDate(invoice.invoice_date)}
                    </td>
                    <td className={`${portalTdClass} font-medium text-gray-900 dark:text-white`}>
                      {invoice.seller_name}
                    </td>
                    <td className={`${portalTdClass} font-medium text-gray-900 dark:text-white`}>
                      {invoice.invoice_number || '—'}
                    </td>
                    <td className={`${portalTdClass} max-w-xs truncate`}>
                      {formatReceivedListDescription(invoice)}
                    </td>
                    <td
                      className={`${portalTdClass} text-right font-medium tabular-nums text-gray-900 dark:text-white`}
                    >
                      {formatReceivedInvoiceAmount(invoice.amount, invoice.currency)}
                    </td>
                    <td className={portalTdClass}>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${invoicePaymentStatusClass(payment.status)}`}
                      >
                        {invoicePaymentStatusLabel(payment.status)}
                      </span>
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
                    <td className={`${portalTdClass} text-center`}>
                      {hasFile ? (
                        <button
                          type="button"
                          onClick={(event) => void handleDownloadFile(invoice, event)}
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            showPreview(invoice);
                          }}
                          onMouseLeave={(e) => {
                            e.stopPropagation();
                            hidePreview();
                          }}
                          disabled={downloadingId === invoice.id || zipping}
                          className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 dark:hover:bg-gray-700 dark:hover:text-white"
                          title="Atsisiųsti PDF"
                          aria-label={`Atsisiųsti ${invoice.invoice_number ?? 'sąskaitą'} PDF`}
                        >
                          <DocumentArrowDownIcon className="h-5 w-5" />
                        </button>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
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
