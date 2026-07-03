'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DocumentArrowDownIcon, PlusCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { BuyerFields, BuyerSource, Invoice, InvoiceLineInput, Order } from '@/types';
import { BillingCompanyService } from '@/lib/billing-company-service';
import { InvoiceService } from '@/lib/invoice-service';
import { downloadIssuedInvoicePdfFromElement } from '@/lib/invoice-pdf-batch';
import { PocketBaseService } from '@/lib/pocketbase';
import { SupabaseService } from '@/lib/supabase-service';
import type { OrderBillingPeriod } from '@/types';
import { resolveListMonthYear } from '@/lib/orders-filters';
import {
  addDays,
  calculateVat,
  computeInvoiceTotals,
  formatDateOnly,
  formatEuro,
  formatInvoiceDate,
  resolveInvoiceAmountAndPeriod,
  resolveVatRate,
  defaultInvoiceDate,
  isOwexxOrder,
  isStandaloneInvoiceOrder,
  isMultiMonthOrder,
  matchesOwexx,
  applyPercentDiscount,
  OWEXX_CLIENT_DISCOUNT_PERCENT,
  getBillingMonthOptions,
  invoiceDateForBillingPeriod,
  billingMonthKeyFromDate,
  resolveDefaultBillingMonthKey,
  resolveInvoiceAmountMode,
  resolveSavedInvoiceBaseAmount,
  type InvoiceAmountMode,
} from '@/lib/invoice-utils';
import { getMonthFilterLabel } from '@/lib/filter-options';
import {
  buildLineDescription,
  formatLineDescriptionForLocale,
  getInvoiceLabels,
  resolveInvoiceLocale,
} from '@/lib/invoice-locale';
import {
  modalBtnDanger,
  modalBtnPrimary,
  modalBtnSecondary,
} from '@/lib/portal-ui';
import { InvoiceDocumentView } from '@/components/InvoiceDocumentView';
import { InvoiceLineDescription } from '@/components/InvoiceLineDescription';
import { InvoicePartialPaymentNotice } from '@/components/InvoicePartialPaymentNotice';
import type { InvoicePartialPaymentFields } from '@/lib/invoice-payment-table';

interface StandaloneLine {
  key: string;
  description: string;
  amount: number;
}

function createStandaloneLine(overrides: Partial<StandaloneLine> = {}): StandaloneLine {
  return {
    key: `line-${crypto.randomUUID()}`,
    description: '',
    amount: 0,
    ...overrides,
  };
}

interface InvoiceModalProps {
  order: Order | null;
  /** Atidaroma konkreti sąskaita (pvz. iš sąrašo), ne tik „paskutinė“ užsakymui */
  initialInvoice?: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onOpenCombined?: (invoice: Invoice) => void;
  billingMonth?: string;
  billingYear?: string;
}

const emptyBuyer = (): BuyerFields => ({
  name: '',
  company_code: '',
  vat_code: '',
  address: '',
});

