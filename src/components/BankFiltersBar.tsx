'use client';

import { FilterTabGroup } from '@/components/FilterTabGroup';
import { MonthTabNavigator } from '@/components/MonthTabNavigator';
import { yearTabs } from '@/lib/filter-options';

interface BankFiltersBarProps {
  month: string;
  year: string;
  onMonthYearChange: (month: string, year: string) => void;
}

export function BankFiltersBar({ month, year, onMonthYearChange }: BankFiltersBarProps) {
  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5">
        <MonthTabNavigator month={month} year={year || '2026'} onChange={onMonthYearChange} />
        <FilterTabGroup
          label="Metai"
          value={year || '2026'}
          options={yearTabs}
          onChange={(v) => onMonthYearChange(month, v)}
        />
      </div>
    </div>
  );
}
