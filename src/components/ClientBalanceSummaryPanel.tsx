'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { FilterTabGroup } from '@/components/FilterTabGroup';
import { filterControlClass } from '@/components/FilterDropdown';
import { MonthTabNavigator } from '@/components/MonthTabNavigator';
import { yearTabs } from '@/lib/filter-options';
import {
  computeClientBalanceTotals,
  computeClientBalances,
  filterClientBalanceRows,
  formatEuro,
  formatExpenseEuro,
  getClientBalanceFetchRange,
} from '@/lib/client-balance-summary';
import { invoiceMatchesPeriod } from '@/lib/balance-summary';
import { InvoiceService } from '@/lib/invoice-service';
import { ReceivedInvoiceService } from '@/lib/received-invoice-service';
import { resolveListMonthYear } from '@/lib/orders-filters';
import {
  portalCardClass,
  portalTdClass,
  portalStickyThClass,
  portalStickyTheadClass,
  portalTableScrollClass,
  portalToolbarClass,
} from '@/lib/portal-ui';
import type { Invoice, ReceivedInvoice } from '@/types';

interface ClientBalanceSummaryPanelProps {
  month: string;
  year: string;
  onMonthYearChange: (month: string, year: string) => void;
  refreshKey?: number;
}

function netResultClass(value: number): string {
  if (value > 0) return 'text-emerald-700 dark:text-emerald-300';
  if (value < 0) return 'text-red-700 dark:text-red-300';
  return 'text-gray-900 dark:text-white';
}

const expenseClass = 'text-red-700 dark:text-red-300';

export function ClientBalanceSummaryPanel({
  month,
  year,
  onMonthYearChange,
  refreshKey = 0,
}: ClientBalanceSummaryPanelProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [received, setReceived] = useState<ReceivedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const { month: resolvedMonth } = useMemo(
    () => resolveListMonthYear(month, year),
    [month, year]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getClientBalanceFetchRange(month, year);
      const [issued, receivedInvoices] = await Promise.all([
        InvoiceService.getAllForDateRange(start, end),
        ReceivedInvoiceService.getAll(),
      ]);
      setInvoices(issued);
      setReceived(
        receivedInvoices.filter((inv) => invoiceMatchesPeriod(inv.invoice_date, month, year))
      );
    } catch (error) {
      console.error('ClientBalanceSummaryPanel fetch:', error);
      setInvoices([]);
      setReceived([]);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void fetchData();
  }, [fetchData, refreshKey]);

  const rows = useMemo(
    () => computeClientBalances(invoices, received, month, year),
    [invoices, received, month, year]
  );

  const filteredRows = useMemo(
    () => filterClientBalanceRows(rows, searchQuery),
    [rows, searchQuery]
  );

  const summary = useMemo(
    () => computeClientBalanceTotals(filteredRows),
    [filteredRows]
  );

  const periodLabel = resolvedMonth ? 'pasirinktą mėnesį' : 'pasirinktus metus';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-800">
        <div className="space-y-3">
          <div className={`relative ${filterControlClass}`}>
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ieškoti kliento (pavadinimas, įm. kodas, PVM kodas)…"
              className="h-10 w-full rounded-lg bg-transparent pl-10 pr-3 text-sm focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5">
            <MonthTabNavigator
              month={month}
              year={year || '2026'}
              onChange={onMonthYearChange}
            />
            <FilterTabGroup
              label="Metai"
              value={year || '2026'}
              options={yearTabs}
              onChange={(v) => onMonthYearChange(month, v)}
            />
          </div>
        </div>
      </div>

      <div className={portalCardClass}>
        <div className={`${portalToolbarClass} flex flex-wrap items-center justify-between gap-3`}>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            {loading ? (
              <span>Kraunama…</span>
            ) : (
              <>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {summary.clientCount}{' '}
                  {summary.clientCount === 1 ? 'klientas' : 'klientai'}
                  {searchQuery.trim() ? ' (filtruota)' : ''}
                </span>
                <span className="tabular-nums">
                  Išrašyta:{' '}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatEuro(summary.issuedAmount)}
                  </span>
                </span>
                <span className="tabular-nums">
                  Gauta:{' '}
                  <span className={`font-medium ${expenseClass}`}>
                    {formatExpenseEuro(summary.receivedAmount)}
                  </span>
                </span>
                <span className="tabular-nums">
                  Balansas:{' '}
                  <span className={`font-medium ${netResultClass(summary.netBalance)}`}>
                    {formatEuro(summary.netBalance)}
                  </span>
                </span>
              </>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Sumos be PVM, {periodLabel}
          </div>
        </div>

        <div className={portalTableScrollClass}>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={portalStickyTheadClass}>
              <tr>
                <th className={portalStickyThClass}>Klientas</th>
                <th className={`${portalStickyThClass} text-right`}>Išrašyta</th>
                <th className={`${portalStickyThClass} text-right`}>Gauta</th>
                <th className={`${portalStickyThClass} text-right`}>Balansas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className={`${portalTdClass} py-10 text-center text-gray-500`}>
                    Kraunama…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className={`${portalTdClass} py-10 text-center text-gray-500`}>
                    {searchQuery.trim() ? 'Pagal paiešką klientų nerasta.' : 'Duomenų nerasta.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td className={portalTdClass}>
                      <div className="font-medium text-gray-900 dark:text-white">{row.displayName}</div>
                      {(row.companyCode || row.vatCode) && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {[row.companyCode, row.vatCode].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className={`${portalTdClass} text-right tabular-nums`}>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {formatEuro(row.issuedAmount)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {row.issuedCount}{' '}
                        {row.issuedCount === 1 ? 'sąskaita' : 'sąskaitos'}
                      </div>
                    </td>
                    <td className={`${portalTdClass} text-right tabular-nums`}>
                      <div className={`font-medium ${expenseClass}`}>
                        {formatExpenseEuro(row.receivedAmount)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {row.receivedCount}{' '}
                        {row.receivedCount === 1 ? 'sąskaita' : 'sąskaitos'}
                      </div>
                    </td>
                    <td
                      className={`${portalTdClass} text-right font-medium tabular-nums ${netResultClass(row.netBalance)}`}
                    >
                      {formatEuro(row.netBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