export function InvoiceModal({
  order,
  initialInvoice = null,
  isOpen,
  onClose,
  onSaved,
  onOpenCombined,
  billingMonth = '',
  billingYear = '',
}: InvoiceModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(formatInvoiceDate(new Date()));
  const [dueDate, setDueDate] = useState(addDays(formatInvoiceDate(new Date()), 30));
  const [amount, setAmount] = useState(0);
  const [baseAmount, setBaseAmount] = useState(0);
  const [owexxDiscount50, setOwexxDiscount50] = useState(false);
  const [lineDescription, setLineDescription] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [buyerSource, setBuyerSource] = useState<BuyerSource>('agency');
  const [buyer, setBuyer] = useState<BuyerFields>(emptyBuyer());
  const [companySearch, setCompanySearch] = useState('');
  const [companyResults, setCompanyResults] = useState<
    Awaited<ReturnType<typeof BillingCompanyService.search>>
  >([]);
  const [saveCompanyToDb, setSaveCompanyToDb] = useState(false);
  const [amountMode, setAmountMode] = useState<InvoiceAmountMode>('monthly');
  const [selectedBillingMonthKey, setSelectedBillingMonthKey] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ link: string; viaduct_link: string } | null>(null);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState<string | null>(null);
  const [savedInvoicePayment, setSavedInvoicePayment] = useState<InvoicePartialPaymentFields | null>(
    null
  );
  const [standaloneLines, setStandaloneLines] = useState<StandaloneLine[]>([createStandaloneLine()]);
  const [billingPeriods, setBillingPeriods] = useState<OrderBillingPeriod[]>([]);

  const applyAmountAndPeriod = useCallback(
    (o: Order, date: string, mode: InvoiceAmountMode, buyerName = '', periods?: OrderBillingPeriod[] | null) => {
      const resolved = resolveInvoiceAmountAndPeriod(o, date, mode, periods ?? billingPeriods);
      const locale = resolveInvoiceLocale({ buyerName, order: o });
      setBaseAmount(resolved.amount);
      setPeriodFrom(resolved.from);
      setPeriodTo(resolved.to);
      setLineDescription(buildLineDescription(o, resolved.from, resolved.to, locale));
    },
    [billingPeriods]
  );

  const applyBillingMonth = useCallback(
    (o: Order, monthKey: string, buyerName = '', periods?: OrderBillingPeriod[] | null) => {
      const periodList = periods ?? billingPeriods;
      const option = getBillingMonthOptions(o, periodList).find((entry) => entry.key === monthKey);
      if (!option) return;
      setSelectedBillingMonthKey(monthKey);
      setInvoiceDate(option.invoiceDate);
      setDueDate(addDays(option.invoiceDate, 30));
      applyAmountAndPeriod(o, option.invoiceDate, 'monthly', buyerName, periodList);
    },
    [applyAmountAndPeriod, billingPeriods]
  );

  const billingMonthOptions =
    order && isMultiMonthOrder(order) ? getBillingMonthOptions(order, billingPeriods) : [];
  const billingScopeLocked = Boolean(savedInvoiceId && !isEditing);
  const standalone = order ? isStandaloneInvoiceOrder(order.id) : false;
  const standaloneLinesEditable = standalone && (!savedInvoiceId || isEditing);

  const standaloneLinesTotal = useMemo(
    () =>
      Math.round(standaloneLines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100,
    [standaloneLines]
  );
  const invoiceAmount = standalone ? standaloneLinesTotal : amount;

  const handleOwexxDiscountToggle = (enabled: boolean) => {
    setOwexxDiscount50(enabled);
  };

  const showOwexxDiscount =
    order &&
    (isOwexxOrder(order) || matchesOwexx(buyer.name) || matchesOwexx(order.agency ?? ''));

  useEffect(() => {
    if (baseAmount <= 0) return;
    const discountPercent =
      showOwexxDiscount && owexxDiscount50 ? OWEXX_CLIENT_DISCOUNT_PERCENT : 0;
    setAmount(applyPercentDiscount(baseAmount, discountPercent));
  }, [baseAmount, owexxDiscount50, showOwexxDiscount]);

  const updateInvoicePeriod = (from: string, to: string) => {
    const nextFrom = formatDateOnly(from);
    const nextTo = formatDateOnly(to);
    setPeriodFrom(nextFrom);
    setPeriodTo(nextTo);
    if (order) {
      const locale = resolveInvoiceLocale({ buyerName: buyer.name, order });
      setLineDescription(buildLineDescription(order, nextFrom, nextTo, locale));
    }
  };
  const invoiceLocale = resolveInvoiceLocale({ buyerName: buyer.name, order });
  const invoiceLabels = getInvoiceLabels(invoiceLocale);
  const vatRate = resolveVatRate({ buyerName: buyer.name, order });
  const vatAmount = calculateVat(invoiceAmount, vatRate);
  const totalWithVat = Math.round((invoiceAmount + vatAmount) * 100) / 100;
  const vatPercent = vatRate * 100;

  const standaloneDocumentLines = useMemo(
    () =>
      standaloneLines.map((line) => ({
        key: line.key,
        amount: line.amount,
        description: (
          <div className="whitespace-pre-wrap font-normal">{line.description.trim() || '—'}</div>
        ),
      })),
    [standaloneLines]
  );

  const addStandaloneLine = () => {
    setStandaloneLines((lines) => [...lines, createStandaloneLine()]);
  };

  const removeStandaloneLine = (key: string) => {
    setStandaloneLines((lines) => (lines.length <= 1 ? lines : lines.filter((line) => line.key !== key)));
  };

  const updateStandaloneLine = (
    key: string,
    patch: Partial<Pick<StandaloneLine, 'description' | 'amount'>>
  ) => {
    setStandaloneLines((lines) =>
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  };

  useEffect(() => {
    if (!order || isStandaloneInvoiceOrder(order.id) || !periodFrom || !periodTo) return;
    setLineDescription(buildLineDescription(order, periodFrom, periodTo, invoiceLocale));
  }, [invoiceLocale, order, periodFrom, periodTo]);

  const applyBuyerFromCompany = useCallback(
    (c: { full_name: string; company_code?: string | null; vat_code?: string | null; address?: string | null }) => {
      setBuyer({
        name: c.full_name,
        company_code: c.company_code ?? '',
        vat_code: c.vat_code ?? '',
        address: c.address ?? '',
      });
    },
    []
  );

  const initFromOrder = useCallback(async (o: Order, invoiceHint: Invoice | null = null) => {
    setLoading(true);
    setOwexxDiscount50(false);
    setBaseAmount(0);
    setSelectedBillingMonthKey(null);

    const periods = await SupabaseService.getOrderBillingPeriod(o.id);
    setBillingPeriods(periods);

    const pickMonthlyInvoiceDay = (target: Order): string => {
      const { month: resolvedMonth, year: resolvedYear } = resolveListMonthYear(
        billingMonth,
        billingYear
      );
      if (resolvedMonth && resolvedYear) {
        return invoiceDateForBillingPeriod(resolvedMonth, resolvedYear);
      }
      if (!isMultiMonthOrder(target)) return defaultInvoiceDate();
      const defaultKey = resolveDefaultBillingMonthKey(target, billingMonth, billingYear, periods);
      const option = defaultKey
        ? getBillingMonthOptions(target, periods).find((entry) => entry.key === defaultKey)
        : undefined;
      if (defaultKey && option) {
        setSelectedBillingMonthKey(defaultKey);
        return option.invoiceDate;
      }
      return defaultInvoiceDate();
    };

    try {
      const existing = await InvoiceService.resolveExistingOrderInvoice(o, {
        invoiceHint: invoiceHint,
        billingMonth,
        billingYear,
      });

      if (
        existing &&
        (await InvoiceService.hasInvoiceLines(existing.id)) &&
        !isStandaloneInvoiceOrder(o.id)
      ) {
        onOpenCombined?.(existing);
        onClose();
        return;
      }

      if (existing) {
        setSavedInvoiceId(existing.id);
        setSavedInvoicePayment({
          paid_amount: Number(existing.paid_amount ?? 0),
          total_amount: Number(existing.total_amount),
          payment_date: existing.payment_date ?? null,
        });
        setInvoiceNumber(existing.invoice_number);
        setInvoiceDate(existing.invoice_date);
        setDueDate(existing.due_date);
        setPaymentDate(existing.payment_date ? formatDateOnly(existing.payment_date) : null);
        setLineDescription(
          existing.line_description
            ? formatLineDescriptionForLocale(existing.line_description, resolveInvoiceLocale({
                buyerName: existing.buyer_name,
                order: o,
              }))
            : buildLineDescription(
                o,
                existing.period_from ?? formatDateOnly(o.from),
                existing.period_to ?? formatDateOnly(o.to),
                resolveInvoiceLocale({ buyerName: existing.buyer_name, order: o })
              )
        );
        setPeriodFrom(existing.period_from ?? formatDateOnly(o.from));
        setPeriodTo(existing.period_to ?? formatDateOnly(o.to));
        setBuyer({
          name: existing.buyer_name,
          company_code: existing.buyer_company_code ?? '',
          vat_code: existing.buyer_vat_code ?? '',
          address: existing.buyer_address ?? '',
        });
        setBuyerSource('manual');

        if (isStandaloneInvoiceOrder(o.id)) {
          setBaseAmount(existing.amount);
          setOwexxDiscount50(false);
          setAmountMode('monthly');
          const dbLines = await InvoiceService.getLinesForInvoice(existing.id);
          if (dbLines.length > 0) {
            setStandaloneLines(
              dbLines.map((line) => ({
                key: line.id,
                description: line.line_description,
                amount: Number(line.amount),
              }))
            );
          } else {
            setStandaloneLines([
              createStandaloneLine({
                key: 'line-0',
                description: existing.line_description ?? '',
                amount: Number(existing.amount),
              }),
            ]);
          }
        } else {
          const mode = resolveInvoiceAmountMode(existing, o);
          const resolvedBase = resolveInvoiceAmountAndPeriod(
            o,
            existing.invoice_date,
            mode,
            periods
          ).amount;
          const hadDiscount =
            isOwexxOrder(o) &&
            resolvedBase > 0 &&
            Math.abs(
              existing.amount -
                applyPercentDiscount(resolvedBase, OWEXX_CLIENT_DISCOUNT_PERCENT)
            ) < 0.05;
          setOwexxDiscount50(hadDiscount);
          setAmountMode(mode);
          setBaseAmount(
            resolveSavedInvoiceBaseAmount(existing.amount, resolvedBase, hadDiscount)
          );
          if (mode === 'monthly' && isMultiMonthOrder(o)) {
            const key =
              billingMonthKeyFromDate(existing.invoice_date) ??
              resolveDefaultBillingMonthKey(o, billingMonth, billingYear, periods);
            if (key && getBillingMonthOptions(o, periods).some((entry) => entry.key === key)) {
              setSelectedBillingMonthKey(key);
            }
          }
          if (existing.amount === 0 && (o.final_price ?? 0) > 0) {
            const date =
              mode === 'monthly'
                ? isMultiMonthOrder(o)
                  ? pickMonthlyInvoiceDay(o)
                  : defaultInvoiceDate()
                : existing.invoice_date;
            if (mode === 'monthly') {
              setInvoiceDate(date);
              setDueDate(addDays(date, 30));
            }
            applyAmountAndPeriod(o, date, mode, existing.buyer_name, periods);
          }
        }
      } else if (isStandaloneInvoiceOrder(o.id)) {
        setSavedInvoiceId(null);
        setSavedInvoicePayment(null);
        setPaymentDate(null);
        const invoiceDay = defaultInvoiceDate();
        setInvoiceDate(invoiceDay);
        setDueDate(addDays(invoiceDay, 30));
        setInvoiceNumber(await InvoiceService.getNextInvoiceNumber());
        setBaseAmount(0);
        setLineDescription('');
        setPeriodFrom(invoiceDay);
        setPeriodTo(invoiceDay);
        setStandaloneLines([createStandaloneLine()]);
        setBuyer(emptyBuyer());
        setBuyerSource('saved');
        setAmountMode('monthly');
        setIsEditing(true);
      } else {
        setSavedInvoiceId(null);
        setSavedInvoicePayment(null);
        setPaymentDate(null);
        const invoiceDay = pickMonthlyInvoiceDay(o);
        setInvoiceDate(invoiceDay);
        setDueDate(addDays(invoiceDay, 30));
        setInvoiceNumber(await InvoiceService.getNextInvoiceNumber());

        setAmountMode('monthly');

        const defaultSource: BuyerSource = o.agency?.trim() ? 'agency' : 'client';
        setBuyerSource(defaultSource);

        const lookupLabel = defaultSource === 'agency' ? o.agency : o.client;
        applyAmountAndPeriod(o, invoiceDay, 'monthly', lookupLabel || '', periods);
        const match = await BillingCompanyService.findBestMatch(lookupLabel);
        if (match) {
          applyBuyerFromCompany(match);
        } else {
          setBuyer({
            name: lookupLabel || '',
            company_code: '',
            vat_code: '',
            address: '',
          });
        }
      }

      if (!isStandaloneInvoiceOrder(o.id)) {
        setIsEditing(false);
      }

      if (!isStandaloneInvoiceOrder(o.id)) {
        try {
          const quoteData =
            (await PocketBaseService.getQuoteByOrderId(o.id)) ??
            (await PocketBaseService.getQuoteByOrderId(o.invoice_id));
          setQuote(quoteData);
        } catch {
          setQuote(null);
        }
      } else {
        setQuote(null);
      }
    } finally {
      setLoading(false);
    }
  }, [applyBuyerFromCompany, applyAmountAndPeriod, onClose, onOpenCombined, billingMonth, billingYear]);

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

  const initFromOrderRef = useRef(initFromOrder);
  initFromOrderRef.current = initFromOrder;

  useEffect(() => {
    if (isOpen && order) {
      void initFromOrderRef.current(order, initialInvoice);
    }
  }, [isOpen, order?.id, billingMonth, billingYear, initialInvoice?.id]);

  useEffect(() => {
    if (!companySearch.trim()) {
      setCompanyResults([]);
      return;
    }
    const t = setTimeout(() => {
      void BillingCompanyService.search(companySearch).then(setCompanyResults);
    }, 250);
    return () => clearTimeout(t);
  }, [companySearch]);

  const handleBuyerSourceChange = async (source: BuyerSource) => {
    if (!order) return;
    setBuyerSource(source);

    if (source === 'agency') {
      const match = await BillingCompanyService.findBestMatch(order.agency);
      if (match) applyBuyerFromCompany(match);
      else setBuyer({ name: order.agency || '', company_code: '', vat_code: '', address: '' });
    } else if (source === 'client') {
      const match = await BillingCompanyService.findBestMatch(order.client);
      if (match) applyBuyerFromCompany(match);
      else setBuyer({ name: order.client || '', company_code: '', vat_code: '', address: '' });
    } else if (source === 'manual') {
      setBuyer(emptyBuyer());
    }
  };

  const handleAmountModeChange = (mode: InvoiceAmountMode) => {
    if (!order || billingScopeLocked) return;
    setAmountMode(mode);
    if (mode === 'monthly' && isMultiMonthOrder(order)) {
      const key =
        selectedBillingMonthKey ?? resolveDefaultBillingMonthKey(order, billingMonth, billingYear, billingPeriods);
      if (key) {
        applyBillingMonth(order, key, buyer.name);
        return;
      }
    }
    applyAmountAndPeriod(order, invoiceDate, mode, buyer.name);
  };

  const persistInvoice = async () => {
    if (!order) return;

    if (saveCompanyToDb && buyer.name.trim()) {
      await BillingCompanyService.create({
        name: buyer.name.trim(),
        full_name: buyer.name.trim(),
        company_code: buyer.company_code || null,
        vat_code: buyer.vat_code || null,
        address: buyer.address || null,
      });
    }

    if (standalone) {
      const filteredLines = standaloneLines.filter(
        (line) => line.description.trim() || line.amount > 0
      );
      if (filteredLines.length === 0) {
        throw new Error('Pridėkite bent vieną eilutę su aprašymu arba suma.');
      }

      const totals = computeInvoiceTotals(
        filteredLines.map((line) => line.amount),
        vatRate
      );
      const lineInputs: InvoiceLineInput[] = filteredLines.map((line, index) => ({
        order_id: order.id,
        line_description: line.description.trim() || '—',
        period_from: periodFrom || invoiceDate,
        period_to: periodTo || invoiceDate,
        amount: line.amount,
        sort_order: index,
      }));
      const firstLine = lineInputs[0];

      await InvoiceService.saveCombinedInvoice(
        {
          order_id: order.id,
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
          line_description: firstLine.line_description,
          period_from: firstLine.period_from,
          period_to: firstLine.period_to,
        },
        lineInputs,
        savedInvoiceId
      );
      return;
    }

    await InvoiceService.saveInvoice({
      order_id: order.id,
      invoice_number: invoiceNumber,
      amount: invoiceAmount,
      vat_amount: vatAmount,
      total_amount: totalWithVat,
      invoice_date: invoiceDate,
      due_date: dueDate,
      buyer_name: buyer.name,
      buyer_company_code: buyer.company_code || null,
      buyer_vat_code: buyer.vat_code || null,
      buyer_address: buyer.address || null,
      line_description: lineDescription,
      period_from: periodFrom || null,
      period_to: periodTo || null,
    });

    if (!isStandaloneInvoiceOrder(order.id)) {
      await InvoiceService.syncLegacyInvoiceStatus(order.id);
    }
  };

  const persistInvoiceAndTrack = async () => {
    if (!order) return;
    await persistInvoice();
    const latest = await InvoiceService.getLatestForOrder(order.id);
    const invoiceId = latest?.id ?? null;
    setSavedInvoiceId(invoiceId);
    if (latest) {
      setSavedInvoicePayment({
        paid_amount: Number(latest.paid_amount ?? 0),
        total_amount: Number(latest.total_amount),
        payment_date: latest.payment_date ?? null,
      });
      setPaymentDate(latest.payment_date ? formatDateOnly(latest.payment_date) : null);
    } else {
      setSavedInvoicePayment(null);
    }

    if (invoiceId && isStandaloneInvoiceOrder(order.id)) {
      if (paymentDate) {
        await InvoiceService.markAsPaid(invoiceId, paymentDate);
      } else {
        await InvoiceService.clearPaymentDate(invoiceId);
      }
    }
  };

  const handleSave = async () => {
    if (!order) return;
    setLoading(true);
    try {
      await persistInvoiceAndTrack();
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('save invoice:', error);
      alert('Nepavyko išsaugoti sąskaitos. Patikrinkite ar Supabase lentelės sukurtos.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!order || !savedInvoiceId) return;
    const confirmed = window.confirm(
      `Ištrinti sąskaitą ${invoiceNumber}?\n\nUžsakymo sąskaitos būsena bus atstatyta. Jei tai paskutinis numeris, jį galima naudoti iš naujo.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await InvoiceService.deleteInvoice(savedInvoiceId);
      if (!isStandaloneInvoiceOrder(order.id)) {
        await InvoiceService.syncLegacyInvoiceStatus(order.id);
      }
      setSavedInvoiceId(null);
      onSaved?.();
      await initFromOrder(order, initialInvoice);
    } catch (error) {
      console.error('delete invoice:', error);
      alert('Nepavyko ištrinti sąskaitos.');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!order || !invoiceRef.current) return;
    setIsGenerating(true);
    setIsEditing(false);
    await new Promise((r) => setTimeout(r, 300));
    try {
      await downloadIssuedInvoicePdfFromElement(invoiceRef.current, {
        invoice_number: invoiceNumber,
        buyer_name: buyer.name || order.client || 'Saskaita',
        invoice_date: invoiceDate,
      });
    } catch (error) {
      console.error('PDF:', error);
      alert('Klaida generuojant PDF');
    } finally {
      setIsGenerating(false);
      setIsEditing(true);
    }
  };

  if (!isOpen || !order) return null;

  const buyerSourceOptions: [BuyerSource, string][] = standalone
    ? [
        ['saved', 'Ieškoti įmonių'],
        ['manual', 'Įvesti ranka'],
      ]
    : [
        ['agency', 'Agentūra iš užsakymo'],
        ['client', 'Klientas iš užsakymo'],
        ['saved', 'Ieškoti įmonių'],
        ['manual', 'Įvesti ranka'],
      ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {standalone ? 'Laisva sąskaita' : 'Sąskaitos peržiūra'}
            </h2>
            {quote && !standalone && (
              <button
                type="button"
                onClick={() => {
                  const url = order.viaduct ? quote.viaduct_link : quote.link;
                  window.open(url, '_blank');
                }}
                className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                title="Atidaryti skaičiuoklę"
              >
                🔗
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {savedInvoiceId && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={loading || isGenerating}
                className={modalBtnDanger}
              >
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
            <div className="space-y-2 text-sm">
              {buyerSourceOptions.map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="buyerSource"
                    checked={buyerSource === value}
                    onChange={() => void handleBuyerSourceChange(value)}
                  />
                  <span className="text-gray-700 dark:text-gray-300">{label}</span>
                </label>
              ))}
            </div>

            {buyerSource === 'saved' && (
              <div className="mt-3">
                <input
                  type="text"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  placeholder="Ieškoti įmonės..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                />
                {companyResults.length > 0 && (
                  <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    {companyResults.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => {
                            applyBuyerFromCompany(c);
                            setCompanySearch(c.full_name);
                            setCompanyResults([]);
                          }}
                        >
                          <div className="font-medium">{c.full_name}</div>
                          {c.company_code && (
                            <div className="text-xs text-gray-500">Įm. kodas {c.company_code}</div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-4 space-y-2">
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
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                  />
                </div>
              ))}
            </div>

            {standalone && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Eilutės ({standaloneLines.length})
                  </label>
                  {standaloneLinesEditable && (
                    <button
                      type="button"
                      onClick={addStandaloneLine}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40"
                    >
                      <PlusCircleIcon className="h-4 w-4" />
                      Eilutė
                    </button>
                  )}
                </div>
                {standaloneLines.map((line, index) => (
                  <div
                    key={line.key}
                    className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Eilutė {index + 1}
                      </span>
                      {standaloneLinesEditable && standaloneLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStandaloneLine(line.key)}
                          className="text-xs text-red-600 hover:underline dark:text-red-400"
                        >
                          Šalinti
                        </button>
                      )}
                    </div>
                    <textarea
                      value={line.description}
                      onChange={(e) => updateStandaloneLine(line.key, { description: e.target.value })}
                      rows={3}
                      disabled={!standaloneLinesEditable}
                      className="mb-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900"
                      placeholder="Paslaugos aprašymas…"
                    />
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                      Suma be PVM (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.amount || ''}
                      onChange={(e) =>
                        updateStandaloneLine(line.key, { amount: parseFloat(e.target.value) || 0 })
                      }
                      disabled={!standaloneLinesEditable}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                ))}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Iš viso be PVM:{' '}
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {formatEuro(standaloneLinesTotal)}
                  </span>
                </p>
              </div>
            )}

            {savedInvoiceId && savedInvoicePayment && (
              <div className="mt-4">
                <InvoicePartialPaymentNotice invoice={savedInvoicePayment} />
              </div>
            )}

            {standalone && savedInvoiceId && (
              <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                  Apmokėjimas
                </h3>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Apmokėjimo data
                </label>
                <input
                  type="date"
                  value={paymentDate ?? ''}
                  onChange={(e) =>
                    setPaymentDate(e.target.value ? formatDateOnly(e.target.value) : null)
                  }
                  className="mb-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentDate(formatInvoiceDate(new Date()))}
                    className="rounded-md px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40"
                  >
                    Pažymėti šiandien
                  </button>
                  {paymentDate && (
                    <button
                      type="button"
                      onClick={() => setPaymentDate(null)}
                      className="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Nuimti
                    </button>
                  )}
                </div>
              </div>
            )}

            {buyerSource === 'manual' && (
              <label className="mt-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={saveCompanyToDb}
                  onChange={(e) => setSaveCompanyToDb(e.target.checked)}
                />
                Išsaugoti į įmonių sąrašą
              </label>
            )}

            {order && isMultiMonthOrder(order) && !standalone && (
              <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
                <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Suma</h3>
                <div className="space-y-2 text-sm">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Sąskaitavimo mėnuo
                    </p>
                    {billingMonthOptions.map((option) => (
                      <label
                        key={option.key}
                        className={`flex items-start gap-2 ${
                          billingScopeLocked ? 'cursor-default opacity-60' : 'cursor-pointer'
                        }`}
                      >
                        <input
                          type="radio"
                          name="billingMonth"
                          checked={
                            amountMode === 'monthly' && selectedBillingMonthKey === option.key
                          }
                          disabled={billingScopeLocked}
                          onChange={() => {
                            if (billingScopeLocked) return;
                            setAmountMode('monthly');
                            applyBillingMonth(order, option.key, buyer.name);
                          }}
                          className="mt-0.5"
                        />
                        <span className="text-gray-700 dark:text-gray-300">
                          {option.year} m. {getMonthFilterLabel(option.month)}
                          <span className="mt-0.5 block text-xs text-gray-500">
                            {formatEuro(option.amount)}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <label
                    className={`flex items-start gap-2 ${
                      billingScopeLocked ? 'cursor-default opacity-60' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="amountMode"
                      checked={amountMode === 'full'}
                      disabled={billingScopeLocked}
                      onChange={() => handleAmountModeChange('full')}
                      className="mt-0.5"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      Visa kampanija
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {formatEuro(order.final_price)} · {formatDateOnly(order.from)} –{' '}
                        {formatDateOnly(order.to)}
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {showOwexxDiscount && (
              <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
                <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                  Nuolaida
                </h3>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={owexxDiscount50}
                    onChange={(e) => handleOwexxDiscountToggle(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    50% nuolaida (Owexx)
                    {owexxDiscount50 && baseAmount > 0 && (
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {formatEuro(baseAmount)} → {formatEuro(amount)}
                      </span>
                    )}
                  </span>
                </label>
              </div>
            )}
          </aside>

          <div className="overflow-y-auto p-4">
            {loading ? (
              <div className="py-12 text-center text-gray-500">Kraunama...</div>
            ) : (
              <div ref={invoiceRef} className="mx-auto w-full max-w-4xl">
                <InvoiceDocumentView
                  locale={invoiceLocale}
                  isGenerating={isGenerating}
                  invoiceNumber={invoiceNumber}
                  invoiceDate={invoiceDate}
                  dueDate={dueDate}
                  buyer={buyer}
                  amount={invoiceAmount}
                  vatAmount={vatAmount}
                  totalWithVat={totalWithVat}
                  vatPercent={vatPercent}
                  isEditing={isEditing}
                  lines={standalone ? standaloneDocumentLines : undefined}
                  showDiscountNote={!!showOwexxDiscount && owexxDiscount50}
                  discountPercent={OWEXX_CLIENT_DISCOUNT_PERCENT}
                  onInvoiceNumberChange={setInvoiceNumber}
                  onInvoiceDateChange={(next) => {
                    const formatted = formatDateOnly(next);
                    setInvoiceDate(formatted);
                    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted) && amountMode === 'monthly' && order) {
                      const key = billingMonthKeyFromDate(formatted);
                      if (
                        key &&
                        getBillingMonthOptions(order, billingPeriods).some((entry) => entry.key === key)
                      ) {
                        setSelectedBillingMonthKey(key);
                      }
                      applyAmountAndPeriod(order, formatted, 'monthly', buyer.name);
                    }
                  }}
                  onDueDateChange={(next) => setDueDate(formatDateOnly(next))}
                  onAmountChange={
                    standalone
                      ? undefined
                      : (next) => {
                          setAmount(next);
                          setBaseAmount(
                            owexxDiscount50 && showOwexxDiscount
                              ? Math.round((next / (1 - OWEXX_CLIENT_DISCOUNT_PERCENT / 100)) * 100) /
                                100
                              : next
                          );
                        }
                  }
                  onLineAmountChange={
                    standalone && standaloneLinesEditable
                      ? (key, value) => updateStandaloneLine(key, { amount: value })
                      : undefined
                  }
                  lineDescription={
                    standalone ? undefined : isEditing && order ? (
                      <div className="font-normal">
                        {invoiceLabels.linePrefix} (
                        <strong className="font-extrabold">{order.client}</strong>, U-
                        {order.invoice_id}){' '}
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="yyyy-mm-dd"
                            value={periodFrom}
                            onChange={(e) => updateInvoicePeriod(e.target.value, periodTo)}
                            className="w-[6.5rem] border-b border-gray-200 bg-transparent outline-none"
                          />
                          <span>-</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="yyyy-mm-dd"
                            value={periodTo}
                            onChange={(e) => updateInvoicePeriod(periodFrom, e.target.value)}
                            className="w-[6.5rem] border-b border-gray-200 bg-transparent outline-none"
                          />
                        </span>
                      </div>
                    ) : order ? (
                      <InvoiceLineDescription
                        text={
                          lineDescription ||
                          buildLineDescription(order, periodFrom, periodTo, invoiceLocale)
                        }
                        locale={invoiceLocale}
                      />
                    ) : (
                      '—'
                    )
                  }
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {savedInvoiceId && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={loading || isGenerating}
                className={modalBtnDanger}
              >
                Ištrinti
              </button>
            )}
            <p className="text-sm text-gray-500">
              {standalone
                ? 'Laisva sąskaita'
                : `Užsakymas U-${order.invoice_id} · ${formatDateOnly(order.from)} – ${formatDateOnly(order.to)}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={modalBtnSecondary}>
              Atšaukti
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading || !buyer.name.trim()}
              className={modalBtnPrimary}
            >
              {loading ? 'Saugoma...' : 'Išsaugoti'}
            </button>
            <button
              type="button"
              onClick={() => void generatePDF()}
              disabled={isGenerating}
              className={`${modalBtnPrimary} inline-flex items-center gap-2`}
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              {isGenerating ? 'Generuojama...' : 'PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
