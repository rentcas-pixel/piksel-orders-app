import type { Invoice, ReceivedInvoice } from '@/types';
import { fixBalticMojibake } from '@/lib/bank-csv-encoding';
import { parseInvoiceNumber } from '@/lib/invoice-utils';
import {
  bankPaymentMatchesCompany,
  isIbanOnly,
  resolveBankCounterparty,
} from '@/lib/bank-counterparty';
import { isPikInvoiceNumber } from '@/lib/company-name-match';
import { isForeignCurrencyInvoice } from '@/lib/received-invoice-service';

export interface BankPayment {
  date: string;
  description: string;
  amount: number;
  counterparty?: string;
}

export type BankMatchReason = 'invoice_number' | 'amount' | 'seller_and_amount' | 'seller';

export interface BankStatementMatch {
  payment: BankPayment;
  invoice: ReceivedInvoice;
  reason: BankMatchReason;
}

export interface BankStatementImportPreview {
  matches: BankStatementMatch[];
  unmatchedPayments: BankPayment[];
  parsedPayments: number;
  skippedRows: number;
}

export type IssuedBankMatchReason = 'invoice_number' | 'buyer_and_amount' | 'amount';

export interface IssuedBankStatementMatch {
  payment: BankPayment;
  invoice: Invoice;
  reason: IssuedBankMatchReason;
}

export interface IssuedBankStatementImportPreview {
  matches: IssuedBankStatementMatch[];
  unmatchedPayments: BankPayment[];
  parsedPayments: number;
  skippedRows: number;
}

export interface DualBankStatementImportPreview {
  expenses: BankStatementImportPreview;
  income: IssuedBankStatementImportPreview;
  incomeReceived: BankStatementImportPreview;
}

const AMOUNT_TOLERANCE = 0.02;

/** Išlaidų operacijos mažesnės nei 1 € (banko mokesčiai ir pan.) nerodomos ir neimportuojamos. */
export const MIN_BANK_EXPENSE_AMOUNT_EUR = 1;

