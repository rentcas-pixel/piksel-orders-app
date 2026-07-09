'use client';

export function OrderSpecIndicator() {
  return (
    <span
      className="shrink-0 inline-flex items-center rounded-md bg-amber-50 px-1 py-0.5 text-[10px] font-semibold leading-none uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/15 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/20"
      title="Spec. užsakymas — rankinė kaina"
      onClick={(event) => event.stopPropagation()}
    >
      Spec
    </span>
  );
}
