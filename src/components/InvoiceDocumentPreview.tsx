'use client';

import type { Invoice } from '@/types';
import { InvoiceLineDescription } from '@/components/InvoiceLineDescription';
import { invoiceFont } from '@/lib/invoice-font';
import { INVOICE_PDF_MIN_HEIGHT_PX, INVOICE_PDF_WIDTH_PX } from '@/lib/invoice-pdf';
import { isStandaloneInvoiceOrder } from '@/lib/invoice-utils';
import {
  formatDateOnly,
  formatEuro,
  INVOICE_FOOTER,
  numberToWordsWithCurrency,
  PIKSEL_LOGO_SRC,
  PIKSEL_SELLER,
  VAT_RATE,
} from '@/lib/invoice-utils';

interface InvoiceDocumentPreviewProps {
  invoice: Invoice;
  forPdf?: boolean;
}

export function InvoiceDocumentPreview({ invoice, forPdf = false }: InvoiceDocumentPreviewProps) {
  const amount = Number(invoice.amount);
  const vatAmount = Number(invoice.vat_amount);
  const totalWithVat = Number(invoice.total_amount);

  return (
    <div
      className={`flex flex-col bg-white p-10 text-xs text-black ${invoiceFont.className} ${
        forPdf ? 'box-border' : 'mx-auto min-h-[780px] w-full max-w-4xl rounded-lg border border-gray-200'
      }`}
      style={
        forPdf
          ? { width: INVOICE_PDF_WIDTH_PX, minHeight: INVOICE_PDF_MIN_HEIGHT_PX }
          : undefined
      }
    >
      <div className="mb-6 text-center">
        <div className="mb-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PIKSEL_LOGO_SRC} alt="Piksel" className="h-[2.86rem] w-auto" />
        </div>
        <div className="mb-4 border-b border-gray-300" />
        <h1 className="mb-4 text-lg font-normal">PVM SĄSKAITA FAKTŪRA</h1>
        <div className="space-y-1 font-normal">
          <div>
            <span>Serija </span>
            <span className="font-bold">{invoice.invoice_number}</span>
          </div>
          <div>
            <span>Sąskaitos data </span>
            <span className="font-bold">{formatDateOnly(invoice.invoice_date)}</span>
          </div>
          <div>
            <span>Apmokėti iki </span>
            <span className="font-bold">{formatDateOnly(invoice.due_date)}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-8">
        <div>
          <h3 className="mb-2 font-bold">Pardavėjas</h3>
          <div className="space-y-0.5">
            <p className="font-semibold">{PIKSEL_SELLER.name}</p>
            <p>Įm. kodas {PIKSEL_SELLER.companyCode}</p>
            <p>PVM mokėtojo kodas {PIKSEL_SELLER.vatCode}</p>
            <p>{PIKSEL_SELLER.address}</p>
            <p>Bankas: {PIKSEL_SELLER.bank}</p>
            <p>Banko kodas: {PIKSEL_SELLER.bankCode}</p>
            <p>Sąskaita: {PIKSEL_SELLER.account}</p>
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-bold">Pirkėjas</h3>
          <div className="space-y-0.5">
            <p className="font-semibold">{invoice.buyer_name || '—'}</p>
            <p>Įm. kodas {invoice.buyer_company_code || '—'}</p>
            <p>PVM mokėtojo kodas {invoice.buyer_vat_code || '—'}</p>
            <p>Adresas: {invoice.buyer_address || '—'}</p>
          </div>
        </div>
      </div>

      <table className="mb-6 w-full border-collapse">
        <thead>
          <tr className="border-y border-gray-300">
            <th className="p-2 text-left font-bold">Pavadinimas</th>
            <th className="p-2 text-center font-bold">Kiekis</th>
            <th className="p-2 text-center font-bold">Matas</th>
            <th className="p-2 text-right font-bold">Kaina be PVM</th>
            <th className="p-2 text-right font-bold">Suma be PVM</th>
            <th className="p-2 text-right font-bold">PVM Suma</th>
            <th className="p-2 text-center font-bold">PVM %</th>
            <th className="p-2 text-right font-bold">Iš viso</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="p-2">
              {invoice.line_description ? (
                isStandaloneInvoiceOrder(invoice.order_id) ? (
                  <div className="whitespace-pre-wrap font-normal">{invoice.line_description}</div>
                ) : (
                  <InvoiceLineDescription text={invoice.line_description} />
                )
              ) : (
                '—'
              )}
            </td>
            <td className="p-2 text-center">1</td>
            <td className="p-2 text-center">vnt.</td>
            <td className="p-2 text-right">{formatEuro(amount)}</td>
            <td className="p-2 text-right">{formatEuro(amount)}</td>
            <td className="p-2 text-right">{formatEuro(vatAmount)}</td>
            <td className="p-2 text-center">{VAT_RATE * 100}%</td>
            <td className="p-2 text-right font-bold">{formatEuro(totalWithVat)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mb-4 flex justify-end font-normal">
        <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-right">
          <span>Suma be PVM ({VAT_RATE * 100}%):</span>
          <span>{formatEuro(amount)}</span>
          <span>PVM ({VAT_RATE * 100}%):</span>
          <span>{formatEuro(vatAmount)}</span>
          <span>Bendra suma:</span>
          <span className="font-bold">{formatEuro(totalWithVat)}</span>
        </div>
      </div>

      <p className="mb-6 font-normal">
        <span>Suma žodžiais: </span>
        {numberToWordsWithCurrency(totalWithVat)}
      </p>

      <div className={`mt-auto ${forPdf ? 'mb-8 pt-2' : 'border-t border-gray-300 pt-4'}`}>
        <p className="font-normal italic">{INVOICE_FOOTER.legalNote}</p>
        <p className="mt-1 font-normal italic">
          {INVOICE_FOOTER.contactLabel} {INVOICE_FOOTER.contactEmail}
        </p>
      </div>
    </div>
  );
}
