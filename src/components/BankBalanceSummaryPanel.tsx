'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterTabGroup } from '@/components/FilterTabGroup';
import { MonthTabNavigator } from '@/components/MonthTabNavigator';
import {
  computeBankBalanceSummary,
  computeMonthlyBankBalance,
} from '@/lib/bank-balance-summary';
import {
  formatEuro,
  formatExpenseEuro,
  getPeriodDateRange,
} from '@/lib/balance-summary';
import { BankTransactionService } from '@/lib/bank-transaction-service';
import { yearTabs } from '@/lib/filter-options';
import { resolveListMonthYear } from '@/lib/orders-filters';
import {
  portalCardClass,
  portalTdClass,
  portalThClass,
  portalTheadClass,
  portalToolbarClass,
} from '@/lib/portal-ui';
import type { BankTransaction } from '@/types';

interface BankBalanceSummaryPanelProps {
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

function paymentCountLabel(count: number): string {
  if (count === 1) return '1 pavedimas';
  return `${count} pavedimai`;
}

export function BankBalanceSummaryPanel({
  month,
  year,
  onMonthYearChange,
  refreshKey = 0,
}: BankBalanceSummaryPanelProps) {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const { month: resolvedMonth, year: resolvedYear } = useMemo(
    () => resolveListMonthYear(month, year),
    [month, year]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await BankTransactionService.getAll();
      const { start, end } = getPeriodDateRange(month, year);
      setTransactions(
        rows.filter((tx) => tx.transaction_date >= start && tx.transaction_date <= end)
      );
    } catch (error) {
      console.error('BankBalanceSummaryPanel fetch:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void fetchData();
  }, [fetchData, refreshKey]);

  const rows = useMemo(
    () => computeMonthlyBankBalance(transactions, month, year),
    [transactions, month, year]
  );

  const summary = useMemo(
    () => computeBankBalanceSummary(transactions, month, year),
    [transactions, month, year]
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
          <MonthTabNavigator month={month} year={year || '2026'} onChange={onMonthYearChange} />
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
                  Gauta:{' '}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatEuro(summary.revenue)}
                  </span>
                </span>
                <span className="tabular-nums">
                  Išleista:{' '}
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
          <div className="text-xs text-gray-500 dark:text-gray-400">Pagal pavedimo datą</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={portalTheadClass}>
              <tr>
                <th className={portalThClass}>Mėnuo</th>
                <th className={`${portalThClass} text-right`}>Gauta</th>
                <th className={`${portalThClass} text-right`}>Išleista</th>
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
                          {paymentCountLabel(row.revenueCount)}
                        </div>
                      </td>
                      <td className={`${portalTdClass} text-right tabular-nums`}>
                        <div className={`font-medium ${expenseClass}`}>
                          {formatExpenseEuro(row.expenses)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {paymentCountLabel(row.expensesCount)}
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
                          {paymentCountLabel(summary.revenueCount)}
                        </div>
                      </td>
                      <td className={`${portalTdClass} text-right tabular-nums`}>
                        <div className={`font-semibold ${expenseClass}`}>
                          {formatExpenseEuro(summary.expenses)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {paymentCountLabel(summary.expensesCount)}
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
