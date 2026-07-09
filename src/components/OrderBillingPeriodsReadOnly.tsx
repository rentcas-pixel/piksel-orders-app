'use client';

import { useMemo } from 'react';
import type { Order, OrderBillingPeriod } from '@/types';
import { formatEuro } from '@/lib/invoice-utils';
import {
  getBillableMonthlyDistribution,
  sortBillingPeriods,
} from '@/lib/order-billing-periods';

interface OrderBillingPeriodsReadOnlyProps {
  order: Order;
  periods: OrderBillingPeriod[];
}

function formatPeriodDate(value: string): string {
  if (!value) return '—';
  const datePart = value.split(' ')[0];
  return datePart || value;
}

export function OrderBillingPeriodsReadOnly({
  order,
  periods,
}: OrderBillingPeriodsReadOnlyProps) {
  const sortedPeriods = useMemo(() => sortBillingPeriods(periods), [periods]);

  const preview = useMemo(() => {
    if (!order.from || !order.to || !order.final_price || sortedPeriods.length === 0) {
      return [];
    }
    return getBillableMonthlyDistribution(
      order.from,
      order.to,
      order.final_price,
      sortedPeriods
    );
  }, [order.final_price, order.from, order.to, sortedPeriods]);

  if (!order.from || !order.to || sortedPeriods.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <p className="text-sm font-medium text-gray-900 dark:text-white">
        Aktyvūs kampanijos periodai
      </p>
      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
        Suma paskirstoma pagal aktyvias dienas.
      </p>

      <ul className="mt-3 space-y-1.5">
        {sortedPeriods.map((period, index) => (
          <li
            key={period.id ?? `period-${index}`}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            {formatPeriodDate(period.active_from)} → {formatPeriodDate(period.active_to)}
          </li>
        ))}
      </ul>

      {preview.length > 0 && (
        <div className="mt-3 rounded-md border border-gray-200 bg-white/80 p-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-400">
          <p className="mb-1 font-medium text-gray-800 dark:text-gray-200">
            Sąskaitavimo peržiūra
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
  );
}
