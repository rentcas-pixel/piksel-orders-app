'use client';

import { useRef } from 'react';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';

interface IsoDateFieldProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}

export function IsoDateField({ value, onChange, min, max }: IsoDateFieldProps) {
  const pickerRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === 'function') {
      picker.showPicker();
      return;
    }
    picker.focus();
    picker.click();
  };

  return (
    <div className="inline-flex items-center rounded-md border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
      <input
        type="text"
        readOnly
        value={value}
        placeholder="yyyy-mm-dd"
        onClick={openPicker}
        className="w-[6.75rem] cursor-pointer border-0 bg-transparent px-2 py-1 text-sm tabular-nums text-gray-900 focus:outline-none dark:text-white"
      />
      <button
        type="button"
        onClick={openPicker}
        className="px-1.5 py-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        aria-label="Pasirinkti datą"
      >
        <CalendarDaysIcon className="h-4 w-4" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
    </div>
  );
}
