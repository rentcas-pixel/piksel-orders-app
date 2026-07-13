'use client';

import { IsoDateField } from '@/components/IsoDateField';

interface InvoiceDateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onChange: (dateFrom: string, dateTo: string) => void;
}

export function InvoiceDateRangeFilter({ dateFrom, dateTo, onChange }: InvoiceDateRangeFilterProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Laikotarpis</span>
      <div className="flex flex-wrap items-center gap-2">
        <IsoDateField
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(value) => onChange(value, dateTo)}
        />
        <span className="text-sm text-gray-400">—</span>
        <IsoDateField
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(value) => onChange(dateFrom, value)}
        />
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => onChange('', '')}
            className="text-xs text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Išvalyti
          </button>
        )}
      </div>
    </div>
  );
}
