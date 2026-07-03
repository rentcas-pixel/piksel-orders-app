'use client';

import { useMemo } from 'react';
import { PlusCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { Order, OrderBillingPeriod } from '@/types';
import { formatDateInputValue } from '@/lib/date-utils';
import { formatEuro } from '@/lib/invoice-utils';
import {
  getBillableMonthlyDistribution,
  sortBillingPeriods,
  validateBillingPeriods,
} from '@/lib/order-billing-periods';

export interface OrderBillingPeriodsSectionProps {
  order: Order;
  enabled: boolean;
  periods: OrderBillingPeriod[];
  onEnabledChange: (enabled: boolean) => void;
  onPeriodsChange: (periods: OrderBillingPeriod[]) => void;
}

function createEmptyPeriod(): OrderBillingPeriod {
  return { active_from: '', active_to: '' };
}

export function OrderBillingPeriodsSection({
  order,
  enabled,
  periods,
  onEnabledChange,
  onPeriodsChange,
}: OrderBillingPeriodsSectionProps) {
  const sortedPeriods = useMemo(() => sortBillingPeriods(periods), [periods]);

  const preview = useMemo(() => {
    if (!order.from || !order.to || !order.final_price || !enabled || periods.length === 0) {
      return [];
    }
    return getBillableMonthlyDistribution(order.from, order.to, order.final_price, periods);
  }, [enabled, order.final_price, order.from, order.to, periods]);

  const validationError = useMemo(() => {
    if (!enabled || periods.length === 0 || !order.from || !order.to) return null;
    return validateBillingPeriods(periods, order.from, order.to);
  }, [enabled, order.from, order.to, periods]);

  const addPeriod = () => {
    onPeriodsChange([...sortedPeriods, createEmptyPeriod()]);
  };

  const fillFromOrder = () => {
    if (!order.from || !order.to) return;
    onPeriodsChange([
      {
        active_from: formatDateInputValue(order.from),
        active_to: formatDateInputValue(order.to),
      },
    ]);
  };

  const updatePeriod = (index: number, field: 'active_from' | 'active_to', value: string) => {
    onPeriodsChange(
      sortedPeriods.map((period, periodIndex) =>
        periodIndex === index ? { ...period, [field]: formatDateInputValue(value) } : period
      )
    );
  };

  const removePeriod = (index: number) => {
    onPeriodsChange(sortedPeriods.filter((_, periodIndex) => periodIndex !== index));
  };

  if (!order.from || !order.to) {
    return null;
  }

  return (
    <div className="mt-6 rounded-lg border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium text-gray-900 dark:text-white">
            Aktyvūs kampanijos periodai
          </span>
          <span className="mt-1 block text-xs text-gray-600 dark:text-gray-400">
            Nurodykite datas, kai kampanija aktyvi ir sąskaita išrašoma. Suma paskirstoma
            automatiškai pagal aktyvias dienas.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fillFromOrder}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              Visas užsakymo periodas
            </button>
            <button
              type="button"
              onClick={addPeriod}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              <PlusCircleIcon className="h-4 w-4" />
              Pridėti periodą
            </button>
          </div>

          {sortedPeriods.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Pridėkite bent vieną aktyvų periodą arba išjunkite šią parinktį.
            </p>
          ) : (
            <div className="space-y-2">
              {sortedPeriods.map((period, index) => (
                <div
                  key={period.id ?? `period-${index}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
                >
                  <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                    Nuo
                    <input
                      type="text"
                      value={period.active_from}
                      onChange={(e) => updatePeriod(index, 'active_from', e.target.value)}
                      pattern="\d{4}-\d{2}-\d{2}"
                      placeholder="yyyy-mm-dd"
                      className="w-[7.5rem] rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                    Iki
                    <input
                      type="text"
                      value={period.active_to}
                      onChange={(e) => updatePeriod(index, 'active_to', e.target.value)}
                      pattern="\d{4}-\d{2}-\d{2}"
                      placeholder="yyyy-mm-dd"
                      className="w-[7.5rem] rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removePeriod(index)}
                    className="ml-auto rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    aria-label="Šalinti periodą"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {validationError && (
            <p className="text-xs text-red-600 dark:text-red-400">{validationError}</p>
          )}

          {preview.length > 0 && !validationError && (
            <div className="rounded-md border border-gray-200 bg-white/80 p-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-400">
              <p className="mb-1 font-medium text-gray-800 dark:text-gray-200">
                Sąskaitavimo peržiūra (automatinė)
              </p>
              <ul className="space-y-0.5">
                {preview.map((entry) => (
                  <li key={`${entry.year}-${entry.month}`}>
                    {entry.year}-{String(entry.month).padStart(2, '0')}: {entry.days} d. ·{' '}
                    {formatEuro(entry.amount)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
