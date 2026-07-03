import {
  computeBalanceSummary,
  formatEuro,
  formatExpenseEuro,
  getPeriodDateRange,
  invoiceMatchesPeriod,
} from '@/lib/balance-summary';
import { companyNameMatches, foldSearchText } from '@/lib/company-name-match';
import { invoiceMatchesBillingMonth } from '@/lib/invoice-month-status';
import { counterpartyKey } from '@/lib/payment-allocation';
import type { Invoice, ReceivedInvoice } from '@/types';

export { formatEuro, formatExpenseEuro };

export interface ClientBalanceRow {
  id: string;
  displayName: string;
  companyCode: string | null;
  vatCode: string | null;
  issuedAmount: number;
  issuedCount: number;
  receivedAmount: number;
  receivedCount: number;
  netBalance: number;
}

export interface ClientBalanceTotals {
  issuedAmount: number;
  issuedCount: number;
  receivedAmount: number;
  receivedCount: number;
  netBalance: number;
  clientCount: number;
}

function normalizeCompanyCode(code: string | null | undefined): string | null {
  const digits = (code ?? '').replace(/\D/g, '');
  return digits.length === 9 ? digits : null;
}

function pickDisplayName(current: string, candidate: string): string {
  const a = current.trim();
  const b = candidate.trim();
  if (!a) return b;
  if (!b) return a;
  return b.length > a.length ? b : a;
}

