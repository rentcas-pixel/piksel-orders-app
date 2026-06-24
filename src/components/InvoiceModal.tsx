'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DocumentArrowDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { BuyerFields, BuyerSource, Invoice, Order } from '@/types';
import { BillingCompanyService } from '@/lib/billing-company-service';
import { InvoiceService } from '@/lib/invoice-service';
import { buildInvoicePdfFilename, downloadInvoicePdfFromElement } from '@/lib/invoice-pdf';
import { PocketBaseService } from '@/lib/pocketbase';
import { SupabaseService } from '@/lib/supabase-service';
import {
  addDays,
  calculateVat,
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
  type InvoiceAmountMode,
} from '@/lib/invoice-utils';
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

interface InvoiceModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onOpenCombined?: (invoice: Invoice) => void;
}

const emptyBuyer = (): BuyerFields => ({
  name: '',
  company_code: '',
  vat_code: '',
  address: '',
});

export function InvoiceModal({ order, isOpen, onClose, onSaved, onOpenCombined }: InvoiceModalProps) {
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
  const [quote, setQuote] = useState<{ link: string; viaduct_link: string } | null>(null);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);

  const applyAmountAndPeriod = useCallback(
    (o: Order, date: string, mode: InvoiceAmountMode, buyerName = buyer.name) => {
      const resolved = resolveInvoiceAmountAndPeriod(o, date, mode);
      const locale = resolveInvoiceLocale({ buyerName, order: o });
      setBaseAmount(resolved.amount);
      setPeriodFrom(resolved.from);
      setPeriodTo(resolved.to);
      setLineDescription(buildLineDescription(o, resolved.from, resolved.to, locale));
    },
    [buyer.name]
  );

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
  const vatAmount = calculateVat(amount, vatRate);
  const totalWithVat = Math.round((amount + vatAmount) * 100) / 100;
  const vatPercent = vatRate * 100;

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

  const initFromOrder = useCallback(async (o: Order) => {
    setLoading(true);
    setOwexxDiscount50(false);
    setBaseAmount(0);
    try {
      const existing = await InvoiceService.getLatestForOrder(o.id);

      if (existing && (await InvoiceService.hasInvoiceLines(existing.id))) {
        onOpenCombined?.(existing);
        onClose();
        return;
      }

      if (existing) {
        setSavedInvoiceId(existing.id);
        setInvoiceNumber(existing.invoice_number);
        setInvoiceDate(existing.invoice_date);
        setDueDate(existing.due_date);
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
        } else {
          const mode =
            existing.amount === o.final_price && isMultiMonthOrder(o) ? 'full' : 'monthly';
          const resolvedBase = resolveInvoiceAmountAndPeriod(
            o,
            existing.invoice_date,
            mode
          ).amount;
          setBaseAmount(resolvedBase);
          const hadDiscount =
            isOwexxOrder(o) &&
            resolvedBase > 0 &&
            Math.abs(
              existing.amount -
                applyPercentDiscount(resolvedBase, OWEXX_CLIENT_DISCOUNT_PERCENT)
            ) < 0.05;
          setOwexxDiscount50(hadDiscount);
          setAmountMode(mode);
          if (existing.amount === 0 && (o.final_price ?? 0) > 0) {
            const date = mode === 'monthly' ? defaultInvoiceDate() : existing.invoice_date;
            if (mode === 'monthly') {
              setInvoiceDate(date);
              setDueDate(addDays(date, 30));
            }
            applyAmountAndPeriod(o, date, mode);
          }
        }
      } else if (isStandaloneInvoiceOrder(o.id)) {
        setSavedInvoiceId(null);
        const invoiceDay = defaultInvoiceDate();
        setInvoiceDate(invoiceDay);
        setDueDate(addDays(invoiceDay, 30));
        setInvoiceNumber(await InvoiceService.getNextInvoiceNumber());
        setBaseAmount(0);
        setLineDescription('');
        setPeriodFrom(invoiceDay);
        setPeriodTo(invoiceDay);
        setBuyer(emptyBuyer());
        setBuyerSource('saved');
        setAmountMode('monthly');
        setIsEditing(true);
      } else {
        setSavedInvoiceId(null);
        const invoiceDay = defaultInvoiceDate();
        setInvoiceDate(invoiceDay);
        setDueDate(addDays(invoiceDay, 30));
        setInvoiceNumber(await InvoiceService.getNextInvoiceNumber());

        setAmountMode('monthly');
        applyAmountAndPeriod(o, invoiceDay, 'monthly');

        const defaultSource: BuyerSource = o.agency?.trim() ? 'agency' : 'client';
        setBuyerSource(defaultSource);

        const lookupLabel = defaultSource === 'agency' ? o.agency : o.client;
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
  }, [applyBuyerFromCompany, applyAmountAndPeriod, onClose, onOpenCombined]);

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

  useEffect(() => {
    if (isOpen && order) {
      void initFromOrder(order);
    }
  }, [isOpen, order, initFromOrder]);

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
    }
  };

  const handleAmountModeChange = (mode: InvoiceAmountMode) => {
    if (!order) return;
    setAmountMode(mode);
    applyAmountAndPeriod(order, invoiceDate, mode);
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

    await InvoiceService.saveInvoice({
      order_id: order.id,
      invoice_number: invoiceNumber,
      amount,
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
      await SupabaseService.upsertInvoiceStatus(order.id, { invoice_issued: true });
    }
  };

  const persistInvoiceAndTrack = async () => {
    if (!order) return;
    await persistInvoice();
    const latest = await InvoiceService.getLatestForOrder(order.id);
    setSavedInvoiceId(latest?.id ?? null);
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
        await SupabaseService.upsertInvoiceStatus(order.id, {
          invoice_issued: false,
          invoice_sent: false,
        });
      }
      setSavedInvoiceId(null);
      onSaved?.();
      await initFromOrder(order);
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
      await downloadInvoicePdfFromElement(
        invoiceRef.current,
        buildInvoicePdfFilename({
          invoice_number: invoiceNumber,
          buyer_name: buyer.name || order.client || 'Saskaita',
          invoice_date: invoiceDate,
        }),
        { keepInPlace: true }
      );
    } catch (error) {
      console.error('PDF:', error);
      alert('Klaida generuojant PDF');
    } finally {
      setIsGenerating(false);
      setIsEditing(true);
    }
  };

  if (!isOpen || !order) return null;

  const standalone = isStandaloneInvoiceOrder(order.id);
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
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Eilutės aprašymas
                </label>
                <textarea
                  value={lineDescription}
                  onChange={(e) => setLineDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                  placeholder="Paslaugos aprašymas sąskaitoje…"
                />
              </div>
            )}

            {standalone && (
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Suma be PVM (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={baseAmount || ''}
                  onChange={(e) => setBaseAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                />
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
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="amountMode"
                      checked={amountMode === 'monthly'}
                      onChange={() => handleAmountModeChange('monthly')}
                    />
                    <span className="text-gray-700 dark:text-gray-300">Einamas mėnuo</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="radio"
                      name="amountMode"
                      checked={amountMode === 'full'}
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
                  amount={amount}
                  vatAmount={vatAmount}
                  totalWithVat={totalWithVat}
                  vatPercent={vatPercent}
                  isEditing={isEditing}
                  showDiscountNote={!!showOwexxDiscount && owexxDiscount50}
                  discountPercent={OWEXX_CLIENT_DISCOUNT_PERCENT}
                  onInvoiceNumberChange={setInvoiceNumber}
                  onInvoiceDateChange={(next) => {
                    const formatted = formatDateOnly(next);
                    setInvoiceDate(formatted);
                    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted) && amountMode === 'monthly' && order) {
                      applyAmountAndPeriod(order, formatted, 'monthly');
                    }
                  }}
                  onDueDateChange={(next) => setDueDate(formatDateOnly(next))}
                  onAmountChange={(next) => {
                    setAmount(next);
                    setBaseAmount(
                      owexxDiscount50 && showOwexxDiscount
                        ? Math.round((next / (1 - OWEXX_CLIENT_DISCOUNT_PERCENT / 100)) * 100) / 100
                        : next
                    );
                  }}
                  lineDescription={
                    standalone ? (
                      <div className="whitespace-pre-wrap font-normal">
                        {isEditing ? (
                          <textarea
                            value={lineDescription}
                            onChange={(e) => setLineDescription(e.target.value)}
                            rows={3}
                            className="w-full border border-gray-200 bg-transparent p-1 outline-none"
                          />
                        ) : (
                          lineDescription || '—'
                        )}
                      </div>
                    ) : isEditing && order ? (
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
