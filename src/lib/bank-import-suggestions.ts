import { resolveBankCounterparty } from '@/lib/bank-counterparty';
import type { ParsedBankStatementFile } from '@/lib/bank-import';
import { buildBankImportFingerprint } from '@/lib/bank-transaction-fingerprint';
import { bankPaymentMatchesCompany } from '@/lib/bank-counterparty';
import { isSignificantBankExpense, type BankPayment } from '@/lib/bank-statement-import';
import {
  AMOUNT_TOLERANCE,
  compareFifoInvoiceOrder,
  extractPikSequences,
  getEffectivePaidAmount,
  invoiceBalance,
  roundMoney,
} from '@/lib/payment-allocation';
import { parseInvoiceNumber } from '@/lib/invoice-utils';
import type { Invoice, ReceivedInvoice } from '@/types';

export type BankImportSuggestionReason = 'pik_number' | 'party_match' | 'amount_match' | 'fifo';
export type BankImportInvoiceKind = 'issued' | 'received';
export type BankImportLineCoverage = 'unchecked' | 'none' | 'partial' | 'full';

export interface BankImportSuggestionLine {
  id: string;
  invoiceId: string;
  kind: BankImportInvoiceKind;
  invoiceNumber: string | null;
  party: string;
  invoiceDate: string;
  balance: number;
  reason: BankImportSuggestionReason;
  selected: boolean;
}

export interface BankImportPaymentGroup {
  key: string;
  payment: BankPayment;
  direction: 'income' | 'expense';
  counterpartyLabel: string;
  suggestions: BankImportSuggestionLine[];
}

export interface BankImportReview {
  format: ParsedBankStatementFile['format'];
  groups: BankImportPaymentGroup[];
  skippedRows: number;
}

function amountsClose(a: number, b: number): boolean {
  return Math.abs(Number(a) - Number(b)) <= AMOUNT_TOLERANCE;
}

function buyerMatchesPayment(invoice: Invoice, payment: BankPayment): boolean {
  return bankPaymentMatchesCompany(payment.counterparty, payment.description, invoice.buyer_name);
}

function sellerMatchesPayment(invoice: ReceivedInvoice, payment: BankPayment): boolean {
  return bankPaymentMatchesCompany(payment.counterparty, payment.description, invoice.seller_name);
}

function issuedBalance(invoice: Invoice): number {
  return invoiceBalance(Number(invoice.total_amount), getEffectivePaidAmount(invoice));
}

function receivedBalance(invoice: ReceivedInvoice): number {
  const total = Number(invoice.total_amount) || Number(invoice.amount);
  return invoiceBalance(total, getEffectivePaidAmount(invoice));
}

function makeIssuedLine(
  invoice: Invoice,
  reason: BankImportSuggestionReason,
  selected: boolean
): BankImportSuggestionLine {
  const balance = issuedBalance(invoice);
  return {
    id: `issued:${invoice.id}`,
    invoiceId: invoice.id,
    kind: 'issued',
    invoiceNumber: invoice.invoice_number ?? null,
    party: invoice.buyer_name?.trim() || '—',
    invoiceDate: invoice.invoice_date,
    balance,
    reason,
    selected,
  };
}

function makeReceivedLine(
  invoice: ReceivedInvoice,
  reason: BankImportSuggestionReason,
  selected: boolean
): BankImportSuggestionLine {
  const balance = receivedBalance(invoice);
  return {
    id: `received:${invoice.id}`,
    invoiceId: invoice.id,
    kind: 'received',
    invoiceNumber: invoice.invoice_number ?? null,
    party: invoice.seller_name?.trim() || '—',
    invoiceDate: invoice.invoice_date,
    balance,
    reason,
    selected,
  };
}

function reserveSelected(
  suggestions: BankImportSuggestionLine[],
  reserved: Set<string>
): void {
  for (const line of suggestions) {
    if (line.selected) reserved.add(line.invoiceId);
  }
}

