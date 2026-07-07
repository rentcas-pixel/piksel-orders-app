'use client';

export function BillingGapsIndicator() {
  return (
    <span
      className="shrink-0 inline-flex items-center rounded-md bg-amber-50 px-1 py-0.5 text-[10px] leading-none tracking-[0.2em] text-amber-700 ring-1 ring-inset ring-amber-600/15 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/20"
      title="Nestandartinis sąskaitavimas — keli aktyvūs periodai"
      onClick={(event) => event.stopPropagation()}
    >
      ···
    </span>
  );
}
