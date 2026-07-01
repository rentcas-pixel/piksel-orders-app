import { companyNameMatches, normalizeCompanyName } from '@/lib/company-name-match';
import { bankPaymentMatchesCompany } from '@/lib/bank-counterparty';
import { parseInvoiceNumber } from '@/lib/invoice-utils';

export const AMOUNT_TOLERANCE = 0.02;

export interface FifoPaymentSource {
  id: string;
  transactionDate: string;
  amount: number;
  allocatedAmount: number;
  counterparty: string;
  description?: string;
}

export interface FifoInvoiceTarget {
  id: string;
  invoiceDate: string;
  totalAmount: number;
  paidAmount: number;
  counterparty: string;
  invoiceNumber?: string | null;
}

export interface FifoAllocationPlan {
  bankTransactionId: string;
  transactionDate: string;
  issuedInvoiceId?: string;
  receivedInvoiceId?: string;
  amount: number;
}

export function counterpartyKey(name: string | null | undefined): string {
  const safe = (name ?? '').trim();
  const key = normalizeCompanyName(safe);
  if (key.length >= 3) return key;
  return safe.toLowerCase().replace(/\s+/g, '') || 'nezinomas';
}

export function sourcesMatchTarget(source: FifoPaymentSource, target: FifoInvoiceTarget): boolean {
  const targetName = target.counterparty?.trim() || '';
  if (!targetName) return false;

  if (bankPaymentMatchesCompany(source.counterparty, source.description, targetName)) {
    return true;
  }

  const sourceName = source.counterparty?.trim() || '';
  if (!sourceName) return false;
  if (counterpartyKey(sourceName) === counterpartyKey(targetName)) {
    return true;
  }
  return companyNameMatches(sourceName, targetName);
}

export function invoiceBalance(totalAmount: number, paidAmount: number): number {
  return Math.max(0, roundMoney(totalAmount - paidAmount));
}

export function isFullyPaid(totalAmount: number, paidAmount: number): boolean {
  return paidAmount >= totalAmount - AMOUNT_TOLERANCE;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Iš pavedimo aprašymo ištraukia PIK numerius (pvz. „PIK-3747, PIK3748“). */
export function extractPikSequences(text: string | null | undefined): number[] {
  if (!text) return [];
  const seqs: number[] = [];
  for (const match of text.toLowerCase().matchAll(/pik\s*[-–—]?\s*(\d+)/g)) {
    const seq = parseInt(match[1], 10);
    if (seq > 0 && !seqs.includes(seq)) seqs.push(seq);
  }
  return seqs;
}

/** FIFO: seniausia data, tada mažesnis PIK nr. */
export function compareFifoInvoiceOrder(
  a: { invoiceDate: string; invoiceNumber?: string | null },
  b: { invoiceDate: string; invoiceNumber?: string | null }
): number {
  const byDate = a.invoiceDate.localeCompare(b.invoiceDate);
  if (byDate !== 0) return byDate;
  return parseInvoiceNumber(a.invoiceNumber ?? '') - parseInvoiceNumber(b.invoiceNumber ?? '');
}

function sortTargetsForSource(
  _source: FifoPaymentSource,
  targets: FifoInvoiceTarget[]
): FifoInvoiceTarget[] {
  return [...targets].sort((a, b) =>
    compareFifoInvoiceOrder(
      { invoiceDate: a.invoiceDate, invoiceNumber: a.invoiceNumber },
      { invoiceDate: b.invoiceDate, invoiceNumber: b.invoiceNumber }
    )
  );
}

export function planFifoAllocations(
  sources: FifoPaymentSource[],
  targets: FifoInvoiceTarget[]
): FifoAllocationPlan[] {
  const plans: FifoAllocationPlan[] = [];
  const workingTargets = targets.map((target) => ({ ...target }));

  const sortedSources = [...sources].sort((a, b) => {
    const byDate = a.transactionDate.localeCompare(b.transactionDate);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });

  for (const source of sortedSources) {
    let remaining = roundMoney(source.amount - source.allocatedAmount);
    if (remaining <= AMOUNT_TOLERANCE) continue;

    const openTargets = sortTargetsForSource(
      source,
      workingTargets.filter(
        (target) =>
          sourcesMatchTarget(source, target) &&
          invoiceBalance(target.totalAmount, target.paidAmount) > AMOUNT_TOLERANCE
      )
    );

    for (const target of openTargets) {
      if (remaining <= AMOUNT_TOLERANCE) break;

      const balance = invoiceBalance(target.totalAmount, target.paidAmount);
      const alloc = roundMoney(Math.min(remaining, balance));
      if (alloc <= AMOUNT_TOLERANCE) continue;

      const plan: FifoAllocationPlan = {
        bankTransactionId: source.id,
        transactionDate: source.transactionDate,
        amount: alloc,
      };
      if (target.id.startsWith('issued:')) {
        plan.issuedInvoiceId = target.id.slice('issued:'.length);
      } else {
        plan.receivedInvoiceId = target.id.slice('received:'.length);
      }
      plans.push(plan);

      target.paidAmount = roundMoney(target.paidAmount + alloc);
      remaining = roundMoney(remaining - alloc);
    }
  }

  return plans;
}

export function getEffectivePaidAmount(invoice: {
  paid_amount?: number | null;
  payment_date?: string | null;
  total_amount: number;
}): number {
  const paid = Number(invoice.paid_amount ?? 0);
  if (paid > AMOUNT_TOLERANCE) return paid;
  if (invoice.payment_date) return Number(invoice.total_amount);
  return 0;
}
