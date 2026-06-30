'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  bankImportProgress,
  type BankImportProgressState,
} from '@/lib/bank-import-progress';

function progressPercent(state: BankImportProgressState): number | null {
  if (state.total <= 0) {
    if (state.phase === 'reading' || state.phase === 'allocating') return null;
    if (state.phase === 'done') return 100;
    return null;
  }
  return Math.min(100, Math.round((state.current / state.total) * 100));
}

export function BankImportProgressToast() {
  const state = useSyncExternalStore(
    bankImportProgress.subscribe,
    bankImportProgress.getSnapshot,
    bankImportProgress.getSnapshot
  );

  useEffect(() => {
    if (state.phase !== 'done' && state.phase !== 'error') return;

    const timeout = setTimeout(() => {
      bankImportProgress.dismiss();
    }, state.phase === 'done' ? 6000 : 10000);

    return () => clearTimeout(timeout);
  }, [state.phase]);

  if (!state.active) return null;

  const percent = progressPercent(state);
  const indeterminate =
    percent === null && state.phase !== 'done' && state.phase !== 'error';

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[min(100vw-2rem,22rem)]">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-600 dark:bg-gray-800">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">
            {state.phase === 'done' ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                ✓
              </div>
            ) : state.phase === 'error' ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">
                !
              </div>
            ) : (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {state.label}
                </p>
                {state.fileName && (
                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                    {state.fileName}
                    {state.format ? ` · ${state.format.toUpperCase()}` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => bankImportProgress.dismiss()}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                aria-label="Uždaryti"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            {(indeterminate || percent !== null) && state.phase !== 'done' && state.phase !== 'error' && (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  {indeterminate ? (
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-600" />
                  ) : (
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  )}
                </div>
                {state.total > 0 && (
                  <p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {state.current} / {state.total}
                    {percent !== null ? ` · ${percent}%` : ''}
                  </p>
                )}
              </div>
            )}

            {state.message && (
              <p
                className={`mt-2 text-xs leading-relaxed ${
                  state.phase === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {state.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
