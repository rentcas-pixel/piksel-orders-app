'use client';

import type { ReactNode } from 'react';
import type { BuyerFields } from '@/types';
import { invoiceFont } from '@/lib/invoice-font';
import { INVOICE_PDF_MIN_HEIGHT_PX, INVOICE_PDF_WIDTH_PX } from '@/lib/invoice-pdf';
import {
  amountInWords,
  getInvoiceLabels,
  type InvoiceLocale,
} from '@/lib/invoice-locale';
import { formatDateOnly, formatEuro, PIKSEL_LOGO_SRC, PIKSEL_SELLER } from '@/lib/invoice-utils';

export interface InvoiceDocumentViewProps {
  locale: InvoiceLocale;
  forPdf?: boolean;
  isGenerating?: boolean;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  buyer: BuyerFields;
  amount: number;
  vatAmount: number;
  totalWithVat: number;
  vatPercent: number;
  lineDescription: ReactNode;
  showDiscountNote?: boolean;
  discountPercent?: number;
  isEditing?: boolean;
  onInvoiceNumberChange?: (value: string) => void;
  onInvoiceDateChange?: (value: string) => void;
  onDueDateChange?: (value: string) => void;
  onAmountChange?: (value: number) => void;
}

export function InvoiceDocumentView({
  locale,
  forPdf = false,
  isGenerating = false,
  invoiceNumber,
  invoiceDate,
  dueDate,
  buyer,
  amount,
  vatAmount,
  totalWithVat,
  vatPercent,
  lineDescription,
  showDiscountNote = false,
  discountPercent = 0,
  isEditing = false,
  onInvoiceNumberChange,
  onInvoiceDateChange,
  onDueDateChange,
  onAmountChange,
}: InvoiceDocumentViewProps) {
  const labels = getInvoiceLabels(locale);

  return (
    <div
      className={`flex flex-col bg-white p-10 text-xs text-black ${invoiceFont.className} ${
        forPdf
          ? 'box-border'
          : isGenerating
            ? 'box-border'
            : 'min-h-[780px] rounded-lg border border-gray-200'
      }`}
      style={
        forPdf || isGenerating
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
        <h1 className="mb-4 text-lg font-normal">{labels.title}</h1>
        <div className="space-y-1 font-normal">
          <div>
            <span>{labels.series} </span>
            {isEditing && onInvoiceNumberChange ? (
              <input
                value={invoiceNumber}
                onChange={(e) => onInvoiceNumberChange(e.target.value)}
                className="border-b border-gray-300 bg-transparent text-center font-bold outline-none"
              />
            ) : (
              <span className="font-bold">{invoiceNumber}</span>
            )}
          </div>
          <div>
            <span>{labels.invoiceDate} </span>
            {isEditing && onInvoiceDateChange ? (
              <input
                type="text"
                inputMode="numeric"
                placeholder="yyyy-mm-dd"
                value={invoiceDate}
                onChange={(e) => onInvoiceDateChange(e.target.value)}
                className="bg-transparent font-bold outline-none"
              />
            ) : (
              <span className="font-bold">{formatDateOnly(invoiceDate)}</span>
            )}
          </div>
          <div>
            <span>{labels.dueDate} </span>
            {isEditing && onDueDateChange ? (
              <input
                type="text"
                inputMode="numeric"
                placeholder="yyyy-mm-dd"
                value={dueDate}
                onChange={(e) => onDueDateChange(e.target.value)}
                className="bg-transparent font-bold outline-none"
              />
            ) : (
              <span className="font-bold">{formatDateOnly(dueDate)}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-8">
        <div>
          <h3 className="mb-2 font-bold">{labels.seller}</h3>
          <div className="space-y-0.5">
            <p className="font-semibold">{PIKSEL_SELLER.name}</p>
            <p>
              {labels.companyCode} {PIKSEL_SELLER.companyCode}
            </p>
            <p>
              {labels.vatCode} {PIKSEL_SELLER.vatCode}
            </p>
            <p>{PIKSEL_SELLER.address}</p>
            <p>
              {labels.bank}: {PIKSEL_SELLER.bank}
            </p>
            <p>
              {labels.bankCode}: {PIKSEL_SELLER.bankCode}
            </p>
            <p>
              {labels.account}: {PIKSEL_SELLER.account}
            </p>
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-bold">{labels.buyer}</h3>
          <div className="space-y-0.5">
            <p className="font-semibold">{buyer.name || '—'}</p>
            <p>
              {labels.companyCode} {buyer.company_code || '—'}
            </p>
            <p>
              {labels.vatCode} {buyer.vat_code || '—'}
            </p>
            <p>
              {labels.address}: {buyer.address || '—'}
            </p>
          </div>
        </div>
      </div>

      <table className="mb-6 w-full border-collapse">
        <thead>
          <tr className="border-y border-gray-300">
            <th className="p-2 text-left font-bold">{labels.description}</th>
            <th className="p-2 text-center font-bold">{labels.quantity}</th>
            <th className="p-2 text-center font-bold">{labels.unit}</th>
            <th className="p-2 text-right font-bold">{labels.priceExVat}</th>
            <th className="p-2 text-right font-bold">{labels.amountExVat}</th>
            <th className="p-2 text-right font-bold">{labels.vatAmount}</th>
            <th className="p-2 text-center font-bold">{labels.vatPercent}</th>
            <th className="p-2 text-right font-bold">{labels.total}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="p-2">{lineDescription}</td>
            <td className="p-2 text-center">1</td>
            <td className="p-2 text-center">{labels.unitShort}</td>
            <td className="p-2 text-right">
              {isEditing && onAmountChange ? (
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
                  className="w-24 border-b border-gray-200 bg-transparent text-right outline-none"
                />
              ) : (
                formatEuro(amount)
              )}
            </td>
            <td className="p-2 text-right">{formatEuro(amount)}</td>
            <td className="p-2 text-right">{formatEuro(vatAmount)}</td>
            <td className="p-2 text-center">{vatPercent}%</td>
            <td className="p-2 text-right font-bold">{formatEuro(totalWithVat)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mb-4 flex justify-end font-normal">
        <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-right">
          <span>{labels.subtotalWithRate(vatPercent)}</span>
          <span>{formatEuro(amount)}</span>
          <span>{labels.vatWithRate(vatPercent)}</span>
          <span>{formatEuro(vatAmount)}</span>
          <span>{labels.grandTotal}</span>
          <span className="font-bold">{formatEuro(totalWithVat)}</span>
        </div>
      </div>

      {showDiscountNote && discountPercent > 0 && (
        <p className="mb-2 text-right text-xs text-gray-600">
          {labels.discountApplied(discountPercent)}
        </p>
      )}

      <p className="mb-6 font-normal">
        <span>{labels.amountInWords} </span>
        {amountInWords(totalWithVat, locale)}
      </p>

      <div
        className={`mt-auto ${
          forPdf || isGenerating ? 'mb-8 pt-2' : 'border-t border-gray-300 pt-4'
        }`}
      >
        <p className="font-normal italic">{labels.legalNote}</p>
        <p className="mt-1 font-normal italic">
          {labels.contactLabel} {labels.contactEmail}
        </p>
      </div>
    </div>
  );
}
