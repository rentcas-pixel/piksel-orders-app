'use client';

import { formatEuro } from '@/lib/invoice-utils';

interface BankListTotalsSummaryProps {
  countLabel: string;
  amountLabel: string;
  total: number;
}

export function BankListTotalsSummary({
  countLabel,
  amountLabel,
  total,
}: BankListTotalsSummaryProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
      <span className="text-gray-700 dark:text-gray-300">{countLabel}</span>
      <span className="inline-flex items-baseline gap-1.5 tabular-nums">
        <span>{amountLabel}:</span>
        <span className="text-base font-semibold text-gray-900 dark:text-white">
          {formatEuro(total)}
        </span>
      </span>
    </div>
  );
}
