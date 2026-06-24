'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Invoice, InvoiceLine } from '@/types';
import { InvoiceLineDescription } from '@/components/InvoiceLineDescription';
import { InvoiceDocumentView } from '@/components/InvoiceDocumentView';
import {
  formatLineDescriptionForLocale,
  resolveInvoiceLocale,
} from '@/lib/invoice-locale';
import { InvoiceService } from '@/lib/invoice-service';
import { INVOICE_PDF_WIDTH_PX } from '@/lib/invoice-pdf';
import {
  getInvoiceVatRate,
  isCombinedInvoiceOrder,
  isStandaloneInvoiceOrder,
} from '@/lib/invoice-utils';

interface InvoiceDocumentPreviewProps {
  invoice: Invoice;
  forPdf?: boolean;
}

export function InvoiceDocumentPreview({ invoice, forPdf = false }: InvoiceDocumentPreviewProps) {
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [linesLoaded, setLinesLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLinesLoaded(false);
    void InvoiceService.getLinesForInvoice(invoice.id).then((data) => {
      if (!cancelled) {
        setLines(data);
        setLinesLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [invoice.id]);

  const locale = resolveInvoiceLocale({ buyerName: invoice.buyer_name });
  const amount = Number(invoice.amount);
  const vatAmount = Number(invoice.vat_amount);
  const totalWithVat = Number(invoice.total_amount);
  const vatPercent = getInvoiceVatRate(invoice) * 100;

  const documentLines = useMemo(() => {
    if (lines.length === 0) return undefined;
    return lines.map((line) => {
      const text = formatLineDescriptionForLocale(line.line_description, locale);
      return {
        key: line.id,
        amount: Number(line.amount),
        description: isStandaloneInvoiceOrder(invoice.order_id) ? (
          <div className="whitespace-pre-wrap font-normal">{text}</div>
        ) : (
          <InvoiceLineDescription text={text} locale={locale} />
        ),
      };
    });
  }, [lines, locale, invoice.order_id]);

  const singleLineText = invoice.line_description
    ? formatLineDescriptionForLocale(invoice.line_description, locale)
    : '';

  if (!linesLoaded) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-gray-500">
        Kraunama…
      </div>
    );
  }

  return (
    <div
      data-invoice-preview-ready="true"
      style={forPdf ? { width: INVOICE_PDF_WIDTH_PX } : undefined}
    >
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
      lines={documentLines}
      lineDescription={
        !documentLines && singleLineText ? (
          isStandaloneInvoiceOrder(invoice.order_id) ? (
            <div className="whitespace-pre-wrap font-normal">{singleLineText}</div>
          ) : (
            <InvoiceLineDescription text={singleLineText} locale={locale} />
          )
        ) : (
          '—'
        )
      }
    />
    </div>
  );
}
