import type { TableTheme } from './order-design-variants';

const COMPACT_THEMES: TableTheme[] = [
  'modern',
  'dashboard',
  'minimal',
  'dense',
  'ocean',
  'cards',
  'rail',
  'terminal',
  'warm',
];

export function getTableTheme(theme: TableTheme) {
  const compact = COMPACT_THEMES.includes(theme);

  const cardClass: Record<TableTheme, string> = {
    default:
      'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden',
    modern:
      'rounded-lg border border-gray-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 overflow-hidden',
    dashboard:
      'rounded-xl border border-gray-200/90 bg-white shadow-sm ring-1 ring-black/[0.03] dark:border-gray-800 dark:bg-gray-900 overflow-hidden',
    minimal:
      'bg-transparent overflow-hidden border-t border-b border-gray-200 dark:border-gray-800',
    dense:
      'rounded-md border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-950 overflow-hidden text-[11px]',
    ocean:
      'rounded-xl border border-sky-200/80 bg-white shadow-md shadow-sky-100/50 overflow-hidden dark:border-sky-900 dark:bg-slate-900',
    cards:
      'rounded-2xl border-0 bg-white shadow-lg shadow-gray-200/60 overflow-hidden dark:bg-gray-900 dark:shadow-none dark:ring-1 dark:ring-gray-800',
    rail:
      'rounded-lg border border-gray-200 bg-white overflow-hidden dark:border-gray-800 dark:bg-gray-900',
    terminal:
      'rounded border border-emerald-900/50 bg-gray-950 overflow-hidden font-mono text-emerald-50',
    warm:
      'rounded-xl border border-amber-200/80 bg-white shadow-sm overflow-hidden dark:border-amber-900/40 dark:bg-stone-900',
  };

  const thPad =
    theme === 'dense' || theme === 'terminal'
      ? 'px-2 py-1'
      : compact
        ? 'px-3 py-2'
        : 'px-6 py-3';
  const tdPad =
    theme === 'dense' || theme === 'terminal'
      ? 'px-2 py-1'
      : compact
        ? 'px-3 py-1.5'
        : 'px-6 py-4';

  const thClassByTheme: Partial<Record<TableTheme, string>> = {
    default: `${thPad} text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors`,
    minimal: `${thPad} text-left text-[11px] font-medium text-gray-400 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:text-gray-900 dark:hover:text-white`,
    dashboard: `${thPad} text-left text-[11px] font-semibold text-gray-600 bg-gray-50/80 dark:bg-gray-800/50 dark:text-gray-300 cursor-pointer`,
    dense: `${thPad} text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 dark:bg-gray-900 cursor-pointer`,
    ocean: `${thPad} text-left text-[11px] font-semibold text-sky-800 bg-sky-50/80 cursor-pointer dark:text-sky-200 dark:bg-sky-950/50`,
    cards: `${thPad} text-left text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-50`,
    terminal: `${thPad} text-left text-[10px] font-bold uppercase tracking-widest text-emerald-500/80 bg-gray-900 cursor-pointer`,
    warm: `${thPad} text-left text-[11px] font-semibold text-amber-900/80 bg-amber-50/50 cursor-pointer dark:text-amber-200 dark:bg-amber-950/30`,
  };

  const thClass =
    thClassByTheme[theme] ??
    `${thPad} text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors`;

  return {
    compact,
    hideAgency: compact,
    cardClass: cardClass[theme],
    thPad,
    tdPad,
    thClass,
    cellText:
      theme === 'terminal'
        ? 'text-[11px] font-mono'
        : compact
          ? theme === 'dense'
            ? 'text-[11px]'
            : 'text-xs'
          : 'text-sm',
    theadClass:
      theme === 'default'
        ? 'bg-gray-50 dark:bg-gray-700'
        : theme === 'dashboard'
          ? 'border-b border-gray-200 dark:border-gray-700'
          : theme === 'minimal'
            ? ''
            : theme === 'dense'
              ? 'bg-gray-100 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700'
              : theme === 'ocean'
                ? 'border-b border-sky-100 dark:border-sky-900'
                : theme === 'terminal'
                  ? 'border-b border-emerald-900/40 bg-gray-900'
                  : theme === 'warm'
                    ? 'border-b border-amber-100 dark:border-amber-900/50'
                    : 'border-b border-gray-100 dark:border-gray-800',
    tbodyClass:
      theme === 'default'
        ? 'bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700'
        : theme === 'terminal'
          ? 'divide-y divide-emerald-950/50'
          : theme === 'ocean'
            ? 'divide-y divide-sky-50 dark:divide-sky-950'
            : theme === 'warm'
              ? 'divide-y divide-amber-50/80 dark:divide-amber-950/50'
              : 'divide-y divide-gray-100 dark:divide-gray-800',
    rowHover:
      theme === 'terminal'
        ? 'hover:bg-emerald-950/30 cursor-pointer'
        : theme === 'ocean'
          ? 'hover:bg-sky-50/80 dark:hover:bg-sky-950/30 cursor-pointer'
          : theme === 'warm'
            ? 'hover:bg-amber-50/50 dark:hover:bg-amber-950/20 cursor-pointer'
            : theme === 'dense'
              ? 'hover:bg-blue-50/50 dark:hover:bg-gray-900 cursor-pointer'
              : theme === 'minimal'
                ? 'hover:bg-gray-50 dark:hover:bg-gray-900/40 cursor-pointer'
                : 'hover:bg-gray-50/80 dark:hover:bg-gray-800/50 cursor-pointer',
    toolbarPad:
      theme === 'dense' || theme === 'terminal' ? 'px-2 py-1' : compact ? 'px-4 py-2' : 'px-6 py-4',
    toolbarBorder:
      theme === 'terminal'
        ? 'border-emerald-900/40'
        : theme === 'ocean'
          ? 'border-sky-100 dark:border-sky-900'
          : theme === 'warm'
            ? 'border-amber-100 dark:border-amber-900/50'
            : theme === 'minimal'
              ? 'border-gray-200 dark:border-gray-800'
              : theme === 'dense'
                ? 'border-gray-300 dark:border-gray-700'
                : 'border-gray-100 dark:border-gray-800',
    showTitle: theme === 'default',
    showCount: compact,
    paginationModern: compact,
    clientCellPad: theme === 'dense' || theme === 'terminal' ? 'px-2 py-1' : compact ? 'px-3 py-2' : 'px-4 py-4',
    clientFont:
      theme === 'terminal'
        ? 'text-[11px] font-mono font-medium'
        : compact
          ? theme === 'dense'
            ? 'text-[11px] font-medium'
            : 'text-xs font-semibold'
          : 'text-sm font-medium',
    spinBorder:
      theme === 'terminal'
        ? 'border-emerald-500'
        : theme === 'ocean'
          ? 'border-sky-600'
          : theme === 'warm'
            ? 'border-amber-600'
            : compact
              ? 'border-gray-900 dark:border-white'
              : 'border-blue-600',
    exportBtn:
      theme === 'terminal'
        ? 'inline-flex items-center gap-1 rounded border border-emerald-800 bg-gray-900 px-2 py-1 text-[11px] font-mono text-emerald-400 hover:bg-gray-800 disabled:opacity-50'
        : theme === 'warm'
          ? 'inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'
        : compact
          ? 'inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
          : 'inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50',
    toggleSize: theme === 'dense' || theme === 'terminal' ? 'h-4 w-8' : compact ? 'h-5 w-9' : 'h-6 w-11',
    toggleKnob: theme === 'dense' || theme === 'terminal' ? 'h-3 w-3' : compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
    toggleOnX: theme === 'dense' || theme === 'terminal' ? 'translate-x-4' : compact ? 'translate-x-4' : 'translate-x-6',
    toggleOff: 'bg-gray-200 dark:bg-gray-600',
    toggleIssuedOn: 'bg-green-600',
    toggleIssuedFocus: 'focus:ring-green-500',
    toggleSentOn: 'bg-violet-600',
    toggleSentFocus: 'focus:ring-violet-500',
  };
}
