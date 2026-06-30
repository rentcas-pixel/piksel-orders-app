'use client';

import { useCallback, useEffect, useState } from 'react';
import { XMarkIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import type { ReceivedInvoice, ReceivedInvoiceInput } from '@/types';
import { BillingCompanyService } from '@/lib/billing-company-service';
import {
  addDays,
  formatDateOnly,
  formatInvoiceDate,
  VAT_RATE,
} from '@/lib/invoice-utils';
import {
  computeReceivedInvoiceTotals,
  EXPENSE_CATEGORIES,
  formatReceivedInvoiceAmount,
  INVOICE_CURRENCIES,
  ReceivedInvoiceService,
} from '@/lib/received-invoice-service';
import type { MistralReceivedInvoiceExtraction } from '@/lib/mistral-received-invoice-ocr';
import { downloadReceivedInvoiceFile } from '@/lib/received-invoice-file';
import { modalBtnDanger, modalBtnPrimary, modalBtnSecondary } from '@/lib/portal-ui';

interface ReceivedInvoiceModalProps {
  invoice: ReceivedInvoice | null;
  isOpen: boolean;
  isNew: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onOpenExisting?: (invoice: ReceivedInvoice) => void;
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white';

function emptyForm(): ReceivedInvoiceInput {
  const today = formatInvoiceDate(new Date());
  return {
    invoice_number: '',
    seller_name: '',
    seller_company_code: '',
    seller_vat_code: '',
    seller_address: '',
    amount: 0,
    vat_amount: 0,
    total_amount: 0,
    currency: 'EUR',
    invoice_date: today,
    due_date: addDays(today, 30),
    payment_date: null,
    category: 'kita',
    description: '',
    file_url: null,
    file_name: null,
    notes: '',
  };
}

function invoiceToForm(invoice: ReceivedInvoice): ReceivedInvoiceInput {
  return {
    invoice_number: invoice.invoice_number ?? '',
    seller_name: invoice.seller_name,
    seller_company_code: invoice.seller_company_code ?? '',
    seller_vat_code: invoice.seller_vat_code ?? '',
    seller_address: invoice.seller_address ?? '',
    amount: Number(invoice.amount),
    vat_amount: Number(invoice.vat_amount),
    total_amount: Number(invoice.total_amount),
    currency: invoice.currency || 'EUR',
    invoice_date: formatDateOnly(invoice.invoice_date),
    due_date: invoice.due_date ? formatDateOnly(invoice.due_date) : '',
    payment_date: invoice.payment_date ? formatDateOnly(invoice.payment_date) : null,
    category: invoice.category ?? 'kita',
    description: invoice.description ?? '',
    file_url: invoice.file_url ?? null,
    file_name: invoice.file_name ?? null,
    notes: invoice.notes ?? '',
  };
}

export function ReceivedInvoiceModal({
  invoice,
  isOpen,
  isNew,
  onClose,
  onSaved,
  onOpenExisting,
}: ReceivedInvoiceModalProps) {
  const [form, setForm] = useState<ReceivedInvoiceInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [companyResults, setCompanyResults] = useState<
    Awaited<ReturnType<typeof BillingCompanyService.search>>
  >([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [duplicateInvoice, setDuplicateInvoice] = useState<ReceivedInvoice | null>(null);
  const [paymentCleared, setPaymentCleared] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (invoice && !isNew) {
      setForm(invoiceToForm(invoice));
      setCompanySearch(invoice.seller_name);
    } else {
      setForm(emptyForm());
      setCompanySearch('');
    }
    setPendingFile(null);
    setScanning(false);
    setDownloading(false);
    setDuplicateInvoice(null);
    setPaymentCleared(false);
  }, [isOpen, invoice, isNew]);

  const refreshDuplicateCheck = useCallback(
    async (input: Pick<
      ReceivedInvoiceInput,
      'seller_name' | 'seller_company_code' | 'seller_vat_code' | 'invoice_number'
    >) => {
      if (!isNew) {
        setDuplicateInvoice(null);
        return;
      }
      const duplicate = await ReceivedInvoiceService.findDuplicate(input);
      setDuplicateInvoice(duplicate);
    },
    [isNew]
  );

  useEffect(() => {
    if (!isOpen || !isNew) return;
    const timer = setTimeout(() => {
      void refreshDuplicateCheck({
        seller_name: form.seller_name,
        seller_company_code: form.seller_company_code,
        seller_vat_code: form.seller_vat_code,
        invoice_number: form.invoice_number,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [
    isOpen,
    isNew,
    form.seller_name,
    form.seller_company_code,
    form.seller_vat_code,
    form.invoice_number,
    refreshDuplicateCheck,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!companySearch.trim()) {
      setCompanyResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void BillingCompanyService.search(companySearch).then(setCompanyResults);
    }, 300);
    return () => clearTimeout(timer);
  }, [companySearch]);

  const updateAmount = useCallback((amount: number) => {
    setForm((prev) => {
      const currency = (prev.currency || 'EUR').toUpperCase();
      if (currency !== 'EUR') {
        const rounded = Math.round(amount * 100) / 100;
        return { ...prev, amount: rounded, vat_amount: 0, total_amount: rounded };
      }
      return { ...prev, ...computeReceivedInvoiceTotals(amount) };
    });
  }, []);

  const updateCurrency = useCallback((currency: string) => {
    setForm((prev) => {
      const next = { ...prev, currency };
      if (currency !== 'EUR' && prev.amount > 0) {
        const rounded = Math.round(prev.amount * 100) / 100;
        return { ...next, vat_amount: 0, total_amount: rounded };
      }
      if (currency === 'EUR' && prev.amount > 0) {
        return { ...next, ...computeReceivedInvoiceTotals(prev.amount) };
      }
      return next;
    });
  }, []);

  const updateField = <K extends keyof ReceivedInvoiceInput>(
    key: K,
    value: ReceivedInvoiceInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyOcrExtraction = useCallback((data: MistralReceivedInvoiceExtraction) => {
    setCompanySearch(data.seller_name);
    setForm((prev) => {
      const currency = (data.currency || prev.currency || 'EUR').toUpperCase();
      let amount = prev.amount;
      let vat_amount = prev.vat_amount;
      let total_amount = prev.total_amount;

      if (currency !== 'EUR') {
        amount = data.amount && data.amount > 0 ? data.amount : data.total_amount ?? 0;
        vat_amount = 0;
        total_amount = data.total_amount && data.total_amount > 0 ? data.total_amount : amount;
      } else if (data.amount && data.amount > 0) {
        const totals = computeReceivedInvoiceTotals(data.amount);
        amount = totals.amount;
        vat_amount = data.vat_amount && data.vat_amount > 0 ? data.vat_amount : totals.vat_amount;
        total_amount = data.total_amount && data.total_amount > 0 ? data.total_amount : totals.total_amount;
      } else if (data.total_amount && data.total_amount > 0) {
        const derived = computeReceivedInvoiceTotals(
          Math.round((data.total_amount / 1.21) * 100) / 100
        );
        amount = derived.amount;
        vat_amount = data.vat_amount && data.vat_amount > 0 ? data.vat_amount : derived.vat_amount;
        total_amount = data.total_amount;
      }

      return {
        ...prev,
        seller_name: data.seller_name,
        seller_company_code: data.seller_company_code ?? prev.seller_company_code,
        seller_vat_code: data.seller_vat_code ?? prev.seller_vat_code,
        seller_address: data.seller_address ?? prev.seller_address,
        invoice_number: data.invoice_number ?? prev.invoice_number,
        invoice_date: data.invoice_date ?? prev.invoice_date,
        due_date: data.due_date ?? prev.due_date,
        description: data.description ?? prev.description,
        currency,
        amount,
        vat_amount,
        total_amount,
      };
    });
  }, []);

  const handleScanOcr = async () => {
    if (!pendingFile) {
      alert('Pirmiausia pasirinkite PDF arba nuotrauką.');
      return;
    }

    setScanning(true);
    try {
      const formData = new FormData();
      formData.append('file', pendingFile);

      const response = await fetch('/api/ocr/received-invoice', {
        method: 'POST',
        body: formData,
      });

      const payload = (await response.json()) as {
        data?: MistralReceivedInvoiceExtraction;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'OCR klaida');
      }

      if (!payload.data) {
        throw new Error('Tuščias OCR atsakymas');
      }

      applyOcrExtraction(payload.data);
      await refreshDuplicateCheck({
        seller_name: payload.data.seller_name,
        seller_company_code: payload.data.seller_company_code,
        seller_vat_code: payload.data.seller_vat_code,
        invoice_number: payload.data.invoice_number,
      });
    } catch (error) {
      console.error('OCR scan:', error);
      alert(error instanceof Error ? error.message : 'Nepavyko nuskaityti sąskaitos.');
    } finally {
      setScanning(false);
    }
  };

  const buildPayload = (): ReceivedInvoiceInput & { clear_payment?: boolean } => ({
    ...form,
    invoice_number: form.invoice_number?.trim() || null,
    seller_company_code: form.seller_company_code?.trim() || null,
    seller_vat_code: form.seller_vat_code?.trim() || null,
    seller_address: form.seller_address?.trim() || null,
    due_date: form.due_date?.trim() || null,
    payment_date: form.payment_date || null,
    clear_payment: paymentCleared && !form.payment_date,
    description: form.description?.trim() || null,
    notes: form.notes?.trim() || null,
    category: form.category || null,
    currency: (form.currency || 'EUR').toUpperCase(),
  });

  const applyPaymentState = async (targetId: string, payload: ReturnType<typeof buildPayload>) => {
    if (payload.payment_date) {
      await ReceivedInvoiceService.markAsPaid(targetId, payload.payment_date);
      return;
    }
    if (payload.clear_payment) {
      await ReceivedInvoiceService.clearPaymentDate(targetId);
    }
  };

  const persistInvoice = async (targetId: string, payload: ReceivedInvoiceInput) => {
    let saved = await ReceivedInvoiceService.update(targetId, payload);

    if (pendingFile) {
      const uploaded = await ReceivedInvoiceService.uploadFile(saved.id, pendingFile);
      saved = await ReceivedInvoiceService.update(saved.id, {
        ...payload,
        file_url: uploaded.file_url,
        file_name: uploaded.file_name,
      });
    }

    return saved;
  };

  const handleDownloadFile = async () => {
    if (!form.file_url) return;
    setDownloading(true);
    try {
      await downloadReceivedInvoiceFile({
        id: invoice?.id ?? '',
        file_url: form.file_url,
        file_name: form.file_name,
        seller_name: form.seller_name,
        invoice_number: form.invoice_number,
        invoice_date: form.invoice_date,
      });
    } catch (error) {
      console.error('Download received invoice:', error);
      alert(error instanceof Error ? error.message : 'Nepavyko atsisiųsti failo.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = async () => {
    if (!form.seller_name.trim()) {
      alert('Įveskite tiekėjo pavadinimą.');
      return;
    }
    if (!form.invoice_date) {
      alert('Įveskite sąskaitos datą.');
      return;
    }
    if (form.amount <= 0) {
      alert('Suma turi būti didesnė už 0.');
      return;
    }

    const duplicate = await ReceivedInvoiceService.findDuplicate(
      {
        seller_name: form.seller_name,
        seller_company_code: form.seller_company_code,
        seller_vat_code: form.seller_vat_code,
        invoice_number: form.invoice_number,
      },
      invoice?.id
    );
    if (duplicate && !isNew) {
      alert(`Tokia sąskaita jau egzistuoja: ${duplicate.seller_name} / ${duplicate.invoice_number}`);
      return;
    }

    let updateExistingId: string | null = null;
    if (duplicate && isNew) {
      const shouldUpdate = confirm(
        `Sąskaita jau įvesta: ${duplicate.seller_name} / ${duplicate.invoice_number}.\n\nAtnaujinti esamą įrašą su šiais duomenimis?`
      );
      if (!shouldUpdate) return;
      updateExistingId = duplicate.id;
    }

    setSaving(true);
    try {
      const payload = buildPayload();

      if (updateExistingId) {
        await persistInvoice(updateExistingId, payload);
        await applyPaymentState(updateExistingId, payload);
      } else if (isNew) {
        let saved = await ReceivedInvoiceService.create(payload);
        if (pendingFile) {
          const uploaded = await ReceivedInvoiceService.uploadFile(saved.id, pendingFile);
          saved = await ReceivedInvoiceService.update(saved.id, {
            ...payload,
            file_url: uploaded.file_url,
            file_name: uploaded.file_name,
          });
        }
        await applyPaymentState(saved.id, payload);
      } else if (invoice) {
        await persistInvoice(invoice.id, payload);
        await applyPaymentState(invoice.id, payload);
      } else {
        return;
      }

      onSaved?.();
      onClose();
    } catch (error) {
      console.error('save received invoice:', error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Nepavyko išsaugoti sąskaitos.';
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice || isNew) return;
    if (!confirm('Ar tikrai norite ištrinti šią gautą sąskaitą?')) return;

    setSaving(true);
    try {
      await ReceivedInvoiceService.delete(invoice.id);
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('delete received invoice:', error);
      alert('Nepavyko ištrinti sąskaitos.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaidToday = () => {
    updateField('payment_date', formatInvoiceDate(new Date()));
    setPaymentCleared(false);
  };

  const handleClearPayment = () => {
    updateField('payment_date', null);
    setPaymentCleared(true);
  };

  if (!isOpen) return null;

  const vatPercent = Math.round(VAT_RATE * 100);
  const today = formatInvoiceDate(new Date());
  const markedPaidToday = form.payment_date === today;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isNew ? 'Nauja gauta sąskaita' : 'Gauta sąskaita'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {duplicateInvoice && isNew && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
              <p>
                Ši sąskaita jau įvesta:{' '}
                <span className="font-medium">
                  {duplicateInvoice.seller_name} / {duplicateInvoice.invoice_number}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {onOpenExisting && (
                  <button
                    type="button"
                    className={modalBtnSecondary}
                    onClick={() => onOpenExisting(duplicateInvoice)}
                  >
                    Atidaryti esamą
                  </button>
                )}
                <span className="self-center text-xs text-amber-800 dark:text-amber-200">
                  Arba išsaugokite — pasiūlysime atnaujinti esamą įrašą.
                </span>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-900/40">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Sąskaitos failas (PDF arba nuotrauka)
            </label>
            {form.file_url && !pendingFile && (
              <div className="mb-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                <span>
                  Esamas failas:{' '}
                  <a
                    href={form.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {form.file_name ?? 'Atidaryti'}
                  </a>
                </span>
                <button
                  type="button"
                  onClick={() => void handleDownloadFile()}
                  disabled={downloading || saving}
                  className={`${modalBtnSecondary} inline-flex items-center gap-1.5 px-2.5 py-1 text-xs`}
                >
                  <DocumentArrowDownIcon className="h-4 w-4" />
                  {downloading ? 'Ruošiama…' : 'Atsisiųsti'}
                </button>
              </div>
            )}
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
              className="text-sm text-gray-600 dark:text-gray-400"
            />
            {pendingFile && (
              <p className="mt-1 text-xs text-gray-500">Pasirinkta: {pendingFile.name}</p>
            )}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => void handleScanOcr()}
                disabled={!pendingFile || scanning || saving}
                className={modalBtnPrimary}
              >
                {scanning ? 'Skaitoma…' : 'Nuskaityti su Mistral OCR'}
              </button>
              <p className="mt-2 text-xs text-gray-500">
                Automatiškai užpildo laukus. Visada peržiūrėkite prieš išsaugant.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tiekėjas *
            </label>
            <input
              type="text"
              value={companySearch}
              onChange={(e) => {
                setCompanySearch(e.target.value);
                updateField('seller_name', e.target.value);
              }}
              placeholder="Ieškoti arba įvesti tiekėją..."
              className={inputClass}
            />
            {companyResults.length > 0 && (
              <ul className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                {companyResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => {
                        setCompanySearch(c.full_name);
                        setCompanyResults([]);
                        setForm((prev) => ({
                          ...prev,
                          seller_name: c.full_name,
                          seller_company_code: c.company_code ?? '',
                          seller_vat_code: c.vat_code ?? '',
                          seller_address: c.address ?? '',
                        }));
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Įmonės kodas
              </label>
              <input
                type="text"
                value={form.seller_company_code ?? ''}
                onChange={(e) => updateField('seller_company_code', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                PVM kodas
              </label>
              <input
                type="text"
                value={form.seller_vat_code ?? ''}
                onChange={(e) => updateField('seller_vat_code', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Adresas
            </label>
            <input
              type="text"
              value={form.seller_address ?? ''}
              onChange={(e) => updateField('seller_address', e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Sąskaitos nr.
              </label>
              <input
                type="text"
                value={form.invoice_number ?? ''}
                onChange={(e) => updateField('invoice_number', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Kategorija
              </label>
              <select
                value={form.category ?? 'kita'}
                onChange={(e) => updateField('category', e.target.value)}
                className={inputClass}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Sąskaitos data *
              </label>
              <input
                type="date"
                value={form.invoice_date}
                onChange={(e) => updateField('invoice_date', formatDateOnly(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Apmokėti iki
              </label>
              <input
                type="date"
                value={form.due_date ?? ''}
                onChange={(e) => updateField('due_date', formatDateOnly(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Apmokėjimo data
              </label>
              <input
                type="date"
                value={form.payment_date ?? ''}
                onChange={(e) => {
                  const value = e.target.value ? formatDateOnly(e.target.value) : null;
                  updateField('payment_date', value);
                  setPaymentCleared(!value);
                }}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleMarkPaidToday}
              className={
                markedPaidToday
                  ? 'px-4 py-2 text-sm font-medium rounded-lg border border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300 transition-colors'
                  : modalBtnSecondary
              }
            >
              Pažymėti apmokėta šiandien
            </button>
            {form.payment_date && (
              <button type="button" onClick={handleClearPayment} className={modalBtnSecondary}>
                Nuimti apmokėjimą
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Valiuta
              </label>
              <select
                value={form.currency ?? 'EUR'}
                onChange={(e) => updateCurrency(e.target.value)}
                className={inputClass}
              >
                {INVOICE_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Suma be PVM *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount || ''}
                onChange={(e) => updateAmount(parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                PVM ({vatPercent}%)
              </label>
              <input
                type="text"
                readOnly
                value={formatReceivedInvoiceAmount(form.vat_amount, form.currency)}
                className={`${inputClass} bg-gray-50 dark:bg-gray-900`}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Su PVM
              </label>
              <input
                type="text"
                readOnly
                value={formatReceivedInvoiceAmount(form.total_amount, form.currency)}
                className={`${inputClass} bg-gray-50 dark:bg-gray-900`}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Aprašymas
            </label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => updateField('description', e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Pastabos
            </label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            {!isNew && invoice && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={saving}
                className={modalBtnDanger}
              >
                Ištrinti
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving} className={modalBtnSecondary}>
              Atšaukti
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className={modalBtnPrimary}
            >
              {saving ? 'Saugoma…' : 'Išsaugoti'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
