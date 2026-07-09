'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';

export interface OrderSpecPriceSectionProps {
  enabled: boolean;
  price: number;
  onEnabledChange: (enabled: boolean) => void;
  onPriceChange: (price: number) => void;
  onClose?: () => void;
  onDisable?: () => void;
}

export function OrderSpecPriceSection({
  enabled,
  price,
  onEnabledChange,
  onPriceChange,
  onClose,
  onDisable,
}: OrderSpecPriceSectionProps) {
  const disable = () => {
    onEnabledChange(false);
    onPriceChange(0);
    onDisable?.();
    onClose?.();
  };

  return (
    <div className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 dark:text-white">Spec. užsakymas</p>
        <div className="flex shrink-0 items-center gap-1">
          {enabled && (
            <button
              type="button"
              onClick={disable}
              className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-white/70 dark:text-gray-300 dark:hover:bg-gray-800/70"
            >
              Išjungti
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-gray-500 hover:bg-white/70 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-gray-200"
              aria-label="Slėpti"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          <span className="text-sm text-gray-800 dark:text-gray-200">Rankinė kaina</span>
        </label>

        {enabled && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Kaina (€, be PVM)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price > 0 ? price : ''}
              onChange={(e) => onPriceChange(parseFloat(e.target.value) || 0)}
              className="h-10 w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        )}
      </div>
    </div>
  );
}
