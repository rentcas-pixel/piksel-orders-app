import { resolveBankCounterparty } from '@/lib/bank-counterparty';
import type { ParsedBankStatementFile } from '@/lib/bank-import';
import { buildBankImportFingerprint } from '@/lib/bank-transaction-fingerprint';
import { bankPaymentMatchesCompany } from '@/lib/bank-counterparty';
import { isSignificantBankExpense, type BankPayment } from '@/lib/bank-statement-import';
import {
  AMOUNT_TOLERANCE,
  extractPikSequences,
  getEffectivePaidAmount,
  invoiceBalance,
  roundMoney,
} from '@/lib/payment-allocation';
import { parseInvoiceNumber } from '@/lib/invoice-utils';
import type { Invoice, ReceivedInvoice } from '@/types';

export type BankImportSuggestionReason = 'pik_number' | 'party_match' | 'amount_match' | 'fifo';
export type BankImportInvoiceKind = 'issued' | 'received';

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

export function suggestIssuedPayment(
  payment: BankPayment,
  invoices: Invoice[],
  reserved: Set<string>
): BankImportSuggestionLine[] {
  const open = invoices.filter(
    (invoice) => !reserved.has(invoice.id) && issuedBalance(invoice) > AMOUNT_TOLERANCE
  );
  const lines: BankImportSuggestionLine[] = [];
  const added = new Set<string>();
  const haystack = `${payment.description} ${payment.counterparty ?? ''}`;
  const pikSeqs = extractPikSequences(haystack);

  for (const seq of pikSeqs) {
    const invoice = open.find(
      (row) => parseInvoiceNumber(row.invoice_number ?? '') === seq && !added.has(row.id)
    );
    if (!invoice) continue;
    lines.push(makeIssuedLine(invoice, 'pik_number', true));
    added.add(invoice.id);
  }

  const buyerPool = open
    .filter(
      (invoice) =>
        !added.has(invoice.id) &&
        buyerMatchesPayment(invoice, payment) &&
        invoice.invoice_date <= payment.date
    )
    .sort((a, b) => a.invoice_date.localeCompare(b.invoice_date));

  for (const invoice of buyerPool) {
    const exact = amountsClose(Number(invoice.total_amount), payment.amount);
    const autoSelect = exact && lines.length === 0;
    lines.push(makeIssuedLine(invoice, exact ? 'amount_match' : 'party_match', autoSelect));
    added.add(invoice.id);
  }

  if (lines.length === 0) {
    const amountOnly = open.filter(
      (invoice) =>
        !added.has(invoice.id) &&
        amountsClose(Number(invoice.total_amount), payment.amount) &&
        invoice.invoice_date <= payment.date
    );
    if (amountOnly.length === 1) {
      lines.push(makeIssuedLine(amountOnly[0], 'amount_match', true));
    }
  }

  return lines;
}

export function suggestReceivedPayment(
  payment: BankPayment,
  invoices: ReceivedInvoice[],
  reserved: Set<string>
): BankImportSuggestionLine[] {
  const open = invoices.filter(
    (invoice) => !reserved.has(invoice.id) && receivedBalance(invoice) > AMOUNT_TOLERANCE
  );
  const lines: BankImportSuggestionLine[] = [];
  const added = new Set<string>();
  const haystack = `${payment.description} ${payment.counterparty ?? ''}`.toLowerCase();

  for (const invoice of open) {
    if (!invoice.invoice_number || added.has(invoice.id)) continue;
    const normalized = invoice.invoice_number.toLowerCase().replace(/[\s\-_/\\.]/g, '');
    if (normalized.length >= 3 && haystack.includes(normalized)) {
      lines.push(makeReceivedLine(invoice, 'pik_number', true));
      added.add(invoice.id);
    }
  }

  const sellerPool = open
    .filter(
      (invoice) =>
        !added.has(invoice.id) &&
        sellerMatchesPayment(invoice, payment) &&
        invoice.invoice_date <= payment.date
    )
    .sort((a, b) => a.invoice_date.localeCompare(b.invoice_date));

  for (const invoice of sellerPool) {
    const total = Number(invoice.total_amount) || Number(invoice.amount);
    const exact = amountsClose(total, payment.amount);
    const autoSelect = exact && lines.length === 0;
    lines.push(makeReceivedLine(invoice, exact ? 'amount_match' : 'party_match', autoSelect));
    added.add(invoice.id);
  }

  if (lines.length === 0) {
    const amountOnly = open.filter((invoice) => {
      if (added.has(invoice.id) || invoice.invoice_date > payment.date) return false;
      const total = Number(invoice.total_amount) || Number(invoice.amount);
      return amountsClose(total, payment.amount);
    });
    if (amountOnly.length === 1) {
      lines.push(makeReceivedLine(amountOnly[0], 'amount_match', true));
    }
  }

  return lines;
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

  for (const line of suggestions) {
    if (!line.selected) continue;
    if (remaining <= AMOUNT_TOLERANCE) break;

    const alloc = roundMoney(Math.min(remaining, line.balance));
    if (alloc <= AMOUNT_TOLERANCE) continue;

    result.push({ lineId: line.id, amount: alloc });
    remaining = roundMoney(remaining - alloc);
  }

  return result;
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
