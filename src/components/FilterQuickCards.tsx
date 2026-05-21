'use client';

import {
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import type { QuickCardTheme } from '@/lib/order-design-variants';

interface FilterQuickCardsProps {
  filters: {
    status: string;
    media_received: string;
    invoice_sent: string;
    year: string;
  };
  onFiltersChange: (patch: Partial<FilterQuickCardsProps['filters']>) => void;
  variant?: QuickCardTheme;
}

const cards = [
  {
    key: 'all',
    label: 'Visi',
    sub: 'Be filtrų',
    dot: 'bg-gray-400',
    icon: Squares2X2Icon,
    iconBg: 'bg-gray-100 text-gray-600',
    apply: () => ({ status: '', media_received: '', invoice_sent: '' }),
  },
  {
    key: 'approved',
    label: 'Patvirtinti',
    sub: 'Patvirtinta',
    dot: 'bg-emerald-500',
    icon: CheckCircleIcon,
    iconBg: 'bg-emerald-50 text-emerald-600',
    apply: () => ({ status: 'taip', media_received: '', invoice_sent: '' }),
  },
  {
    key: 'pending',
    label: 'Laukia',
    sub: 'Nepatvirtinta',
    dot: 'bg-amber-500',
    icon: ClockIcon,
    iconBg: 'bg-amber-50 text-amber-600',
    apply: () => ({ status: 'ne', media_received: '', invoice_sent: '' }),
  },
  {
    key: 'invoice',
    label: 'Sąskaita',
    sub: 'Neišrašyta',
    dot: 'bg-rose-500',
    icon: DocumentTextIcon,
    iconBg: 'bg-rose-50 text-rose-600',
    apply: () => ({ status: '', media_received: '', invoice_sent: 'false' }),
  },
] as const;

export function FilterQuickCards({ filters, onFiltersChange, variant = 'default' }: FilterQuickCardsProps) {
  if (variant === 'hidden') return null;

  const isActive = (key: string) => {
    if (key === 'all') return !filters.status && !filters.media_received && !filters.invoice_sent;
    if (key === 'approved') return filters.status === 'taip';
    if (key === 'pending') return filters.status === 'ne';
    if (key === 'invoice') return filters.invoice_sent === 'false';
    return false;
  };

  if (variant === 'chips') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {cards.map((card) => {
          const active = isActive(card.key);
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onFiltersChange(card.apply())}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {card.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'strip') {
    return (
      <div className="flex flex-wrap gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 p-2">
        {cards.map((card) => {
          const active = isActive(card.key);
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onFiltersChange(card.apply())}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                active ? 'bg-white text-blue-700 shadow' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              {card.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'warm') {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {cards.map((card) => {
          const active = isActive(card.key);
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onFiltersChange(card.apply())}
              className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-all ${
                active
                  ? 'border-amber-400 bg-amber-50 shadow-sm ring-1 ring-amber-400/30'
                  : 'border-amber-200/80 bg-white hover:border-amber-300'
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-[10px] font-medium text-amber-800/70">{card.label}</span>
                <span className="block text-xs font-semibold text-stone-800">{card.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => {
          const active = isActive(card.key);
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onFiltersChange(card.apply())}
              className={`flex items-center gap-3 rounded-xl border bg-white p-4 text-left transition-all dark:bg-gray-900 ${
                active
                  ? 'border-indigo-200 shadow-md ring-2 ring-indigo-500/20 dark:border-indigo-800'
                  : 'border-gray-200/90 hover:shadow-sm dark:border-gray-800'
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">{card.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {cards.map((card) => {
        const active = isActive(card.key);
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onFiltersChange(card.apply())}
            className={`text-left rounded-lg border px-3 py-2.5 transition-all ${
              active
                ? 'border-gray-900/15 bg-white shadow-sm ring-1 ring-gray-900/5 dark:border-white/20 dark:bg-gray-800 dark:ring-white/10'
                : 'border-gray-200/80 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {card.label}
                </p>
                <p className="mt-0.5 truncate text-xs text-gray-600 dark:text-gray-300">{card.sub}</p>
              </div>
              <span className={`h-2 w-2 shrink-0 rounded-full ${card.dot}`} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
