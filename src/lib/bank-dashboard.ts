import { isSignificantBankExpense } from '@/lib/bank-statement-import';
import {
  issuedToPaymentRow,
  receivedToPaymentRow,
} from '@/lib/payment-tracking';
import { roundMoney } from '@/lib/payment-allocation';
import { isForeignCurrencyInvoice } from '@/lib/received-invoice-service';
import type { BankTransaction, Invoice, ReceivedInvoice } from '@/types';

export interface BankDashboardMetrics {
  bankBalance: number;
  receivables: number;
  payables: number;
  netPosition: number;
  openIssuedCount: number;
  openReceivedCount: number;
}

export function computeBankCashBalance(transactions: BankTransaction[]): number {
  const balance = transactions.reduce((sum, tx) => {
    if (tx.direction === 'income') return sum + Number(tx.amount);
    if (isSignificantBankExpense(tx.amount)) return sum - Number(tx.amount);
    return sum;
  }, 0);
  return roundMoney(balance);
}

export function computeOpenReceivables(issued: Invoice[]): {
  total: number;
  count: number;
} {
  const rows = issued.map(issuedToPaymentRow).filter((row) => row.status !== 'paid');
  return {
    total: roundMoney(rows.reduce((sum, row) => sum + row.balanceAmount, 0)),
    count: rows.length,
  };
}

export function computeOpenPayables(received: ReceivedInvoice[]): {
  total: number;
  count: number;
} {
  const rows = received
    .filter((invoice) => !isForeignCurrencyInvoice(invoice))
    .map(receivedToPaymentRow)
    .filter((row) => row.status !== 'paid');

  return {
    total: roundMoney(rows.reduce((sum, row) => sum + row.balanceAmount, 0)),
    count: rows.length,
  };
}

export function computeBankDashboardMetrics(
  transactions: BankTransaction[],
  issued: Invoice[],
  received: ReceivedInvoice[],
  accountBalance?: number | null
): BankDashboardMetrics {
  const flowBalance = computeBankCashBalance(transactions);
  const bankBalance =
    accountBalance != null && Number.isFinite(accountBalance)
      ? roundMoney(accountBalance)
      : flowBalance;
  const { total: receivables, count: openIssuedCount } = computeOpenReceivables(issued);
  const { total: payables, count: openReceivedCount } = computeOpenPayables(received);
  const netPosition = roundMoney(bankBalance + receivables - payables);

  return {
    bankBalance,
    receivables,
    payables,
    netPosition,
    openIssuedCount,
    openReceivedCount,
  };
}
