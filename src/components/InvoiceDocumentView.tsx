'use client';

import type { ReactNode } from 'react';
import { invoiceFont } from '@/lib/invoice-font';
import { INVOICE_PDF_WIDTH_PX } from '@/lib/invoice-pdf';
import {
  amountInWords,
  getInvoiceLabels,
  type InvoiceLocale,
} from '@/lib/invoice-locale';
import {
  calculateVat,
  formatDateOnly,
  formatEuro,
  PIKSEL_LOGO_SRC,
  PIKSEL_SELLER,
} from '@/lib/invoice-utils';

export interface InvoiceDocumentLineView {
  key: string;
  description: ReactNode;
  amount: number;
}

export interface InvoiceDocumentViewProps {
  locale: InvoiceLocale;
  forPdf?: boolean;
  isGenerating?: boolean;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  buyer: {
    name: string;
    company_code: string;
    vat_code: string;
    address: string;
  };
  amount: number;
  vatAmount: number;
  totalWithVat: number;
  vatPercent: number;
  /** Viena eilutė (senas formatas) */
  lineDescription?: ReactNode;
  /** Kelios eilutės (sujungta sąskaita) */
  lines?: InvoiceDocumentLineView[];
  showDiscountNote?: boolean;
  discountPercent?: number;
  isEditing?: boolean;
  onInvoiceNumberChange?: (value: string) => void;
  onInvoiceDateChange?: (value: string) => void;
  onDueDateChange?: (value: string) => void;
  onAmountChange?: (value: number) => void;
  onLineAmountChange?: (key: string, value: number) => void;
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
  lines,
  showDiscountNote = false,
  discountPercent = 0,
  isEditing = false,
  onInvoiceNumberChange,
  onInvoiceDateChange,
  onDueDateChange,
  onAmountChange,
  onLineAmountChange,
}: InvoiceDocumentViewProps) {
  const labels = getInvoiceLabels(locale);
  const vatRate = vatPercent / 100;
  const isPdfLayout = forPdf || isGenerating;
  const documentLines =
    lines && lines.length > 0
      ? lines
      : [
          {
            key: 'single',
            description: lineDescription ?? '—',
            amount,
          },
        ];

  return (
    <div
      data-invoice-document-root
      className={`flex w-full flex-col bg-white text-xs text-black ${invoiceFont.className} ${
        isPdfLayout ? 'box-border px-10 pb-8 pt-3' : 'min-h-[780px] rounded-lg border border-gray-200 p-10'
      }`}
      style={
        isPdfLayout
          ? {
              width: INVOICE_PDF_WIDTH_PX,
              minWidth: INVOICE_PDF_WIDTH_PX,
              maxWidth: INVOICE_PDF_WIDTH_PX,
              boxSizing: 'border-box',
            }
          : undefined
      }
    >
      <div className={`text-center ${isPdfLayout ? 'mb-4' : 'mb-6'}`}>
        <div className={`flex justify-center ${isPdfLayout ? 'mb-3' : 'mb-4'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PIKSEL_LOGO_SRC} alt="Piksel" className="h-[2.86rem] w-auto" />
        </div>
        <div className={`border-b border-gray-300 ${isPdfLayout ? 'mb-3' : 'mb-4'}`} />
        <h1 className={`font-normal ${isPdfLayout ? 'mb-3 text-lg' : 'mb-4 text-lg'}`}>{labels.title}</h1>
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

      <div className={`grid grid-cols-2 gap-8 ${isPdfLayout ? 'mb-4' : 'mb-6'}`}>
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

      <table
        className="mb-6 w-full border-collapse"
        style={{ width: '100%', tableLayout: 'fixed' }}
      >
        <colgroup>
          <col style={{ width: '36%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '11%' }} />
        </colgroup>
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
          {documentLines.map((line) => {
            const lineVat = calculateVat(line.amount, vatRate);
            const lineTotal = Math.round((line.amount + lineVat) * 100) / 100;
            const isSingleEditable =
              documentLines.length === 1 && isEditing && onAmountChange && line.key === 'single';

            return (
              <tr
                key={line.key}
                className={`border-b border-gray-200 ${forPdf || isGenerating ? 'break-inside-avoid' : ''}`}
              >
                <td className={`break-words align-top ${forPdf || isGenerating ? 'px-2 py-2.5' : 'p-2'}`}>
                  {line.description}
                </td>
                <td className={forPdf || isGenerating ? 'px-2 py-2.5 text-center' : 'p-2 text-center'}>
                  1
                </td>
                <td className={forPdf || isGenerating ? 'px-2 py-2.5 text-center' : 'p-2 text-center'}>
                  {labels.unitShort}
                </td>
                <td className={forPdf || isGenerating ? 'px-2 py-2.5 text-right' : 'p-2 text-right'}>
                  {isSingleEditable ? (
                    <input
                      type="number"
                      step="0.01"
                      value={line.amount}
                      onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
                      className="w-24 border-b border-gray-200 bg-transparent text-right outline-none"
                    />
                  ) : isEditing && onLineAmountChange && line.key !== 'single' ? (
                    <input
                      type="number"
                      step="0.01"
                      value={line.amount}
                      onChange={(e) =>
                        onLineAmountChange(line.key, parseFloat(e.target.value) || 0)
                      }
                      className="w-24 border-b border-gray-200 bg-transparent text-right outline-none"
                    />
                  ) : (
                    formatEuro(line.amount)
                  )}
                </td>
                <td className={forPdf || isGenerating ? 'px-2 py-2.5 text-right' : 'p-2 text-right'}>
                  {formatEuro(line.amount)}
                </td>
                <td className={forPdf || isGenerating ? 'px-2 py-2.5 text-right' : 'p-2 text-right'}>
                  {formatEuro(lineVat)}
                </td>
                <td className={forPdf || isGenerating ? 'px-2 py-2.5 text-center' : 'p-2 text-center'}>
                  {vatPercent}%
                </td>
                <td className={forPdf || isGenerating ? 'px-2 py-2.5 text-right font-bold' : 'p-2 text-right font-bold'}>
                  {formatEuro(lineTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div data-invoice-totals className="mb-4 flex justify-end font-normal">
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
          forPdf || isGenerating ? 'mb-4 pt-6' : 'border-t border-gray-300 pt-4'
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