function emptyRow(id: string, displayName: string): ClientBalanceRow {
  return {
    id,
    displayName,
    companyCode: null,
    vatCode: null,
    issuedAmount: 0,
    issuedCount: 0,
    receivedAmount: 0,
    receivedCount: 0,
    netBalance: 0,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function mergeRows(target: ClientBalanceRow, source: ClientBalanceRow): void {
  target.displayName = pickDisplayName(target.displayName, source.displayName);
  target.companyCode = target.companyCode ?? source.companyCode;
  target.vatCode = target.vatCode ?? source.vatCode;
  target.issuedAmount = roundMoney(target.issuedAmount + source.issuedAmount);
  target.issuedCount += source.issuedCount;
  target.receivedAmount = roundMoney(target.receivedAmount + source.receivedAmount);
  target.receivedCount += source.receivedCount;
  target.netBalance = roundMoney(target.issuedAmount - target.receivedAmount);
}

function findMatchingRow(rows: ClientBalanceRow[], name: string, companyCode: string | null): ClientBalanceRow | undefined {
  if (companyCode) {
    const byCode = rows.find((row) => row.companyCode === companyCode);
    if (byCode) return byCode;
  }
  return rows.find((row) => companyNameMatches(row.displayName, name));
}

function upsertIssued(rows: ClientBalanceRow[], invoice: Invoice): void {
  const name = invoice.buyer_name?.trim() || 'Nežinomas';
  const companyCode = normalizeCompanyCode(invoice.buyer_company_code);
  const existing = findMatchingRow(rows, name, companyCode);

  if (existing) {
    existing.displayName = pickDisplayName(existing.displayName, name);
    existing.companyCode = existing.companyCode ?? companyCode;
    existing.vatCode = existing.vatCode ?? invoice.buyer_vat_code ?? null;
    existing.issuedAmount = roundMoney(existing.issuedAmount + Number(invoice.amount));
    existing.issuedCount += 1;
    existing.netBalance = roundMoney(existing.issuedAmount - existing.receivedAmount);
    return;
  }

  const id = companyCode ? `code:${companyCode}` : `name:${counterpartyKey(name)}`;
  rows.push({
    ...emptyRow(id, name),
    companyCode,
    vatCode: invoice.buyer_vat_code ?? null,
    issuedAmount: roundMoney(Number(invoice.amount)),
    issuedCount: 1,
    netBalance: roundMoney(Number(invoice.amount)),
  });
}

function upsertReceived(rows: ClientBalanceRow[], invoice: ReceivedInvoice): void {
  const name = invoice.seller_name?.trim() || 'Nežinomas';
  const companyCode = normalizeCompanyCode(invoice.seller_company_code);
  const existing = findMatchingRow(rows, name, companyCode);

  if (existing) {
    existing.displayName = pickDisplayName(existing.displayName, name);
    existing.companyCode = existing.companyCode ?? companyCode;
    existing.vatCode = existing.vatCode ?? invoice.seller_vat_code ?? null;
    existing.receivedAmount = roundMoney(existing.receivedAmount + Number(invoice.amount));
    existing.receivedCount += 1;
    existing.netBalance = roundMoney(existing.issuedAmount - existing.receivedAmount);
    return;
  }

  const id = companyCode ? `code:${companyCode}` : `name:${counterpartyKey(name)}`;
  rows.push({
    ...emptyRow(id, name),
    companyCode,
    vatCode: invoice.seller_vat_code ?? null,
    receivedAmount: roundMoney(Number(invoice.amount)),
    receivedCount: 1,
    netBalance: roundMoney(-Number(invoice.amount)),
  });
}

function consolidateRows(rows: ClientBalanceRow[]): ClientBalanceRow[] {
  const merged: ClientBalanceRow[] = [];

  for (const row of rows) {
    const existing = merged.find(
      (candidate) =>
        (row.companyCode && candidate.companyCode === row.companyCode) ||
        companyNameMatches(candidate.displayName, row.displayName)
    );
    if (existing) {
      mergeRows(existing, row);
    } else {
      merged.push({ ...row });
    }
  }

  return merged
    .map((row) => ({
      ...row,
      netBalance: roundMoney(row.issuedAmount - row.receivedAmount),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'lt'));
}

export function computeClientBalances(
  invoices: Invoice[],
  received: ReceivedInvoice[],
  month: string,
  year: string
): ClientBalanceRow[] {
  const periodInvoices = invoices.filter((inv) => invoiceMatchesBillingMonth(inv, month, year));
  const periodReceived = received.filter((inv) =>
    invoiceMatchesPeriod(inv.invoice_date, month, year)
  );

  const rows: ClientBalanceRow[] = [];
  for (const invoice of periodInvoices) upsertIssued(rows, invoice);
  for (const invoice of periodReceived) upsertReceived(rows, invoice);
  return consolidateRows(rows);
}

export function computeClientBalanceTotals(rows: ClientBalanceRow[]): ClientBalanceTotals {
  const issuedAmount = roundMoney(rows.reduce((sum, row) => sum + row.issuedAmount, 0));
  const receivedAmount = roundMoney(rows.reduce((sum, row) => sum + row.receivedAmount, 0));
  const issuedCount = rows.reduce((sum, row) => sum + row.issuedCount, 0);
  const receivedCount = rows.reduce((sum, row) => sum + row.receivedCount, 0);

  return {
    issuedAmount,
    issuedCount,
    receivedAmount,
    receivedCount,
    netBalance: roundMoney(issuedAmount - receivedAmount),
    clientCount: rows.length,
  };
}

export function filterClientBalanceRows(
  rows: ClientBalanceRow[],
  searchQuery: string
): ClientBalanceRow[] {
  const q = foldSearchText(searchQuery);
  if (!q) return rows;

  return rows.filter((row) => {
    const haystack = foldSearchText(
      [row.displayName, row.companyCode, row.vatCode].filter(Boolean).join(' ')
    );
    return haystack.includes(q);
  });
}

function invoiceMatchesClientRow(
  row: ClientBalanceRow,
  name: string,
  companyCode: string | null | undefined
): boolean {
  const code = normalizeCompanyCode(companyCode);
  if (row.companyCode && code && row.companyCode === code) return true;
  return companyNameMatches(row.displayName, name);
}

export function getInvoicesForClientRow(
  row: ClientBalanceRow,
  invoices: Invoice[],
  received: ReceivedInvoice[],
  month: string,
  year: string
): { issued: Invoice[]; received: ReceivedInvoice[] } {
  const issued = invoices
    .filter(
      (invoice) =>
        invoiceMatchesBillingMonth(invoice, month, year) &&
        invoiceMatchesClientRow(row, invoice.buyer_name ?? '', invoice.buyer_company_code)
    )
    .sort((a, b) => b.invoice_date.localeCompare(a.invoice_date));

  const receivedInvoices = received
    .filter(
      (invoice) =>
        invoiceMatchesPeriod(invoice.invoice_date, month, year) &&
        invoiceMatchesClientRow(row, invoice.seller_name ?? '', invoice.seller_company_code)
    )
    .sort((a, b) => b.invoice_date.localeCompare(a.invoice_date));

  return { issued, received: receivedInvoices };
}

export function getClientBalanceFetchRange(month: string, year: string): { start: string; end: string } {
  return getPeriodDateRange(month, year);
}

export function summarizeClientBalancesForPeriod(
  invoices: Invoice[],
  received: ReceivedInvoice[],
  month: string,
  year: string
): ClientBalanceTotals {
  const summary = computeBalanceSummary(invoices, received, month, year);
  const rows = computeClientBalances(invoices, received, month, year);
  return {
    issuedAmount: summary.revenue,
    issuedCount: summary.revenueCount,
    receivedAmount: summary.expenses,
    receivedCount: summary.expensesCount,
    netBalance: summary.netResult,
    clientCount: rows.length,
  };
}
