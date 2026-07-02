'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DocumentArrowDownIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { BuyerFields, Invoice, InvoiceLineInput, Order } from '@/types';
import { BillingCompanyService } from '@/lib/billing-company-service';
import {
  validateCombinableOrders,
  type CombinedInvoiceCandidate,
} from '@/lib/combined-invoice';
import { InvoiceService } from '@/lib/invoice-service';
import { PocketBaseService } from '@/lib/pocketbase';
import { INVOICE_PDF_WIDTH_PX } from '@/lib/invoice-pdf';
import { downloadIssuedInvoicePdfFromElement } from '@/lib/invoice-pdf-batch';
import {
  addDays,
  applyPercentDiscount,
  computeInvoiceTotals,
  createCombinedInvoiceOrderId,
  formatDateOnly,
  formatEuro,
  invoiceDateForBillingPeriod,
  isOwexxOrder,
  matchesOwexx,
  OWEXX_CLIENT_DISCOUNT_PERCENT,
  resolveInvoiceAmountAndPeriod,
  resolveVatRate,
} from '@/lib/invoice-utils';
import {
  formatLineDescriptionForLocale,
  resolveInvoiceLocale,
} from '@/lib/invoice-locale';
import { modalBtnDanger, modalBtnPrimary, modalBtnSecondary } from '@/lib/portal-ui';
import { InvoiceDocumentView } from '@/components/InvoiceDocumentView';
import { InvoiceLineDescription } from '@/components/InvoiceLineDescription';
import { InvoicePartialPaymentNotice } from '@/components/InvoicePartialPaymentNotice';
import {
  getInvoicePartialPaymentSummary,
  type InvoicePartialPaymentFields,
} from '@/lib/invoice-payment-table';

interface EditableLine {
  key: string;
  orderId: string;
  lineDescription: string;
  periodFrom: string;
  periodTo: string;
  baseAmount: number;
  amount: number;
}

interface CombinedInvoiceModalProps {
  isOpen: boolean;
  invoice?: Invoice | null;
  candidates?: CombinedInvoiceCandidate[] | null;
  billingMonth?: string;
  billingYear?: string;
  onClose: () => void;
  onSaved?: () => void;
}

const emptyBuyer = (): BuyerFields => ({
  name: '',
  company_code: '',
  vat_code: '',
  address: '',
});

