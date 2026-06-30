'use client';

import {
  getInvoicePartialPaymentSummary,
  type InvoicePartialPaymentFields,
} from '@/lib/invoice-payment-table';

export function InvoicePartialPaymentNotice({
  invoice,
  className = '',
  withTitle = false,
}: {
  invoice: InvoicePartialPaymentFields;
  className?: string;
  withTitle?: boolean;
}) {
  const summary = getInvoicePartialPaymentSummary(invoice);
  if (!summary) return null;

  return (
    <div className={className}>
      {withTitle ? (
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Apmokėjimas</h3>
      ) : null}
      <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
        {summary}
      </p>
    </div>
  );
}
