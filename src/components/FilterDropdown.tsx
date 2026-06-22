'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

export interface FilterOption {
  value: string;
  label: string;
}

export const filterControlClass =
  'h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100';

interface FilterDropdownProps {
  value: string;
  options: FilterOption[];
  placeholder: string;
  onChange: (value: string) => void;
  /** Plotis pagal turinį, ne per visą tėvinį elementą */
  fitContent?: boolean;
  className?: string;
}

export function FilterDropdown({
  value,
  options,
  placeholder,
  onChange,
  fitContent = false,
  className = '',
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedLabel =
    value === '' ? placeholder : (options.find((o) => o.value === value)?.label ?? placeholder);
  const isPlaceholder = value === '';

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div
      ref={rootRef}
      className={`relative ${fitContent ? 'w-fit' : 'min-w-0 flex-1'} ${className}`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex ${filterControlClass} ${fitContent ? 'w-auto whitespace-nowrap' : 'w-full'} items-center justify-between gap-2 px-3.5 font-normal hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}
      >
        <span className={`${fitContent ? '' : 'truncate'} ${isPlaceholder ? 'text-gray-500 dark:text-gray-400' : ''}`}>
          {selectedLabel}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          className={`absolute left-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1 shadow-[0_4px_24px_rgba(0,0,0,0.06)] ${
            fitContent ? 'min-w-full w-max' : 'right-0'
          }`}
        >
          {options.map((opt) => (
            <li key={opt.value || 'all'}>
              <button
                type="button"
                className={`w-full text-left px-3.5 py-2 text-sm transition-colors ${
                  opt.value === value
                    ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                    : 'text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/80'
                }`}
                onClick={() => {
                  onChange(opt.value);
                  close();
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
