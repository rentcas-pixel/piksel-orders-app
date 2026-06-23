'use client';

import type { Invoice } from '@/types';
import { InvoiceLineDescription } from '@/components/InvoiceLineDescription';
import { InvoiceDocumentView } from '@/components/InvoiceDocumentView';
import {
  formatLineDescriptionForLocale,
  resolveInvoiceLocale,
} from '@/lib/invoice-locale';
import { getInvoiceVatRate, isStandaloneInvoiceOrder } from '@/lib/invoice-utils';

interface InvoiceDocumentPreviewProps {
  invoice: Invoice;
  forPdf?: boolean;
}

export function InvoiceDocumentPreview({ invoice, forPdf = false }: InvoiceDocumentPreviewProps) {
  const locale = resolveInvoiceLocale({ buyerName: invoice.buyer_name });
  const amount = Number(invoice.amount);
  const vatAmount = Number(invoice.vat_amount);
  const totalWithVat = Number(invoice.total_amount);
  const vatPercent = getInvoiceVatRate(invoice) * 100;
  const lineText = invoice.line_description
    ? formatLineDescriptionForLocale(invoice.line_description, locale)
    : '';

  return (
    <InvoiceDocumentView
      locale={locale}
      forPdf={forPdf}
      invoiceNumber={invoice.invoice_number}
      invoiceDate={invoice.invoice_date}
      dueDate={invoice.due_date}
      buyer={{
        name: invoice.buyer_name,
        company_code: invoice.buyer_company_code ?? '',
        vat_code: invoice.buyer_vat_code ?? '',
        address: invoice.buyer_address ?? '',
      }}
      amount={amount}
      vatAmount={vatAmount}
      totalWithVat={totalWithVat}
      vatPercent={vatPercent}
      lineDescription={
        lineText ? (
          isStandaloneInvoiceOrder(invoice.order_id) ? (
            <div className="whitespace-pre-wrap font-normal">{lineText}</div>
          ) : (
            <InvoiceLineDescription text={lineText} locale={locale} />
          )
        ) : (
          '—'
        )
      }
    />
  );
}
