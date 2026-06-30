'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterTabGroup } from '@/components/FilterTabGroup';
import { MonthTabNavigator } from '@/components/MonthTabNavigator';
import { yearTabs } from '@/lib/filter-options';
import {
  computeBalanceSummary,
  computeMonthlyBalance,
  formatEuro,
  formatExpenseEuro,
  getPeriodDateRange,
  invoiceMatchesPeriod,
} from '@/lib/balance-summary';
import { InvoiceService } from '@/lib/invoice-service';
import { ReceivedInvoiceService } from '@/lib/received-invoice-service';
import { resolveListMonthYear } from '@/lib/orders-filters';
import {
  portalCardClass,
  portalTdClass,
  portalThClass,
  portalTheadClass,
  portalToolbarClass,
} from '@/lib/portal-ui';
import type { Invoice, ReceivedInvoice } from '@/types';

interface BalanceSummaryPanelProps {
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

export function BalanceSummaryPanel({
  month,
  year,
  onMonthYearChange,
  refreshKey = 0,
}: BalanceSummaryPanelProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [received, setReceived] = useState<ReceivedInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const { month: resolvedMonth, year: resolvedYear } = useMemo(
    () => resolveListMonthYear(month, year),
    [month, year]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getPeriodDateRange(month, year);
      const [issued, receivedInvoices] = await Promise.all([
        InvoiceService.getAllForDateRange(start, end),
        ReceivedInvoiceService.getAll(),
      ]);
      setInvoices(issued);
      setReceived(
        receivedInvoices.filter((inv) => invoiceMatchesPeriod(inv.invoice_date, month, year))
      );
    } catch (error) {
      console.error('BalanceSummaryPanel fetch:', error);
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
    () => computeMonthlyBalance(invoices, received, month, year),
    [invoices, received, month, year]
  );

  const summary = useMemo(
    () => computeBalanceSummary(invoices, received, month, year),
    [invoices, received, month, year]
  );

  const rowCountLabel = resolvedMonth
    ? '1 mėnuo'
    : rows.length === 1
      ? '1 mėnuo'
      : `${rows.length} mėnesiai`;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-800">
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

      <div className={portalCardClass}>
        <div className={`${portalToolbarClass} flex flex-wrap items-center justify-between gap-3`}>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            {loading ? (
              <span>Kraunama…</span>
            ) : (
              <>
                <span className="font-medium text-gray-700 dark:text-gray-300">{rowCountLabel}</span>
                <span className="tabular-nums">
                  Pajamos:{' '}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatEuro(summary.revenue)}
                  </span>
                </span>
                <span className="tabular-nums">
                  Išlaidos:{' '}
                  <span className={`font-medium ${expenseClass}`}>
                    {formatExpenseEuro(summary.expenses)}
                  </span>
                </span>
                <span className="tabular-nums">
                  Grynasis:{' '}
                  <span className={`font-medium ${netResultClass(summary.netResult)}`}>
                    {formatEuro(summary.netResult)}
                  </span>
                </span>
              </>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Sumos be PVM, pagal sąskaitos datą</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={portalTheadClass}>
              <tr>
                <th className={portalThClass}>Mėnuo</th>
                <th className={`${portalThClass} text-right`}>Pajamos (išrašytos)</th>
                <th className={`${portalThClass} text-right`}>Išlaidos (gautos)</th>
                <th className={`${portalThClass} text-right`}>Grynasis rezultatas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className={`${portalTdClass} py-10 text-center text-gray-500`}>
                    Kraunama…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className={`${portalTdClass} py-10 text-center text-gray-500`}>
                    Duomenų nerasta.
                  </td>
                </tr>
              ) : (
                <>
                  {rows.map((row) => (
                    <tr key={row.month}>
                      <td className={`${portalTdClass} font-medium text-gray-900 dark:text-white`}>
                        {row.monthLabel}
                      </td>
                      <td className={`${portalTdClass} text-right tabular-nums`}>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatEuro(row.revenue)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {row.revenueCount}{' '}
                          {row.revenueCount === 1 ? 'sąskaita' : 'sąskaitos'}
                        </div>
                      </td>
                      <td className={`${portalTdClass} text-right tabular-nums`}>
                        <div className={`font-medium ${expenseClass}`}>
                          {formatExpenseEuro(row.expenses)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {row.expensesCount}{' '}
                          {row.expensesCount === 1 ? 'sąskaita' : 'sąskaitos'}
                        </div>
                      </td>
                      <td
                        className={`${portalTdClass} text-right font-medium tabular-nums ${netResultClass(row.netResult)}`}
                      >
                        {formatEuro(row.netResult)}
                      </td>
                    </tr>
                  ))}
                  {!resolvedMonth && rows.length > 1 && (
                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                      <td className={`${portalTdClass} font-semibold text-gray-900 dark:text-white`}>
                        Viso {resolvedYear}
                      </td>
                      <td className={`${portalTdClass} text-right tabular-nums`}>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {formatEuro(summary.revenue)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {summary.revenueCount}{' '}
                          {summary.revenueCount === 1 ? 'sąskaita' : 'sąskaitos'}
                        </div>
                      </td>
                      <td className={`${portalTdClass} text-right tabular-nums`}>
                        <div className={`font-semibold ${expenseClass}`}>
                          {formatExpenseEuro(summary.expenses)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {summary.expensesCount}{' '}
                          {summary.expensesCount === 1 ? 'sąskaita' : 'sąskaitos'}
                        </div>
                      </td>
                      <td
                        className={`${portalTdClass} text-right font-semibold tabular-nums ${netResultClass(summary.netResult)}`}
                      >
                        {formatEuro(summary.netResult)}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
