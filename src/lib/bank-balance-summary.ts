import {
  getMonthLabel,
  getMonthsInPeriod,
  invoiceMatchesPeriod,
  type BalanceSummary,
  type MonthlyBalanceRow,
} from '@/lib/balance-summary';
import { isSignificantBankExpense } from '@/lib/bank-statement-import';
import { roundMoney } from '@/lib/payment-allocation';
import { resolveListMonthYear } from '@/lib/orders-filters';
import type { BankTransaction } from '@/types';

export type { BalanceSummary, MonthlyBalanceRow };

function filterTransactionsForPeriod(
  transactions: BankTransaction[],
  month: string,
  year: string
): { income: BankTransaction[]; expense: BankTransaction[] } {
  const inPeriod = transactions.filter((tx) =>
    invoiceMatchesPeriod(tx.transaction_date, month, year)
  );

  return {
    income: inPeriod.filter((tx) => tx.direction === 'income'),
    expense: inPeriod.filter(
      (tx) => tx.direction === 'expense' && isSignificantBankExpense(tx.amount)
    ),
  };
}

export function computeBankBalanceSummary(
  transactions: BankTransaction[],
  month: string,
  year: string
): BalanceSummary {
  const { income, expense } = filterTransactionsForPeriod(transactions, month, year);

  const revenue = income.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const expenses = expense.reduce((sum, tx) => sum + Number(tx.amount), 0);

  return {
    revenue: roundMoney(revenue),
    revenueCount: income.length,
    expenses: roundMoney(expenses),
    expensesCount: expense.length,
    netResult: roundMoney(revenue - expenses),
  };
}

export function computeMonthlyBankBalance(
  transactions: BankTransaction[],
  month: string,
  year: string
): MonthlyBalanceRow[] {
  const { year: resolvedYear } = resolveListMonthYear(month, year);

  return getMonthsInPeriod(month, year).map((monthValue) => ({
    month: monthValue,
    monthLabel: getMonthLabel(monthValue, resolvedYear),
    ...computeBankBalanceSummary(transactions, monthValue, resolvedYear),
  }));
}
