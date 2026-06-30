import { formatEuro } from '@/lib/invoice-utils';
import { getEffectivePaidAmount, invoiceBalance, isFullyPaid } from '@/lib/payment-allocation';
import type { Invoice, ReceivedInvoice } from '@/types';

export type PaymentStatus = 'paid' | 'partial' | 'pending' | 'overdue';

export type PaymentDirection = 'receivable' | 'payable';

export type PaymentListFilter = 'open' | 'overdue' | 'pending' | 'paid' | 'all';

export interface PaymentTrackingRow {
  id: string;
  direction: PaymentDirection;
  counterparty: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  dueDate: string | null;
  paymentDate: string | null;
  amountExVat: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  currency: string | null;
  status: PaymentStatus;
  daysOverdue: number;
  daysUntilDue: number | null;
  source: 'issued' | 'received';
  raw: Invoice | ReceivedInvoice;
}

export interface PaymentSummary {
  count: number;
  amountExVat: number;
  totalAmount: number;
  overdueCount: number;
  overdueAmountExVat: number;
  avgDaysOverdue: number;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function parseYmd(value: string): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getPaymentStatus(
  paidAmount: number,
  totalAmount: number,
  paymentDate: string | null | undefined,
  dueDate: string | null | undefined
): PaymentStatus {
  const paid = paidAmount > 0 ? paidAmount : paymentDate ? totalAmount : 0;
  if (isFullyPaid(totalAmount, paid)) return 'paid';
  if (paid > 0) return 'partial';

  const today = startOfDay(new Date());
  if (dueDate) {
    const due = parseYmd(dueDate);
    if (due < today) return 'overdue';
  }

  return 'pending';
}

export function getDaysOverdue(
  paidAmount: number,
  totalAmount: number,
  paymentDate: string | null | undefined,
  dueDate: string | null | undefined
): number {
  const status = getPaymentStatus(paidAmount, totalAmount, paymentDate, dueDate);
  if (status === 'paid' || !dueDate) return 0;
  const today = startOfDay(new Date());
  const due = parseYmd(dueDate);
  if (due >= today) return 0;
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

export function getDaysUntilDue(
  paidAmount: number,
  totalAmount: number,
  paymentDate: string | null | undefined,
  dueDate: string | null | undefined
): number | null {
  const status = getPaymentStatus(paidAmount, totalAmount, paymentDate, dueDate);
  if (status === 'paid' || !dueDate) return null;
  const today = startOfDay(new Date());
  const due = parseYmd(dueDate);
  if (due < today) return null;
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function issuedToPaymentRow(invoice: Invoice): PaymentTrackingRow {
  const paidAmount = getEffectivePaidAmount(invoice);
  const totalAmount = Number(invoice.total_amount);
  const status = getPaymentStatus(paidAmount, totalAmount, invoice.payment_date, invoice.due_date);
  return {
    id: invoice.id,
    direction: 'receivable',
    counterparty: invoice.buyer_name,
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date || null,
    paymentDate: invoice.payment_date ?? null,
    amountExVat: Number(invoice.amount),
    totalAmount,
    paidAmount,
    balanceAmount: invoiceBalance(totalAmount, paidAmount),
    currency: 'EUR',
    status,
    daysOverdue: getDaysOverdue(paidAmount, totalAmount, invoice.payment_date, invoice.due_date),
    daysUntilDue: getDaysUntilDue(paidAmount, totalAmount, invoice.payment_date, invoice.due_date),
    source: 'issued',
    raw: invoice,
  };
}

export function receivedToPaymentRow(invoice: ReceivedInvoice): PaymentTrackingRow {
  const paidAmount = getEffectivePaidAmount(invoice);
  const totalAmount = Number(invoice.total_amount);
  const status = getPaymentStatus(paidAmount, totalAmount, invoice.payment_date, invoice.due_date);
  return {
    id: invoice.id,
    direction: 'payable',
    counterparty: invoice.seller_name,
    invoiceNumber: invoice.invoice_number ?? null,
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date ?? null,
    paymentDate: invoice.payment_date ?? null,
    amountExVat: Number(invoice.amount),
    totalAmount,
    paidAmount,
    balanceAmount: invoiceBalance(totalAmount, paidAmount),
    currency: invoice.currency ?? 'EUR',
    status,
    daysOverdue: getDaysOverdue(paidAmount, totalAmount, invoice.payment_date, invoice.due_date),
    daysUntilDue: getDaysUntilDue(paidAmount, totalAmount, invoice.payment_date, invoice.due_date),
    source: 'received',
    raw: invoice,
  };
}

export function buildPaymentRows(
  issued: Invoice[],
  received: ReceivedInvoice[]
): PaymentTrackingRow[] {
  return [
    ...issued.map(issuedToPaymentRow),
    ...received.map(receivedToPaymentRow),
  ];
}

export function matchesPaymentFilter(row: PaymentTrackingRow, filter: PaymentListFilter): boolean {
  switch (filter) {
    case 'paid':
      return row.status === 'paid';
    case 'overdue':
      return row.status === 'overdue';
    case 'pending':
      return row.status === 'pending';
    case 'open':
      return row.status !== 'paid';
    default:
      return true;
  }
}

export function sortPaymentRows(rows: PaymentTrackingRow[]): PaymentTrackingRow[] {
  return [...rows].sort((a, b) => {
    if (a.status === 'paid' && b.status !== 'paid') return 1;
    if (b.status === 'paid' && a.status !== 'paid') return -1;
    if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
    const aDue = a.dueDate ?? a.invoiceDate;
    const bDue = b.dueDate ?? b.invoiceDate;
    return aDue.localeCompare(bDue);
  });
}

export function computePaymentSummary(rows: PaymentTrackingRow[]): PaymentSummary {
  const openRows = rows.filter((row) => row.status !== 'paid');
  const overdueRows = rows.filter((row) => row.status === 'overdue');

  const amountExVat = openRows.reduce((sum, row) => {
    if (row.status === 'partial' && row.totalAmount > 0) {
      return sum + (row.amountExVat * row.balanceAmount) / row.totalAmount;
    }
    return sum + row.amountExVat;
  }, 0);
  const totalAmount = openRows.reduce((sum, row) => sum + row.balanceAmount, 0);
  const overdueAmountExVat = overdueRows.reduce((sum, row) => sum + row.amountExVat, 0);
  const avgDaysOverdue =
    overdueRows.length > 0
      ? Math.round(
          overdueRows.reduce((sum, row) => sum + row.daysOverdue, 0) / overdueRows.length
        )
      : 0;

  return {
    count: openRows.length,
    amountExVat: roundMoney(amountExVat),
    totalAmount: roundMoney(totalAmount),
    overdueCount: overdueRows.length,
    overdueAmountExVat: roundMoney(overdueAmountExVat),
    avgDaysOverdue,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function paymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'paid':
      return 'Apmokėta';
    case 'partial':
      return 'Iš dalies';
    case 'overdue':
      return 'Vėluoja';
    default:
      return 'Laukia';
  }
}

export function paymentStatusClass(status: PaymentStatus): string {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
    case 'partial':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
    case 'overdue':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
    default:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200';
  }
}

export function formatPaymentAmount(row: PaymentTrackingRow): string {
  const amount = row.status === 'paid' ? row.totalAmount : row.balanceAmount;
  if (row.currency && row.currency !== 'EUR') {
    return row.currency === 'USD'
      ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : row.currency === 'GBP'
        ? `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `${amount} ${row.currency}`;
  }
  return formatEuro(amount);
}

export function formatDueLabel(row: PaymentTrackingRow): string {
  if (row.status === 'paid' && row.paymentDate) return `Apmokėta ${row.paymentDate}`;
  if (row.status === 'partial') {
    return `Likutis ${formatEuro(row.balanceAmount)} · apmokėta ${formatEuro(row.paidAmount)}`;
  }
  if (!row.dueDate) return '—';
  if (row.status === 'overdue') {
    const days = row.daysOverdue;
    return `${row.dueDate} · ${days} d. vėluoja`;
  }
  if (row.daysUntilDue === 0) return `${row.dueDate} · šiandien`;
  if (row.daysUntilDue != null) return `${row.dueDate} · po ${row.daysUntilDue} d.`;
  return row.dueDate;
}
