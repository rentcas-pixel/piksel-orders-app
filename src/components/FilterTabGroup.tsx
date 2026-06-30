'use client';

import type { ComponentType } from 'react';
import {
  filterPillActiveClass,
  filterPillGroupClass,
  filterPillInactiveClass,
} from '@/lib/portal-ui';

interface FilterTabOption<T extends string> {
  value: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}

interface FilterTabGroupProps<T extends string> {
  label: string;
  value: T;
  options: FilterTabOption<T>[];
  onChange: (value: T) => void;
}

export function FilterTabGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: FilterTabGroupProps<T>) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <div className={filterPillGroupClass} role="tablist" aria-label={label}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value || 'all'}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(opt.value)}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm transition-all whitespace-nowrap ${
                active ? filterPillActiveClass : filterPillInactiveClass
              }`}
            >
              {opt.icon ? <opt.icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