function sortIssuedByFifo(a: Invoice, b: Invoice): number {
  return compareFifoInvoiceOrder(
    { invoiceDate: a.invoice_date, invoiceNumber: a.invoice_number },
    { invoiceDate: b.invoice_date, invoiceNumber: b.invoice_number }
  );
}

function sortReceivedByFifo(a: ReceivedInvoice, b: ReceivedInvoice): number {
  return compareFifoInvoiceOrder(
    { invoiceDate: a.invoice_date, invoiceNumber: a.invoice_number },
    { invoiceDate: b.invoice_date, invoiceNumber: b.invoice_number }
  );
}

export function suggestIssuedPayment(
  payment: BankPayment,
  invoices: Invoice[],
  reserved: Set<string>
): BankImportSuggestionLine[] {
  const open = invoices.filter(
    (invoice) => !reserved.has(invoice.id) && issuedBalance(invoice) > AMOUNT_TOLERANCE
  );
  const haystack = `${payment.description} ${payment.counterparty ?? ''}`;
  const pikSeqs = extractPikSequences(haystack);

  const pikIds = new Set<string>();
  for (const seq of pikSeqs) {
    const invoice = open.find(
      (row) => parseInvoiceNumber(row.invoice_number ?? '') === seq
    );
    if (invoice) pikIds.add(invoice.id);
  }

  const clientPool = open
    .filter(
      (invoice) =>
        buyerMatchesPayment(invoice, payment) &&
        invoice.invoice_date <= payment.date
    )
    .sort(sortIssuedByFifo);

  if (clientPool.length > 0) {
    return clientPool.map((invoice) =>
      makeIssuedLine(
        invoice,
        pikIds.has(invoice.id) ? 'pik_number' : 'party_match',
        true
      )
    );
  }

  const pikMatches = open.filter((invoice) => pikIds.has(invoice.id)).sort(sortIssuedByFifo);
  if (pikMatches.length > 0) {
    return pikMatches.map((invoice) => makeIssuedLine(invoice, 'pik_number', true));
  }

  const amountOnly = open
    .filter(
      (invoice) =>
        amountsClose(Number(invoice.total_amount), payment.amount) &&
        invoice.invoice_date <= payment.date
    )
    .sort(sortIssuedByFifo);
  if (amountOnly.length === 1) {
    return [makeIssuedLine(amountOnly[0], 'amount_match', true)];
  }

  return [];
}

export function suggestReceivedPayment(
  payment: BankPayment,
  invoices: ReceivedInvoice[],
  reserved: Set<string>
): BankImportSuggestionLine[] {
  const open = invoices.filter(
    (invoice) => !reserved.has(invoice.id) && receivedBalance(invoice) > AMOUNT_TOLERANCE
  );
  const haystack = `${payment.description} ${payment.counterparty ?? ''}`.toLowerCase();

  const pikIds = new Set<string>();
  for (const invoice of open) {
    if (!invoice.invoice_number) continue;
    const normalized = invoice.invoice_number.toLowerCase().replace(/[\s\-_/\\.]/g, '');
    if (normalized.length >= 3 && haystack.includes(normalized)) {
      pikIds.add(invoice.id);
    }
  }

  const sellerPool = open
    .filter(
      (invoice) =>
        sellerMatchesPayment(invoice, payment) &&
        invoice.invoice_date <= payment.date
    )
    .sort(sortReceivedByFifo);

  if (sellerPool.length > 0) {
    return sellerPool.map((invoice) =>
      makeReceivedLine(
        invoice,
        pikIds.has(invoice.id) ? 'pik_number' : 'party_match',
        true
      )
    );
  }

  const pikMatches = open.filter((invoice) => pikIds.has(invoice.id)).sort(sortReceivedByFifo);
  if (pikMatches.length > 0) {
    return pikMatches.map((invoice) => makeReceivedLine(invoice, 'pik_number', true));
  }

  const amountOnly = open
    .filter((invoice) => {
      if (invoice.invoice_date > payment.date) return false;
      const total = Number(invoice.total_amount) || Number(invoice.amount);
      return amountsClose(total, payment.amount);
    })
    .sort(sortReceivedByFifo);
  if (amountOnly.length === 1) {
    return [makeReceivedLine(amountOnly[0], 'amount_match', true)];
  }

  return [];
}

