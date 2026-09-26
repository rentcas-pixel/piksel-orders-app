'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface AgencySelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function AgencySelect({
  value,
  options,
  onChange,
  placeholder = 'Pasirinkite agentūrą…',
  required = false,
  disabled = false,
  id,
  className = '',
}: AgencySelectProps) {
  const autoId = useId();
  const controlId = id || autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <select
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <button
        type="button"
        id={controlId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${controlId}-menu`}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        className={`flex h-10 w-full items-center justify-between gap-3 rounded-lg border bg-white px-3 text-left text-sm shadow-sm transition-colors dark:bg-gray-700 ${
          open
            ? 'border-blue-400 ring-2 ring-blue-500/20 dark:border-blue-500'
            : 'border-gray-300 dark:border-gray-600'
        } ${
          disabled
            ? 'cursor-not-allowed bg-gray-50 text-gray-400 dark:bg-gray-800'
            : 'hover:bg-gray-50 dark:hover:bg-gray-600/40'
        }`}
      >
        <span className={value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
          {value || placeholder}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180 text-blue-600' : ''}`}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m5.5 7.5 4.5 4.5 4.5-4.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <ul
          id={`${controlId}-menu`}
          role="listbox"
          aria-labelledby={controlId}
          className="absolute z-50 mt-1.5 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
        >
          <li role="option" aria-selected={!value}>
            <button
              type="button"
              className={`flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm ${
                value
                  ? 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/70'
                  : 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
              }`}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              {placeholder}
            </button>
          </li>
          {options.map((option) => {
            const selected = option === value;
            return (
              <li key={option} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm ${
                    selected
                      ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700/70'
                  }`}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  {option}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
