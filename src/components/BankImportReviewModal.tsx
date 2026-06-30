'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  computeSelectedAllocations,
  countSelectedSuggestions,
  suggestionReasonLabel,
  type BankImportPaymentGroup,
  type BankImportReview,
} from '@/lib/bank-import-suggestions';
import { AMOUNT_TOLERANCE, roundMoney } from '@/lib/payment-allocation';
import { formatEuro } from '@/lib/invoice-utils';
import { modalBtnPrimary, modalBtnSecondary } from '@/lib/portal-ui';

interface BankImportReviewModalProps {
  isOpen: boolean;
  fileName: string;
  review: BankImportReview | null;
  applying?: boolean;
  onClose: () => void;
  onConfirm: (review: BankImportReview) => void;
}

function cloneReview(review: BankImportReview): BankImportReview {
  return {
    ...review,
    groups: review.groups.map((group) => ({
      ...group,
      suggestions: group.suggestions.map((line) => ({ ...line })),
    })),
  };
}

function groupTotals(group: BankImportPaymentGroup) {
  const selected = computeSelectedAllocations(group.payment.amount, group.suggestions);
  const allocated = roundMoney(selected.reduce((sum, row) => sum + row.amount, 0));
  const remaining = roundMoney(group.payment.amount - allocated);
  const over = remaining < -AMOUNT_TOLERANCE;
  return { allocated, remaining: Math.max(0, remaining), over, selectedCount: selected.length };
}

function PaymentGroupCard({
  group,
  onToggle,
  onToggleAll,
}: {
  group: BankImportPaymentGroup;
  onToggle: (lineId: string, selected: boolean) => void;
  onToggleAll: (selected: boolean) => void;
}) {
  const totals = groupTotals(group);
  const directionLabel = group.direction === 'income' ? 'Įplauka' : 'Išlaida';
  const hasSuggestions = group.suggestions.length > 0;

  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {directionLabel} · {group.payment.date}
            </p>
            <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
              {group.counterpartyLabel}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Pavedimas: {formatEuro(group.payment.amount)}
            </p>
            {group.payment.description && group.payment.description !== group.counterpartyLabel && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{group.payment.description}</p>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="text-gray-600 dark:text-gray-300">
              Pažymėta: {formatEuro(totals.allocated)}
            </p>
            <p
              className={
                totals.over
                  ? 'font-medium text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400'
              }
            >
              Likutis: {formatEuro(totals.remaining)}
            </p>
          </div>
        </div>
      </div>

      {!hasSuggestions ? (
        <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          Atvirų sąskaitų šiam pavedimui nerasta — importuosime tik pavedimą.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-end gap-2 border-b border-gray-100 px-4 py-2 dark:border-gray-700">
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              onClick={() => onToggleAll(true)}
            >
              Pažymėti visus
            </button>
            <button
              type="button"
              className="text-xs text-gray-500 hover:underline dark:text-gray-400"
              onClick={() => onToggleAll(false)}
            >
              Nuimti visus
            </button>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {group.suggestions.map((line) => {
              const alloc =
                computeSelectedAllocations(group.payment.amount, group.suggestions).find(
                  (row) => row.lineId === line.id
                )?.amount ?? 0;

              return (
                <li key={line.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={line.selected}
                      onChange={(event) => onToggle(line.id, event.target.checked)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {line.invoiceNumber || 'Be nr.'}
                        </span>
                        <span className="tabular-nums text-sm text-gray-700 dark:text-gray-300">
                          {line.selected && alloc > 0
                            ? formatEuro(alloc)
                            : formatEuro(line.balance)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{line.party}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {line.invoiceDate} · {suggestionReasonLabel(line.reason)}
                        {line.selected && alloc > 0 && alloc < line.balance - AMOUNT_TOLERANCE && (
                          <span className="ml-2 text-amber-600 dark:text-amber-400">dalinis</span>
                        )}
                      </p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

export function BankImportReviewModal({
  isOpen,
  fileName,
  review: initialReview,
  applying = false,
  onClose,
  onConfirm,
}: BankImportReviewModalProps) {
  const [review, setReview] = useState<BankImportReview | null>(null);

  useEffect(() => {
    if (isOpen && initialReview) {
      setReview(cloneReview(initialReview));
    }
    if (!isOpen) {
      setReview(null);
    }
  }, [isOpen, initialReview]);

  const activeReview = review ?? initialReview;

  const summary = useMemo(() => {
    if (!activeReview) return null;
    const payments = activeReview.groups.length;
    const withSuggestions = activeReview.groups.filter((g) => g.suggestions.length > 0).length;
    const selected = countSelectedSuggestions(activeReview);
    const hasOver = activeReview.groups.some((g) => groupTotals(g).over);
    return { payments, withSuggestions, selected, hasOver };
  }, [activeReview]);

  const setGroups = useCallback((updater: (groups: BankImportPaymentGroup[]) => BankImportPaymentGroup[]) => {
    setReview((current) => {
      const base = cloneReview(current ?? initialReview!);
      base.groups = updater(base.groups);
      return base;
    });
  }, [initialReview]);

  const handleToggle = (groupKey: string, lineId: string, selected: boolean) => {
    setGroups((groups) =>
      groups.map((group) =>
        group.key !== groupKey
          ? group
          : {
              ...group,
              suggestions: group.suggestions.map((line) =>
                line.id === lineId ? { ...line, selected } : line
              ),
            }
      )
    );
  };

  const handleToggleAll = (groupKey: string, selected: boolean) => {
    setGroups((groups) =>
      groups.map((group) =>
        group.key !== groupKey
          ? group
          : {
              ...group,
              suggestions: group.suggestions.map((line) => ({ ...line, selected })),
            }
      )
    );
  };

  const handleConfirm = () => {
    if (!activeReview) return;
    onConfirm(activeReview);
  };

  if (!isOpen || !activeReview || !summary) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Sudengimo patvirtinimas
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {fileName} · {summary.payments} pavedimai · pažymėta {summary.selected} sąskaitų
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            disabled={applying}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {activeReview.groups.length === 0 ? (
            <p className="text-center text-sm text-gray-500">Naujų pavedimų nerasta.</p>
          ) : (
            activeReview.groups.map((group) => (
              <PaymentGroupCard
                key={group.key}
                group={group}
                onToggle={(lineId, selected) => handleToggle(group.key, lineId, selected)}
                onToggleAll={(selected) => handleToggleAll(group.key, selected)}
              />
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            PIK numeriai iš aprašymo pažymėti automatiškai. Kiti — tik jei norite.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={modalBtnSecondary} disabled={applying}>
              Atšaukti
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={modalBtnPrimary}
              disabled={applying || summary.hasOver}
            >
              {applying ? 'Importuojama…' : 'Importuoti ir sudengti'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