export function CombinedInvoiceModal({
  isOpen,
  invoice: initialInvoice,
  candidates: initialCandidates,
  billingMonth = '',
  billingYear = '',
  onClose,
  onSaved,
}: CombinedInvoiceModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [combinedOrderId, setCombinedOrderId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() =>
    invoiceDateForBillingPeriod(billingMonth, billingYear)
  );
  const [dueDate, setDueDate] = useState(() =>
    addDays(invoiceDateForBillingPeriod(billingMonth, billingYear), 30)
  );
  const [buyer, setBuyer] = useState<BuyerFields>(emptyBuyer());
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [referenceOrders, setReferenceOrders] = useState<Order[]>([]);
  const [owexxDiscount50, setOwexxDiscount50] = useState(false);
  const [savedInvoicePayment, setSavedInvoicePayment] = useState<InvoicePartialPaymentFields | null>(
    null
  );

  const invoiceLocale = resolveInvoiceLocale({
    buyerName: buyer.name,
    order: referenceOrders[0] ?? undefined,
  });
  const vatRate = resolveVatRate({
    buyerName: buyer.name,
    order: referenceOrders[0] ?? undefined,
  });
  const vatPercent = vatRate * 100;

  const showOwexxDiscount = useMemo(
    () =>
      referenceOrders.some(isOwexxOrder) ||
      matchesOwexx(buyer.name) ||
      referenceOrders.some((o) => matchesOwexx(o.agency ?? '')),
    [referenceOrders, buyer.name]
  );

  const applyOwexxToLines = useCallback(
    (input: EditableLine[], enabled: boolean): EditableLine[] =>
      input.map((line) => ({
        ...line,
        amount:
          enabled && showOwexxDiscount
            ? applyPercentDiscount(line.baseAmount, OWEXX_CLIENT_DISCOUNT_PERCENT)
            : line.baseAmount,
      })),
    [showOwexxDiscount]
  );

  const totals = useMemo(
    () => computeInvoiceTotals(
      lines.map((l) => l.amount),
      vatRate
    ),
    [lines, vatRate]
  );

  const documentLines = useMemo(
    () =>
      lines.map((line) => ({
        key: line.key,
        amount: line.amount,
        description: (
          <InvoiceLineDescription
            text={formatLineDescriptionForLocale(line.lineDescription, invoiceLocale)}
            locale={invoiceLocale}
          />
        ),
      })),
    [lines, invoiceLocale]
  );

  const initFromCandidates = useCallback(async (candidates: CombinedInvoiceCandidate[]) => {
    setLoading(true);
    try {
      const orders = candidates.map((c) => c.order);
      if (orders.length < 2) {
        alert('Pasirinkite bent 2 kampanijas.');
        onClose();
        return;
      }

      const buyerLookup = validateCombinableOrders(orders) ?? '';

      setReferenceOrders(orders);
      setCombinedOrderId(createCombinedInvoiceOrderId());
      setSavedInvoiceId(null);
      setSavedInvoicePayment(null);
      setIsEditing(true);

      const nextNumber = await InvoiceService.getNextInvoiceNumber();
      const invoiceDay = invoiceDateForBillingPeriod(billingMonth, billingYear);
      setInvoiceNumber(nextNumber);
      setInvoiceDate(invoiceDay);
      setDueDate(addDays(invoiceDay, 30));
      setOwexxDiscount50(false);

      const match = buyerLookup ? await BillingCompanyService.findBestMatch(buyerLookup) : null;
      if (match) {
        setBuyer({
          name: match.full_name || match.name,
          company_code: match.company_code ?? '',
          vat_code: match.vat_code ?? '',
          address: match.address ?? '',
        });
      } else {
        setBuyer({ name: buyerLookup, company_code: '', vat_code: '', address: '' });
      }

      setLines(
        candidates.map((c) => ({
          key: `new-${c.order.id}`,
          orderId: c.order.id,
          lineDescription: c.lineDescription,
          periodFrom: c.periodFrom,
          periodTo: c.periodTo,
          baseAmount: c.monthlyAmount,
          amount: c.monthlyAmount,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [onClose, billingMonth, billingYear]);

  const initFromInvoice = useCallback(async (invoice: Invoice) => {
    setLoading(true);
    try {
      setCombinedOrderId(invoice.order_id);
      setSavedInvoiceId(invoice.id);
      setSavedInvoicePayment({
        paid_amount: Number(invoice.paid_amount ?? 0),
        total_amount: Number(invoice.total_amount),
        payment_date: invoice.payment_date ?? null,
      });
      setInvoiceNumber(invoice.invoice_number);
      setInvoiceDate(invoice.invoice_date);
      setDueDate(invoice.due_date);
      setBuyer({
        name: invoice.buyer_name,
        company_code: invoice.buyer_company_code ?? '',
        vat_code: invoice.buyer_vat_code ?? '',
        address: invoice.buyer_address ?? '',
      });
      setIsEditing(false);

      const dbLines = await InvoiceService.getLinesForInvoice(invoice.id);
      const orders = await Promise.all(
        dbLines.map((line) => PocketBaseService.getOrder(line.order_id).catch(() => null))
      );
      setReferenceOrders(orders.filter((o): o is Order => o !== null));

      const loadedLines: EditableLine[] = dbLines.map((line) => {
        const order = orders.find((o) => o?.id === line.order_id) ?? null;
        const baseAmount = order
          ? resolveInvoiceAmountAndPeriod(order, invoice.invoice_date, 'monthly').amount
          : Number(line.amount);
        return {
          key: line.id,
          orderId: line.order_id,
          lineDescription: line.line_description,
          periodFrom: line.period_from ?? '',
          periodTo: line.period_to ?? '',
          baseAmount,
          amount: Number(line.amount),
        };
      });

      const hasOwexx = orders.some((o) => o && isOwexxOrder(o));
      let detectedDiscount = false;
      if (hasOwexx && loadedLines.length > 0) {
        const discountedSum = loadedLines.reduce(
          (s, l) => s + applyPercentDiscount(l.baseAmount, OWEXX_CLIENT_DISCOUNT_PERCENT),
          0
        );
        const actualSum = loadedLines.reduce((s, l) => s + l.amount, 0);
        detectedDiscount = Math.abs(actualSum - discountedSum) < 0.05 * loadedLines.length;
      }

      setOwexxDiscount50(detectedDiscount);
      setLines(loadedLines);
    } catch (error) {
      console.error('initFromInvoice:', error);
      alert('Nepavyko užkrauti sujungtos sąskaitos.');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialInvoice) {
      void initFromInvoice(initialInvoice);
    } else if (initialCandidates && initialCandidates.length > 0) {
      void initFromCandidates(initialCandidates);
    }
  }, [isOpen, initialInvoice, initialCandidates, initFromInvoice, initFromCandidates]);

  useEffect(() => {
    if (!showOwexxDiscount) return;
    setLines((prev) => applyOwexxToLines(prev, owexxDiscount50));
  }, [owexxDiscount50, showOwexxDiscount, applyOwexxToLines]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, onClose]);

  const handleRemoveLine = async (line: EditableLine) => {
    const order = referenceOrders.find((o) => o.id === line.orderId);
    const label = order?.invoice_id ? `U-${order.invoice_id}` : line.orderId;
    const confirmed = window.confirm(
      `Pašalinti ${label} iš sąskaitos?\n\nŠio užsakymo sąskaitos būsena bus atstatyta į „neišrašyta“.`
    );
    if (!confirmed) return;

    if (lines.length <= 1) {
      alert('Sąskaitoje turi likti bent viena eilutė. Norėdami atšaukti viską — ištrinkite visą sąskaitą.');
      return;
    }

    if (savedInvoiceId) {
      setLoading(true);
      try {
        const updated = await InvoiceService.removeOrderFromCombinedInvoice(
          savedInvoiceId,
          line.orderId
        );
        if (!updated) {
          onSaved?.();
          onClose();
          return;
        }
        setLines((prev) => prev.filter((l) => l.key !== line.key));
        setReferenceOrders((prev) => prev.filter((o) => o.id !== line.orderId));
        setSavedInvoiceId(updated.id);
        onSaved?.();
      } catch (error) {
        console.error('remove line from combined invoice:', error);
        alert('Nepavyko pašalinti eilutės.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const nextLines = lines.filter((l) => l.key !== line.key);
    if (nextLines.length < 2) {
      alert('Sujungtoje sąskaitoje turi likti bent 2 kampanijos.');
      return;
    }
    setLines(nextLines);
    setReferenceOrders((prev) => prev.filter((o) => o.id !== line.orderId));
  };

  const handleLineAmountChange = (key: string, value: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const baseAmount =
          owexxDiscount50 && showOwexxDiscount
            ? Math.round((value / (1 - OWEXX_CLIENT_DISCOUNT_PERCENT / 100)) * 100) / 100
            : value;
        return { ...l, amount: value, baseAmount };
      })
    );
  };

  const baseTotal = useMemo(
    () => lines.reduce((s, l) => s + l.baseAmount, 0),
    [lines]
  );

  const buildLineInputs = (): InvoiceLineInput[] =>
    lines.map((line, index) => ({
      order_id: line.orderId,
      line_description: line.lineDescription,
      period_from: line.periodFrom || null,
      period_to: line.periodTo || null,
      amount: line.amount,
      sort_order: index,
    }));

  const persist = async () => {
    if (!combinedOrderId || lines.length === 0) return;

    const lineInputs = buildLineInputs();
    const firstLine = lineInputs[0];

    const saved = await InvoiceService.saveCombinedInvoice(
      {
        order_id: combinedOrderId,
        invoice_number: invoiceNumber,
        amount: totals.amount,
        vat_amount: totals.vat_amount,
        total_amount: totals.total_amount,
        invoice_date: invoiceDate,
        due_date: dueDate,
        buyer_name: buyer.name,
        buyer_company_code: buyer.company_code || null,
        buyer_vat_code: buyer.vat_code || null,
        buyer_address: buyer.address || null,
        line_description: firstLine?.line_description ?? null,
        period_from: firstLine?.period_from ?? null,
        period_to: firstLine?.period_to ?? null,
      },
      lineInputs,
      savedInvoiceId
    );
    setSavedInvoiceId(saved.id);
  };

  const handleSave = async () => {
    if (!buyer.name.trim()) {
      alert('Įveskite pirkėjo pavadinimą.');
      return;
    }
    setLoading(true);
    try {
      await persist();
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('save combined invoice:', error);
      alert(
        'Nepavyko išsaugoti sujungtos sąskaitos. Patikrinkite ar Supabase lentelė invoice_lines sukurta.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!savedInvoiceId) return;
    const confirmed = window.confirm(
      `Ištrinti sujungtą sąskaitą ${invoiceNumber}?\n\nVisų susietų užsakymų sąskaitos būsena bus atstatyta.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await InvoiceService.deleteInvoice(savedInvoiceId);
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('delete combined invoice:', error);
      alert('Nepavyko ištrinti sąskaitos.');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!invoiceRef.current) return;
    setIsGenerating(true);
    setIsEditing(false);
    await new Promise((r) => setTimeout(r, 300));
    try {
      await downloadIssuedInvoicePdfFromElement(invoiceRef.current, {
        invoice_number: invoiceNumber,
        buyer_name: buyer.name || 'Saskaita',
        invoice_date: invoiceDate,
      });
    } catch (error) {
      console.error('PDF:', error);
      alert('Klaida generuojant PDF');
    } finally {
      setIsGenerating(false);
      if (!savedInvoiceId) setIsEditing(true);
    }
  };

  if (!isOpen) return null;

  const isExisting = Boolean(savedInvoiceId);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isExisting ? 'Sujungta sąskaita' : 'Nauja sujungta sąskaita'}
          </h2>
          <div className="flex items-center gap-2">
            {isExisting && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={loading}
                className={`${modalBtnDanger} inline-flex items-center gap-1.5`}
                title="Ištrinti sąskaitą"
              >
                <TrashIcon className="h-5 w-5" />
                Ištrinti
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              className={modalBtnSecondary}
            >
              {isEditing ? 'Peržiūra' : 'Redaguoti'}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="grid flex-1 overflow-hidden lg:grid-cols-[280px_1fr]">
          <aside className="overflow-y-auto border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50 lg:border-b-0 lg:border-r">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Pirkėjas</h3>
            <div className="space-y-2">
              {(['name', 'company_code', 'vat_code', 'address'] as const).map((field) => (
                <div key={field}>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    {field === 'name'
                      ? 'Pavadinimas'
                      : field === 'company_code'
                        ? 'Įm. kodas'
                        : field === 'vat_code'
                          ? 'PVM kodas'
                          : 'Adresas'}
                  </label>
                  <input
                    type="text"
                    value={buyer[field]}
                    onChange={(e) => setBuyer((b) => ({ ...b, [field]: e.target.value }))}
                    disabled={!isEditing}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:disabled:bg-gray-900"
                  />
                </div>
              ))}
            </div>

            {isExisting &&
              savedInvoicePayment &&
              getInvoicePartialPaymentSummary(savedInvoicePayment) && (
              <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
                <InvoicePartialPaymentNotice invoice={savedInvoicePayment} withTitle />
              </div>
            )}

            {showOwexxDiscount && (
              <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
                <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Nuolaida</h3>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={owexxDiscount50}
                    onChange={(e) => setOwexxDiscount50(e.target.checked)}
                    disabled={!isEditing}
                    className="mt-0.5"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    50% nuolaida (Owexx)
                    {owexxDiscount50 && baseTotal > 0 && (
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {formatEuro(baseTotal)} → {formatEuro(totals.amount)}
                      </span>
                    )}
                  </span>
                </label>
              </div>
            )}

            <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
              <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                Eilutės ({lines.length})
              </h3>
              <ul className="max-h-48 space-y-2 overflow-y-auto text-xs text-gray-600 dark:text-gray-400">
                {lines.map((line) => {
                  const order = referenceOrders.find((o) => o.id === line.orderId);
                  return (
                  <li key={line.key} className="rounded border border-gray-200 p-2 dark:border-gray-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 dark:text-gray-200">
                          {order?.invoice_id ? `U-${order.invoice_id}` : line.orderId}
                        </div>
                        <div className="mt-0.5">
                          {line.periodFrom} – {line.periodTo}
                        </div>
                      </div>
                      {(isEditing || !isExisting) && (
                        <button
                          type="button"
                          onClick={() => void handleRemoveLine(line)}
                          disabled={loading}
                          className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
                          title="Pašalinti iš sąskaitos"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={loading}
                className={modalBtnPrimary}
              >
                {isExisting ? 'Atnaujinti' : 'Išsaugoti sąskaitą'}
              </button>
              {isExisting && (
                <button
                  type="button"
                  onClick={() => void generatePDF()}
                  disabled={isGenerating || loading}
                  className={`${modalBtnSecondary} inline-flex items-center justify-center gap-2`}
                >
                  <DocumentArrowDownIcon className="h-5 w-5" />
                  PDF
                </button>
              )}
            </div>
          </aside>

          <div className="overflow-y-auto p-4">
            {loading && lines.length === 0 ? (
              <p className="text-sm text-gray-500">Kraunama…</p>
            ) : (
              <div
                ref={invoiceRef}
                className="mx-auto w-full"
                style={{
                  maxWidth: INVOICE_PDF_WIDTH_PX,
                  width: isGenerating ? INVOICE_PDF_WIDTH_PX : undefined,
                }}
              >
                <InvoiceDocumentView
                  locale={invoiceLocale}
                  isGenerating={isGenerating}
                  invoiceNumber={invoiceNumber}
                  invoiceDate={invoiceDate}
                  dueDate={dueDate}
                  buyer={buyer}
                  amount={totals.amount}
                  vatAmount={totals.vat_amount}
                  totalWithVat={totals.total_amount}
                  vatPercent={vatPercent}
                  lines={documentLines}
                  isEditing={isEditing}
                  showDiscountNote={showOwexxDiscount && owexxDiscount50}
                  discountPercent={OWEXX_CLIENT_DISCOUNT_PERCENT}
                  onInvoiceNumberChange={setInvoiceNumber}
                  onInvoiceDateChange={(next) => setInvoiceDate(formatDateOnly(next))}
                  onDueDateChange={(next) => setDueDate(formatDateOnly(next))}
                  onLineAmountChange={handleLineAmountChange}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