export function isSignificantBankExpense(amount: number): boolean {
  return amount >= MIN_BANK_EXPENSE_AMOUNT_EUR;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeInvoiceNumber(value: string): string {
  return value.toLowerCase().replace(/[\s\-_/\\.]/g, '');
}

function parseAmount(raw: string): number {
  let cleaned = raw.trim().replace(/[€$]/g, '');

  if (!cleaned) return NaN;

  const negative = cleaned.startsWith('-') || cleaned.startsWith('−');
  cleaned = cleaned.replace(/^[-−]/, '').replace(/\s/g, '');

  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  const value = parseFloat(cleaned);
  if (!Number.isFinite(value)) return NaN;
  return negative ? -Math.abs(value) : value;
}

function parseBankDate(raw: string): string {
  const value = raw.trim();
  const european = value.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (european) {
    return `${european[3]}-${european[2]}-${european[1]}`;
  }
  if (/^\d{8}/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return '';
}

function amountsClose(a: number, b: number): boolean {
  return Math.abs(Number(a) - Number(b)) <= AMOUNT_TOLERANCE;
}

function isDebitDirection(direction: string): boolean {
  const value = direction.trim().toUpperCase();
  return value === 'D' || value === 'DEBIT' || value === 'OUT' || value === 'DEBETAS';
}

function isCreditDirection(direction: string): boolean {
  const value = direction.trim().toUpperCase();
  return value === 'K' || value === 'CREDIT' || value === 'IN' || value === 'KREDITAS';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  parts.push(current.trim());
  return parts;
}

function extractCounterparty(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const fixed = fixBalticMojibake(raw);
  const first = fixed.split('|')[0]?.trim().replace(/^["']|["']$/g, '').trim();
  return first || undefined;
}

const SUMMARY_ROW_RE =
  /(?:closing|opening)\s*balance|turnover|apyvarta|pradinis\s*likut|galutinis\s*likut|sąskaitos\s*likut|likutis\s+\d|^\d{2}\s+(?:turnover|closing|opening)/i;

function looksLikePaymentText(...values: Array<string | undefined>): boolean {
  const text = values.filter(Boolean).join(' ');
  return /pik\s*\d+|sąsk|sask|nr\.|mokėj|invoice|payment|\buab\b|\bmb\b|\bab\b/i.test(text);
}

/** Swedbank CSV turi ir operacijas (20), ir suvestines (82, 85 — likutis, apyvarta). */
function isSummaryBankRow(
  description: string,
  counterparty?: string,
  parts?: string[]
): boolean {
  const desc = normalizeText(description);
  const party = normalizeText(counterparty ?? '');
  const combined = `${desc} ${party}`;

  if (SUMMARY_ROW_RE.test(combined)) return true;

  if (parts && parts.length >= 8) {
    const recordType = (parts[1] ?? '').trim();
    if (/^\d{2}$/.test(recordType) && recordType !== '20') return true;
  }

  if (isIbanOnly(counterparty) && !looksLikePaymentText(description, counterparty)) {
    return true;
  }

  return false;
}

function sanitizePayment(payment: BankPayment, parts?: string[]): BankPayment | null {
  if (isSummaryBankRow(payment.description, payment.counterparty, parts)) return null;

  const counterparty = resolveBankCounterparty(payment.counterparty, payment.description);
  const description = payment.description?.trim() || counterparty;

  if (counterparty === 'Nežinomas' && !description) return null;

  return {
    ...payment,
    counterparty: counterparty === 'Nežinomas' ? undefined : counterparty,
    description,
  };
}

function parseWideSwedbankLine(parts: string[], incoming = false): BankPayment | null {
  if (parts.length < 8) return null;
  const recordType = (parts[1] ?? '').trim();
  if (recordType !== '20') return null;

  const date = parseBankDate(parts[2] ?? '');
  const counterparty = extractCounterparty(parts[3]);
  const description = (parts[4] ?? '').trim();
  const amountRaw = parseAmount(parts[5] ?? '');
  const direction = (parts[7] ?? '').trim();

  if (!date) return null;
  if (!description && !counterparty) return null;

  const amount = Math.abs(amountRaw);
  if (!amount || Number.isNaN(amount)) return null;

  if (direction) {
    if (incoming) {
      if (isDebitDirection(direction)) return null;
      if (!isCreditDirection(direction)) return null;
    } else {
      if (isCreditDirection(direction)) return null;
      if (!isDebitDirection(direction)) return null;
    }
  } else if (incoming) {
    if (amountRaw < 0) return null;
  } else if (amountRaw > 0 && !direction) {
    return null;
  }

  return {
    date,
    description: description || counterparty || '',
    amount,
    counterparty,
  };
}

function parseLegacySwedbankLine(parts: string[], incoming = false): BankPayment | null {
  if (parts.length < 6) return null;

  const counterparty = extractCounterparty(parts[2]);
  const description = (parts[4] ?? '').trim();
  const amountRaw = parseAmount(parts[5] ?? '');
  const direction = parts.length > 7 ? (parts[7] ?? '').trim() : '';
  const dateRaw = parts.length > 8 ? (parts[8] ?? '').trim() : '';

  if (!description && !counterparty) return null;

  const amount = Math.abs(amountRaw);
  if (!amount || Number.isNaN(amount)) return null;

  if (direction) {
    if (incoming) {
      if (isDebitDirection(direction)) return null;
      if (!isCreditDirection(direction)) return null;
    } else {
      if (isCreditDirection(direction)) return null;
      if (!isDebitDirection(direction)) return null;
    }
  } else if (incoming) {
    if (amountRaw < 0) return null;
  } else if (amountRaw >= 0) {
    return null;
  }

  const date = parseBankDate(dateRaw);
  if (!date) return null;

  return {
    date,
    description: description || counterparty || '',
    amount,
    counterparty,
  };
}

function parseFlexibleBankLine(parts: string[], incoming = false): BankPayment | null {
  let direction = '';
  let amountRaw = NaN;
  let date = '';
  let description = '';
  let counterparty = '';

  for (const part of parts) {
    const value = part.trim();
    if (!value) continue;
    if (!direction && (isDebitDirection(value) || isCreditDirection(value))) {
      direction = value;
      continue;
    }
    if (!date) {
      const parsedDate = parseBankDate(value);
      if (parsedDate) {
        date = parsedDate;
        continue;
      }
    }
    const parsedAmount = parseAmount(value);
    if (!Number.isNaN(parsedAmount) && parsedAmount !== 0 && /^-?[\d\s.,]+$/.test(value.replace(/[€$]/g, ''))) {
      amountRaw = parsedAmount;
    }
  }

  if (!direction) return null;
  if (incoming) {
    if (isDebitDirection(direction)) return null;
    if (!isCreditDirection(direction)) return null;
  } else {
    if (isCreditDirection(direction)) return null;
    if (!isDebitDirection(direction)) return null;
  }

  const amount = Math.abs(amountRaw);
  if (!amount || Number.isNaN(amount)) return null;
  if (!date) return null;

  const textParts = parts
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      if (part === direction) return false;
      if (parseBankDate(part) === date) return false;
      if (amountsClose(Math.abs(parseAmount(part)), amount)) return false;
      if (/^EUR|USD|GBP$/i.test(part)) return false;
      return true;
    });

  counterparty = extractCounterparty(textParts[0]) ?? '';
  description = textParts.slice(1).join(' ').trim() || textParts[0] || counterparty;

  if (!description && !counterparty) return null;

  return {
    date,
    description: description || counterparty,
    amount,
    counterparty: counterparty || undefined,
  };
}

function parseBankRow(parts: string[], incoming = false): BankPayment | null {
  if (parts.length >= 8) {
    const recordType = (parts[1] ?? '').trim();
    if (/^\d{2}$/.test(recordType) && recordType !== '20') return null;
  }

  const payment =
    parseWideSwedbankLine(parts, incoming) ??
    parseLegacySwedbankLine(parts, incoming) ??
    parseFlexibleBankLine(parts, incoming);

  if (!payment) return null;
  return sanitizePayment(payment, parts);
}

export function parseBankStatementCsv(
  text: string,
  incoming = false
): { payments: BankPayment[]; skippedRows: number } {
  const normalizedText = fixBalticMojibake(text.replace(/^\uFEFF/, ''));
  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { payments: [], skippedRows: 0 };

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const payments: BankPayment[] = [];
  let skippedRows = 0;

  for (const line of lines.slice(1)) {
    const parts = parseCsvLine(line, delimiter);
    const payment = parseBankRow(parts, incoming);
    if (payment) {
      if (!incoming && !isSignificantBankExpense(payment.amount)) {
        skippedRows += 1;
        continue;
      }
      payments.push(payment);
    } else {
      skippedRows += 1;
    }
  }

  return { payments, skippedRows };
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function sellerMatchesPayment(invoice: ReceivedInvoice, payment: BankPayment): boolean {
  return bankPaymentMatchesCompany(payment.counterparty, payment.description, invoice.seller_name);
}

function pickSellerCandidate(
  candidates: ReceivedInvoice[],
  payment: BankPayment
): ReceivedInvoice | null {
  const eligible = candidates
    .filter((invoice) => invoice.invoice_date <= payment.date)
    .sort((a, b) => b.invoice_date.localeCompare(a.invoice_date));

  if (eligible.length === 0) return null;
  if (eligible.length === 1) return eligible[0];

  const foreignEligible = eligible.filter(isForeignCurrencyInvoice);
  if (foreignEligible.length === 1) return foreignEligible[0];
  if (foreignEligible.length > 1) return foreignEligible[0];

  return null;
}

function matchBySeller(
  payment: BankPayment,
  invoices: ReceivedInvoice[],
  usedIds: Set<string>
): ReceivedInvoice | null {
  const candidates = invoices.filter((invoice) => {
    if (invoice.payment_date || usedIds.has(invoice.id)) return false;
    if (!sellerMatchesPayment(invoice, payment)) return false;
    if (payment.date < invoice.invoice_date) return false;
    return daysBetween(invoice.invoice_date, payment.date) <= 180;
  });

  if (candidates.length === 0) return null;

  const foreignCandidates = candidates.filter(isForeignCurrencyInvoice);
  if (foreignCandidates.length === 1) return foreignCandidates[0];

  const pool =
    foreignCandidates.length > 0
      ? foreignCandidates
      : candidates.length === 1
        ? candidates
        : [];

  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  return pickSellerCandidate(pool, payment);
}

function matchByInvoiceNumber(
  payment: BankPayment,
  invoices: ReceivedInvoice[],
  usedIds: Set<string>
): ReceivedInvoice | null {
  const haystack = normalizeText(`${payment.description} ${payment.counterparty ?? ''}`);

  for (const invoice of invoices) {
    if (invoice.payment_date || usedIds.has(invoice.id) || !invoice.invoice_number) continue;

    const normalizedNumber = normalizeInvoiceNumber(invoice.invoice_number);
    if (normalizedNumber.length < 3) continue;

    if (haystack.includes(normalizedNumber)) {
      return invoice;
    }

    const spaced = normalizeText(invoice.invoice_number);
    if (spaced.length >= 3 && haystack.includes(spaced)) {
      return invoice;
    }
  }

  return null;
}

function matchByAmount(
  payment: BankPayment,
  invoices: ReceivedInvoice[],
  usedIds: Set<string>
): ReceivedInvoice | null {
  const candidates = invoices.filter((invoice) => {
    if (invoice.payment_date || usedIds.has(invoice.id)) return false;
    if (isForeignCurrencyInvoice(invoice)) return false;
    return (
      amountsClose(invoice.total_amount, payment.amount) || amountsClose(invoice.amount, payment.amount)
    );
  });

  if (candidates.length === 1) return candidates[0];
  return null;
}

function matchBySellerAndAmount(
  payment: BankPayment,
  invoices: ReceivedInvoice[],
  usedIds: Set<string>
): ReceivedInvoice | null {
  const candidates = invoices.filter((invoice) => {
    if (invoice.payment_date || usedIds.has(invoice.id)) return false;
    if (isForeignCurrencyInvoice(invoice)) return false;
    if (!amountsClose(invoice.total_amount, payment.amount) && !amountsClose(invoice.amount, payment.amount)) {
      return false;
    }
    return sellerMatchesPayment(invoice, payment);
  });

  if (candidates.length === 1) return candidates[0];
  return null;
}

export function matchBankPaymentsToReceivedInvoices(
  payments: BankPayment[],
  invoices: ReceivedInvoice[]
): Omit<BankStatementImportPreview, 'parsedPayments' | 'skippedRows'> {
  const matches: BankStatementMatch[] = [];
  const unmatchedPayments: BankPayment[] = [];
  const usedIds = new Set<string>();

  for (const payment of payments) {
    const byNumber = matchByInvoiceNumber(payment, invoices, usedIds);
    if (byNumber) {
      matches.push({ payment, invoice: byNumber, reason: 'invoice_number' });
      usedIds.add(byNumber.id);
      continue;
    }

    const bySeller = matchBySellerAndAmount(payment, invoices, usedIds);
    if (bySeller) {
      matches.push({ payment, invoice: bySeller, reason: 'seller_and_amount' });
      usedIds.add(bySeller.id);
      continue;
    }

    const bySellerOnly = matchBySeller(payment, invoices, usedIds);
    if (bySellerOnly) {
      matches.push({ payment, invoice: bySellerOnly, reason: 'seller' });
      usedIds.add(bySellerOnly.id);
      continue;
    }

    const byAmount = matchByAmount(payment, invoices, usedIds);
    if (byAmount) {
      matches.push({ payment, invoice: byAmount, reason: 'amount' });
      usedIds.add(byAmount.id);
      continue;
    }

    unmatchedPayments.push(payment);
  }

  return { matches, unmatchedPayments };
}

export function previewBankStatementImport(
  csvText: string,
  invoices: ReceivedInvoice[]
): BankStatementImportPreview {
  const { payments, skippedRows } = parseBankStatementCsv(csvText);
  const result = matchBankPaymentsToReceivedInvoices(payments, invoices);
  return {
    ...result,
    parsedPayments: payments.length,
    skippedRows,
  };
}

export function matchReasonLabel(reason: BankMatchReason): string {
  switch (reason) {
    case 'invoice_number':
      return 'Sąskaitos nr.';
    case 'amount':
      return 'Suma';
    case 'seller_and_amount':
      return 'Tiekėjas + suma';
    case 'seller':
      return 'Tiekėjas (užsienio)';
  }
}

function buyerMatchesPayment(invoice: Invoice, payment: BankPayment): boolean {
  return bankPaymentMatchesCompany(payment.counterparty, payment.description, invoice.buyer_name);
}

function matchIssuedByInvoiceNumber(
  payment: BankPayment,
  invoices: Invoice[],
  usedIds: Set<string>
): Invoice | null {
  const haystack = normalizeText(`${payment.description} ${payment.counterparty ?? ''}`);
  const haystackCompact = haystack.replace(/[-–—]/g, '');

  for (const invoice of invoices) {
    if (invoice.payment_date || usedIds.has(invoice.id) || !invoice.invoice_number) continue;

    const normalizedNumber = normalizeInvoiceNumber(invoice.invoice_number);
    if (
      normalizedNumber.length >= 3 &&
      (haystack.includes(normalizedNumber) || haystackCompact.includes(normalizedNumber))
    ) {
      return invoice;
    }

    const seq = parseInvoiceNumber(invoice.invoice_number);
    if (seq > 0) {
      const pikCompact = `pik${seq}`;
      const pikSpaced = `pik ${seq}`;
      if (
        haystack.includes(pikCompact) ||
        haystack.includes(pikSpaced) ||
        haystackCompact.includes(pikCompact) ||
        haystackCompact.includes(pikSpaced)
      ) {
        return invoice;
      }
    }

    const spaced = normalizeText(invoice.invoice_number);
    if (spaced.length >= 3 && haystack.includes(spaced)) {
      return invoice;
    }
  }

  return null;
}

function matchIssuedByBuyerAndAmount(
  payment: BankPayment,
  invoices: Invoice[],
  usedIds: Set<string>
): Invoice | null {
  const candidates = invoices.filter((invoice) => {
    if (invoice.payment_date || usedIds.has(invoice.id)) return false;
    if (
      !amountsClose(invoice.total_amount, payment.amount) &&
      !amountsClose(invoice.amount, payment.amount)
    ) {
      return false;
    }
    return buyerMatchesPayment(invoice, payment);
  });

  if (candidates.length === 1) return candidates[0];
  return null;
}

function matchIssuedByAmount(
  payment: BankPayment,
  invoices: Invoice[],
  usedIds: Set<string>
): Invoice | null {
  const candidates = invoices.filter((invoice) => {
    if (invoice.payment_date || usedIds.has(invoice.id)) return false;
    return (
      amountsClose(invoice.total_amount, payment.amount) || amountsClose(invoice.amount, payment.amount)
    );
  });

  if (candidates.length === 1) return candidates[0];
  return null;
}

export function matchBankPaymentsToIssuedInvoices(
  payments: BankPayment[],
  invoices: Invoice[]
): Omit<IssuedBankStatementImportPreview, 'parsedPayments' | 'skippedRows'> {
  const matches: IssuedBankStatementMatch[] = [];
  const unmatchedPayments: BankPayment[] = [];
  const usedIds = new Set<string>();

  for (const payment of payments) {
    const byNumber = matchIssuedByInvoiceNumber(payment, invoices, usedIds);
    if (byNumber) {
      matches.push({ payment, invoice: byNumber, reason: 'invoice_number' });
      usedIds.add(byNumber.id);
      continue;
    }

    const byBuyer = matchIssuedByBuyerAndAmount(payment, invoices, usedIds);
    if (byBuyer) {
      matches.push({ payment, invoice: byBuyer, reason: 'buyer_and_amount' });
      usedIds.add(byBuyer.id);
      continue;
    }

    const byAmount = matchIssuedByAmount(payment, invoices, usedIds);
    if (byAmount) {
      matches.push({ payment, invoice: byAmount, reason: 'amount' });
      usedIds.add(byAmount.id);
      continue;
    }

    unmatchedPayments.push(payment);
  }

  return { matches, unmatchedPayments };
}

export function issuedMatchReasonLabel(reason: IssuedBankMatchReason): string {
  switch (reason) {
    case 'invoice_number':
      return 'PIK nr.';
    case 'buyer_and_amount':
      return 'Pirkėjas + suma';
    case 'amount':
      return 'Suma';
  }
}

export function previewIssuedBankStatementImport(
  csvText: string,
  invoices: Invoice[]
): IssuedBankStatementImportPreview {
  const { payments, skippedRows } = parseBankStatementCsv(csvText, true);
  const result = matchBankPaymentsToIssuedInvoices(payments, invoices);
  return {
    ...result,
    parsedPayments: payments.length,
    skippedRows,
  };
}

function paymentFingerprint(payment: BankPayment): string {
  return `${payment.date}|${payment.amount}|${normalizeText(payment.description)}`;
}

export function previewDualBankStatementImport(
  csvText: string,
  received: ReceivedInvoice[],
  issued: Invoice[]
): DualBankStatementImportPreview {
  const expensePayments = parseBankStatementCsv(csvText, false);
  const incomePayments = parseBankStatementCsv(csvText, true);
  const expenses = matchBankPaymentsToReceivedInvoices(expensePayments.payments, received);
  const income = matchBankPaymentsToIssuedInvoices(incomePayments.payments, issued);

  const usedIncomePayments = new Set(income.matches.map((match) => paymentFingerprint(match.payment)));
  const remainingCredits = incomePayments.payments.filter(
    (payment) => !usedIncomePayments.has(paymentFingerprint(payment))
  );
  const misclassifiedReceived = received.filter((invoice) =>
    isPikInvoiceNumber(invoice.invoice_number)
  );
  const incomeReceived = matchBankPaymentsToReceivedInvoices(
    remainingCredits,
    misclassifiedReceived
  );

  return {
    expenses: {
      ...expenses,
      parsedPayments: expensePayments.payments.length,
      skippedRows: expensePayments.skippedRows,
    },
    income: {
      ...income,
      parsedPayments: incomePayments.payments.length,
      skippedRows: incomePayments.skippedRows,
    },
    incomeReceived: {
      ...incomeReceived,
      parsedPayments: remainingCredits.length,
      skippedRows: 0,
    },
  };
}
