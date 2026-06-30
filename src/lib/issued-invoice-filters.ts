import type { PaymentStatus } from '@/lib/payment-tracking';

export type IssuedInvoicePaymentFilter = 'all' | 'paid' | 'unpaid' | 'overdue';

export const ISSUED_PAYMENT_FILTER_OPTIONS: {
  value: IssuedInvoicePaymentFilter;
  label: string;
}[] = [
  { value: 'all', label: 'Visos' },
  { value: 'unpaid', label: 'Neapmokėtos' },
  { value: 'paid', label: 'Apmokėtos' },
  { value: 'overdue', label: 'Vėluoja' },
];

export function matchesIssuedInvoicePaymentFilter(
  status: PaymentStatus,
  filter: IssuedInvoicePaymentFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'paid') return status === 'paid';
  if (filter === 'unpaid') return status !== 'paid';
  return status === 'overdue';
}
