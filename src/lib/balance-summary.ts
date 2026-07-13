import { resolveListMonthYear } from '@/lib/orders-filters';
import type { Invoice, ReceivedInvoice } from '@/types';

export interface BalanceSummary {
  revenue: number;
  revenueCount: number;
  expenses: number;
  expensesCount: number;
  netResult: number;
}

export interface MonthlyBalanceRow extends BalanceSummary {
  month: string;
  monthLabel: string;
}

const MONTH_NAMES = [
  'Sausis',
  'Vasaris',
  'Kovas',
  'Balandis',
  'Gegužė',
  'Birželis',
  'Liepa',
  'Rugpjūtis',
  'Rugsėjis',
  'Spalis',
  'Lapkritis',
  'Gruodis',
];

export function getMonthsInPeriod(month: string, year: string): string[] {
  const { month: resolvedMonth } = resolveListMonthYear(month, year);
  if (resolvedMonth) return [resolvedMonth];
  return Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
}

export function getMonthLabel(month: string, year: string): string {
  const { month: resolvedMonth, year: resolvedYear } = resolveListMonthYear(month, year);
  const monthName = MONTH_NAMES[parseInt(resolvedMonth, 10) - 1] ?? resolvedMonth;
  return `${monthName} ${resolvedYear}`;
}

export function getPeriodDateRange(
  month: string,
  year: string
): { start: string; end: string } {
  const { month: resolvedMonth, year: resolvedYear } = resolveListMonthYear(month, year);
  const yearNum = parseInt(resolvedYear, 10) || new Date().getFullYear();

  if (resolvedMonth) {
    const monthNum = parseInt(resolvedMonth, 10);
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    return {
      start: `${resolvedYear}-${resolvedMonth}-01`,
      end: `${resolvedYear}-${resolvedMonth}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  return {
    start: `${yearNum}-01-01`,
    end: `${yearNum}-12-31`,
  };
}

export function invoiceMatchesPeriod(
  invoiceDate: string,
  month: string,
  year: string
): boolean {
  const { month: resolvedMonth, year: resolvedYear } = resolveListMonthYear(month, year);
  if (!resolvedYear) return true;
  const prefix = resolvedMonth ? `${resolvedYear}-${resolvedMonth}` : `${resolvedYear}-`;
  return invoiceDate.startsWith(prefix);
}

export function invoiceMatchesDateRange(
  invoiceDate: string,
  dateFrom: string,
  dateTo: string
): boolean {
  if (dateFrom && invoiceDate < dateFrom) return false;
  if (dateTo && invoiceDate > dateTo) return false;
  return true;
}

export function isCustomInvoiceDateRange(dateFrom: string, dateTo: string): boolean {
  return Boolean(dateFrom || dateTo);
}

export function resolveInvoiceFetchRange(params: {
  month: string;
  year: string;
  dateFrom?: string;
  dateTo?: string;
}): { start: string; end: string; useCustomRange: boolean } {
  const dateFrom = params.dateFrom?.trim() ?? '';
  const dateTo = params.dateTo?.trim() ?? '';

  if (isCustomInvoiceDateRange(dateFrom, dateTo)) {
    return {
      start: dateFrom || '1970-01-01',
      end: dateTo || '2099-12-31',
      useCustomRange: true,
    };
  }

  const { start, end } = getPeriodDateRange(params.month, params.year);
  return { start, end, useCustomRange: false };
}

export function formatInvoiceListPeriodLabel(params: {
  month: string;
  year: string;
  dateFrom?: string;
  dateTo?: string;
}): string {
  const dateFrom = params.dateFrom?.trim() ?? '';
  const dateTo = params.dateTo?.trim() ?? '';

  if (isCustomInvoiceDateRange(dateFrom, dateTo)) {
    if (dateFrom && dateTo) return `${dateFrom} – ${dateTo}`;
    if (dateFrom) return `nuo ${dateFrom}`;
    return `iki ${dateTo}`;
  }

  if (params.month) {
    return getMonthLabel(params.month, params.year);
  }

  const { year: resolvedYear } = resolveListMonthYear(params.month, params.year);
  return resolvedYear || String(new Date().getFullYear());
}

export function invoiceMatchesListPeriod(
  invoiceDate: string,
  month: string,
  year: string,
  dateFrom?: string,
  dateTo?: string
): boolean {
  if (isCustomInvoiceDateRange(dateFrom ?? '', dateTo ?? '')) {
    return invoiceMatchesDateRange(invoiceDate, dateFrom ?? '', dateTo ?? '');
  }
  return invoiceMatchesPeriod(invoiceDate, month, year);
}

export function computeBalanceSummary(
  invoices: Invoice[],
  received: ReceivedInvoice[],
  month: string,
  year: string
): BalanceSummary {
  const periodInvoices = invoices.filter((inv) =>
    invoiceMatchesPeriod(inv.invoice_date, month, year)
  );
  const periodReceived = received.filter((inv) =>
    invoiceMatchesPeriod(inv.invoice_date, month, year)
  );

  const revenue = periodInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const expenses = periodReceived.reduce((sum, inv) => sum + Number(inv.amount), 0);

  return {
    revenue: roundMoney(revenue),
    revenueCount: periodInvoices.length,
    expenses: roundMoney(expenses),
    expensesCount: periodReceived.length,
    netResult: roundMoney(revenue - expenses),
  };
}

export function computeMonthlyBalance(
  invoices: Invoice[],
  received: ReceivedInvoice[],
  month: string,
  year: string
): MonthlyBalanceRow[] {
  const { year: resolvedYear } = resolveListMonthYear(month, year);

  return getMonthsInPeriod(month, year).map((monthValue) => ({
    month: monthValue,
    monthLabel: getMonthLabel(monthValue, resolvedYear),
    ...computeBalanceSummary(invoices, received, monthValue, resolvedYear),
  }));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatEuro(amount: number): string {
  return `€${amount.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatExpenseEuro(amount: number): string {
  if (amount === 0) return formatEuro(0);
  return `-${formatEuro(amount)}`;
}
