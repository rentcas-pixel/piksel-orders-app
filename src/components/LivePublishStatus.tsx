'use client';

import { CheckCircleIcon } from '@heroicons/react/24/solid';

type LivePublishStatusProps = {
  variant: 'hidden' | 'pending' | 'sending' | 'receipt';
  changes: string[];
  serverAccepted?: boolean;
  playerAccepted?: boolean;
  liveBusy?: boolean;
  onLive?: () => void;
};

function StatusLine({
  done,
  waiting,
  label,
}: {
  done: boolean;
  waiting?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <span
          className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
            waiting
              ? 'animate-pulse border-gray-400 dark:border-gray-500'
              : 'border-gray-300 dark:border-gray-600'
          }`}
        />
      )}
      <span
        className={
          done
            ? 'font-medium text-emerald-800 dark:text-emerald-200'
            : waiting
              ? 'text-gray-700 dark:text-gray-300'
              : 'text-gray-500 dark:text-gray-400'
        }
      >
        {label}
      </span>
    </div>
  );
}

export function LivePublishStatus({
  variant,
  changes,
  serverAccepted,
  playerAccepted,
  liveBusy,
  onLive,
}: LivePublishStatusProps) {
  if (variant === 'hidden') return null;

  if (variant === 'receipt') {
    const waiting = !!serverAccepted && !playerAccepted;
    return (
      <div
        className={
          waiting
            ? 'border-b border-gray-200 bg-gray-50 px-6 py-2.5 dark:border-gray-700 dark:bg-gray-900/40'
            : 'border-b border-emerald-200 bg-emerald-50 px-6 py-2.5 dark:border-emerald-900/60 dark:bg-emerald-950/30'
        }
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <StatusLine done={!!serverAccepted} label="Serveris priėmė" />
          <StatusLine
            done={!!playerAccepted}
            waiting={waiting}
            label={
              playerAccepted
                ? 'Grotuvas gavo šią versiją'
                : 'Grotuvas dar nepatvirtino'
            }
          />
        </div>
      </div>
    );
  }

  const sending = variant === 'sending' || liveBusy;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
      <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
        Ekranuose yra ankstesnė kampanijos versija
      </p>
      {changes.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-amber-900/80 dark:text-amber-200/80">
          {changes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {onLive ? (
        <button
          type="button"
          onClick={onLive}
          disabled={sending}
          className="mt-3 inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {sending ? 'Siunčiama…' : 'Live'}
        </button>
      ) : null}
    </div>
  );
}
