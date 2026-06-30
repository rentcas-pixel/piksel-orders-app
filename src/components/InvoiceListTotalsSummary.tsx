'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { formatEuro } from '@/lib/invoice-utils';

interface InvoiceListTotalsSummaryProps {
  countLabel: string;
  fileCount?: number;
  amountExVat: number;
  vat: number;
  totalWithVat: number;
  formatAmountExVat?: (amount: number) => string;
}

export function InvoiceListTotalsSummary({
  countLabel,
  fileCount,
  amountExVat,
  vat,
  totalWithVat,
  formatAmountExVat = formatEuro,
}: InvoiceListTotalsSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
      <span className="text-gray-700 dark:text-gray-300">
        {countLabel}
        {fileCount != null && fileCount > 0 ? ` · su failu ${fileCount}` : ''}
      </span>
      <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums">
        <span className="inline-flex items-baseline gap-1.5">
          <span>Be PVM:</span>
          <span className="text-base font-semibold text-gray-900 dark:text-white">
            {formatAmountExVat(amountExVat)}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex items-center rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
          aria-expanded={expanded}
          aria-label={expanded ? 'Slėpti PVM sumas' : 'Rodyti PVM sumas'}
        >
          {expanded ? (
            <ChevronUpIcon className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronDownIcon className="h-4 w-4" aria-hidden />
          )}
        </button>
        {expanded ? (
          <>
            <span>
              PVM:{' '}
              <span className="font-medium text-gray-900 dark:text-white">{formatEuro(vat)}</span>
            </span>
            <span>
              Su PVM:{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {formatEuro(totalWithVat)}
              </span>
            </span>
          </>
        ) : null}
      </span>
    </div>
  );
}
