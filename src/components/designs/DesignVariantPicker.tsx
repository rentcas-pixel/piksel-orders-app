'use client';

import { ORDER_DESIGN_VARIANTS, type OrderDesignVariant } from '@/lib/order-design-variants';
import { ChevronUpIcon, PaintBrushIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

interface DesignVariantPickerProps {
  value: OrderDesignVariant;
  onChange: (variant: OrderDesignVariant) => void;
}

export function DesignVariantPicker({ value, onChange }: DesignVariantPickerProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 max-w-[min(100vw-2rem,22rem)]">
      {open && (
        <div className="flex max-h-[min(70vh,28rem)] flex-col rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/95">
          <p className="mb-2 shrink-0 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            10 dizainų variantų (testavimui)
          </p>
          <div className="grid gap-1.5 overflow-y-auto pr-1">
            {ORDER_DESIGN_VARIANTS.map((v) => {
              const active = value === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onChange(v.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                    active
                      ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900/10 dark:border-white dark:bg-gray-800 dark:ring-white/20'
                      : 'border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-gray-700 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <span className={`mt-0.5 h-8 w-8 shrink-0 rounded-lg ${v.swatch} ring-1 ring-black/5`} />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-gray-900 dark:text-white">{v.label}</span>
                    <span className="block text-[10px] leading-snug text-gray-500 dark:text-gray-400">{v.tagline}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-gray-800 dark:border-gray-600"
      >
        <PaintBrushIcon className="h-4 w-4" />
        Dizainai
        <ChevronUpIcon className={`h-4 w-4 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );
}
