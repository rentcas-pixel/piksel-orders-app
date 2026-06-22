'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { monthFilterOptions, yearTabs } from '@/lib/filter-options';
import { normalizeFilterMonth } from '@/lib/orders-filters';
import {
  filterPillActiveClass,
  filterPillGroupClass,
  filterPillInactiveClass,
} from '@/lib/portal-ui';

interface MonthTabNavigatorProps {
  month: string;
  year: string;
  onChange: (month: string, year: string) => void;
}

function padMonth(month: number): string {
  return String(month).padStart(2, '0');
}

function monthLabel(month: number): string {
  return monthFilterOptions[month - 1]?.label ?? String(month);
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const allowedYears = yearTabs.map((y) => y.value);

const arrowBtnClass =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors';

export function MonthTabNavigator({ month, year, onChange }: MonthTabNavigatorProps) {
  const selectedMonth = parseInt(normalizeFilterMonth(month), 10);
  const selectedYear = parseInt(year, 10) || new Date().getFullYear();

  const prev = shiftMonth(selectedYear, selectedMonth, -1);
  const next = shiftMonth(selectedYear, selectedMonth, 1);

  const canGoPrev = allowedYears.includes(String(prev.year));
  const canGoNext = allowedYears.includes(String(next.year));

  const visibleTabs = [
    { month: prev.month, year: prev.year },
    { month: selectedMonth, year: selectedYear },
    { month: next.month, year: next.year },
  ];

  const select = (m: number, y: number) => {
    if (!allowedYears.includes(String(y))) return;
    onChange(padMonth(m), String(y));
  };

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Mėnuo
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Ankstesnis mėnuo"
          disabled={!canGoPrev}
          onClick={() => select(prev.month, prev.year)}
          className={arrowBtnClass}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>

        <div className={filterPillGroupClass} role="tablist" aria-label="Mėnuo">
          {visibleTabs.map((tab) => {
            const active = tab.month === selectedMonth && tab.year === selectedYear;
            const enabled = allowedYears.includes(String(tab.year));
            return (
              <button
                key={`${tab.year}-${tab.month}`}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={!enabled}
                onClick={() => select(tab.month, tab.year)}
                className={`rounded-md px-3 py-2 text-sm transition-all whitespace-nowrap disabled:opacity-40 ${
                  active ? filterPillActiveClass : filterPillInactiveClass
                }`}
              >
                {monthLabel(tab.month)}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Kitas mėnuo"
          disabled={!canGoNext}
          onClick={() => select(next.month, next.year)}
          className={arrowBtnClass}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
