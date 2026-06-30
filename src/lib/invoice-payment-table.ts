import type { PaymentStatus, PaymentTrackingRow } from '@/lib/payment-tracking';
import { AMOUNT_TOLERANCE, getEffectivePaidAmount, invoiceBalance } from '@/lib/payment-allocation';
import { formatEuro } from '@/lib/invoice-utils';

export type InvoicePartialPaymentFields = {
  paid_amount?: number | null;
  payment_date?: string | null;
  total_amount: number;
};

export function getInvoicePartialPaymentSummary(
  invoice: InvoicePartialPaymentFields
): string | undefined {
  const paid = getEffectivePaidAmount(invoice);
  const total = Number(invoice.total_amount);
  const balance = invoiceBalance(total, paid);
  if (paid <= AMOUNT_TOLERANCE || balance <= AMOUNT_TOLERANCE) return undefined;
  return `Apmokėta ${formatEuro(paid)} · liko ${formatEuro(balance)}`;
}

export type OverdueSortDirection = 'desc' | 'asc';

export function invoicePaymentStatusLabel(status: PaymentStatus): string {
  if (status === 'paid') return 'Apmokėta';
  if (status === 'partial') return 'Dalinai';
  return 'Neapmokėta';
}

export function invoicePaymentStatusClass(status: PaymentStatus): string {
  if (status === 'paid') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
  }
  if (status === 'partial') {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
  }
  return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200';
}

export function invoicePartialPaymentTooltip(payment: PaymentTrackingRow): string | undefined {
  return getInvoicePartialPaymentSummary({
    paid_amount: payment.paidAmount,
    payment_date: payment.paymentDate,
    total_amount: payment.totalAmount,
  });
}

export function nextOverdueSort(current: OverdueSortDirection | null): OverdueSortDirection | null {
  if (current === null) return 'desc';
  if (current === 'desc') return 'asc';
  return null;
}