export function buildBankImportReview(
  parsed: ParsedBankStatementFile,
  issued: Invoice[],
  received: ReceivedInvoice[],
  options?: { expensesOnly?: boolean }
): BankImportReview {
  const groups: BankImportPaymentGroup[] = [];
  const reservedIssued = new Set<string>();
  const reservedReceived = new Set<string>();

  const expensePayments = parsed.expenses.filter((payment) =>
    isSignificantBankExpense(payment.amount)
  );
  const incomePayments = options?.expensesOnly ? [] : parsed.income;

  const sortPayments = (a: BankPayment, b: BankPayment) =>
    a.date.localeCompare(b.date) || a.amount - b.amount;

  for (const payment of [...expensePayments].sort(sortPayments)) {
    const suggestions = suggestReceivedPayment(payment, received, reservedReceived);
    reserveSelected(suggestions, reservedReceived);
    groups.push({
      key: buildBankImportFingerprint('expense', payment),
      payment,
      direction: 'expense',
      counterpartyLabel: resolveBankCounterparty(payment.counterparty, payment.description),
      suggestions,
    });
  }

  for (const payment of [...incomePayments].sort(sortPayments)) {
    const suggestions = suggestIssuedPayment(payment, issued, reservedIssued);
    reserveSelected(suggestions, reservedIssued);
    groups.push({
      key: buildBankImportFingerprint('income', payment),
      payment,
      direction: 'income',
      counterpartyLabel: resolveBankCounterparty(payment.counterparty, payment.description),
      suggestions,
    });
  }

  return {
    format: parsed.format,
    groups,
    skippedRows: parsed.skippedRows,
  };
}

export function computeSelectedAllocations(
  paymentAmount: number,
  suggestions: BankImportSuggestionLine[]
): { lineId: string; amount: number }[] {
  let remaining = paymentAmount;
  const result: { lineId: string; amount: number }[] = [];

  const selected = suggestions
    .filter((line) => line.selected)
    .sort((a, b) =>
      compareFifoInvoiceOrder(
        { invoiceDate: a.invoiceDate, invoiceNumber: a.invoiceNumber },
        { invoiceDate: b.invoiceDate, invoiceNumber: b.invoiceNumber }
      )
    );

  for (const line of selected) {
    if (remaining <= AMOUNT_TOLERANCE) break;

    const alloc = roundMoney(Math.min(remaining, line.balance));
    if (alloc <= AMOUNT_TOLERANCE) continue;

    result.push({ lineId: line.id, amount: alloc });
    remaining = roundMoney(remaining - alloc);
  }

  return result;
}

export function getSuggestionLineCoverage(
  line: BankImportSuggestionLine,
  allocatedAmount: number
): BankImportLineCoverage {
  if (!line.selected) return 'unchecked';
  if (allocatedAmount <= AMOUNT_TOLERANCE) return 'none';
  if (allocatedAmount >= line.balance - AMOUNT_TOLERANCE) return 'full';
  return 'partial';
}

export function coverageLabel(coverage: BankImportLineCoverage): string | null {
  switch (coverage) {
    case 'unchecked':
      return 'nepažymėta';
    case 'none':
      return 'nesusidengia';
    case 'partial':
      return 'dalinis dengimas';
    case 'full':
      return null;
  }
}

export function suggestionReasonLabel(reason: BankImportSuggestionReason): string {
  switch (reason) {
    case 'pik_number':
      return 'PIK nr. aprašyme';
    case 'amount_match':
      return 'Sutampa suma';
    case 'party_match':
      return 'Kontrahentas';
    case 'fifo':
      return 'FIFO';
  }
}

export function countSelectedSuggestions(review: BankImportReview): number {
  return review.groups.reduce(
    (sum, group) => sum + group.suggestions.filter((line) => line.selected).length,
    0
  );
}
