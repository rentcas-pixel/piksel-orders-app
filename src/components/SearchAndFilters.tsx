'use client';

import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';

interface SearchAndFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: {
    status: string;
    month: string;
    year: string;
    client: string;
    agency: string;
    media_received: string;
    invoice_sent: string;
  };
  onFiltersChange: (filters: {
    status: string;
    month: string;
    year: string;
    client: string;
    agency: string;
    media_received: string;
    invoice_sent: string;
  }) => void;
  variant?: import('@/lib/order-design-variants').FilterTheme;
}

export function SearchAndFilters({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  variant = 'default',
}: SearchAndFiltersProps) {
  const compact = variant !== 'default';
  const fieldClass =
    variant === 'terminal'
      ? 'px-2 py-1 border border-emerald-900/60 rounded bg-gray-900 text-[11px] font-mono text-emerald-100 placeholder:text-emerald-700'
      : variant === 'dense'
        ? 'px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-[11px] dark:text-white'
        : variant === 'warm'
          ? 'px-2.5 py-1.5 border border-amber-200 rounded-lg bg-amber-50/50 text-xs text-stone-800 focus:ring-amber-500/20 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
          : variant === 'ocean'
            ? 'px-2.5 py-1.5 border border-sky-200 rounded-lg bg-sky-50/50 text-xs focus:ring-sky-500/20 dark:border-sky-800 dark:bg-sky-950/30 dark:text-white'
            : compact
              ? 'px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 focus:ring-2 focus:ring-gray-900/5 dark:text-white text-xs'
              : 'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm';

  const wrapperClass: Record<NonNullable<SearchAndFiltersProps['variant']>, string> = {
    default: 'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6',
    modern: 'rounded-lg border border-gray-200/80 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900',
    dashboard: 'rounded-xl border border-gray-200/90 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900',
    minimal: 'border-y border-gray-200 dark:border-gray-800 py-3',
    dense: 'rounded-md border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-950',
    ocean: 'rounded-xl border border-sky-200/80 bg-white p-3 shadow-sm dark:border-sky-900 dark:bg-slate-900',
    cards: 'rounded-2xl bg-white p-4 shadow-lg shadow-gray-200/50 dark:bg-gray-900 dark:shadow-none dark:ring-1 dark:ring-gray-800',
    rail: 'rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900',
    terminal: 'rounded border border-emerald-900/40 bg-gray-950 p-2 font-mono',
    warm: 'rounded-xl border border-amber-200/80 bg-white p-3 dark:border-amber-900/40 dark:bg-stone-900',
  };
  const months = [
    { value: '01', label: 'Sausis' },
    { value: '02', label: 'Vasaris' },
    { value: '03', label: 'Kovas' },
    { value: '04', label: 'Balandis' },
    { value: '05', label: 'Gegužė' },
    { value: '06', label: 'Birželis' },
    { value: '07', label: 'Liepa' },
    { value: '08', label: 'Rugpjūtis' },
    { value: '09', label: 'Rugsėjis' },
    { value: '10', label: 'Spalis' },
    { value: '11', label: 'Lapkritis' },
    { value: '12', label: 'Gruodis' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const statuses = [
    { value: '', label: 'Visi statusai' },
    { value: 'taip', label: 'Patvirtinta' },
    { value: 'ne', label: 'Nepatvirtinta' }
  ];

  const mediaReceivedOptions = [
    { value: '', label: 'Visi media' },
    { value: 'true', label: 'Media gautas' },
    { value: 'false', label: 'Media negautas' }
  ];

  const invoiceSentOptions = [
    { value: '', label: 'Visos sąskaitos' },
    { value: 'true', label: 'Sąskaita išrašyta' },
    { value: 'false', label: 'Sąskaita neišrašyta' },
  ];



  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className={wrapperClass[variant]}>
      <div className={compact ? '' : 'grid grid-cols-1 lg:grid-cols-2 gap-6'}>
        {!compact && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Paieška</label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Ieškoti pagal klientą, agentūrą, užsakymo Nr..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        )}

        <div className={compact ? '' : 'space-y-2'}>
          {!compact && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filtrai</label>}
          {!compact && (filters.status === 'taip' || filters.month || filters.year) && (
            <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-md">
              ℹ️ Aktyvūs filtrai: {filters.status === 'taip' ? 'Patvirtinta, ' : ''}{filters.month ? `${months.find(m => m.value === filters.month)?.label}, ` : ''}{filters.year ? `${filters.year} metai` : ''}
            </div>
          )}
          <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7' : 'grid-cols-3'}`}>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className={fieldClass}
            >
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <select
              value={filters.month}
              onChange={(e) => handleFilterChange('month', e.target.value)}
              className={fieldClass}
            >
              <option value="">Visi mėnesiai</option>
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>

            <select
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              className={fieldClass}
            >
              <option value="">Visi metai</option>
              {years.map((year) => (
                <option key={year} value={year.toString()}>
                  {year}
                </option>
              ))}
            </select>

            <select
              value={filters.media_received}
              onChange={(e) => handleFilterChange('media_received', e.target.value)}
              className={fieldClass}
            >
              {mediaReceivedOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filters.invoice_sent}
              onChange={(e) => handleFilterChange('invoice_sent', e.target.value)}
              className={fieldClass}
            >
              {invoiceSentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Klientas"
              value={filters.client}
              onChange={(e) => handleFilterChange('client', e.target.value)}
              className={fieldClass}
            />

            <input
              type="text"
              placeholder="Agentūra"
              value={filters.agency}
              onChange={(e) => handleFilterChange('agency', e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {(filters.status || filters.month || filters.year || filters.client || filters.agency || filters.invoice_sent) && (
        <div className={`${compact ? 'mt-2 pt-2' : 'mt-4 pt-4'} border-t border-gray-200 dark:border-gray-600`}>
          <div className="flex items-center space-x-2">
            <FunnelIcon className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Aktyvūs filtrai:</span>
            <div className="flex flex-wrap gap-2">
              {filters.status && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  Statusas: {statuses.find(s => s.value === filters.status)?.label}
                  <button
                    onClick={() => handleFilterChange('status', '')}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.month && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Mėnuo: {months.find(m => m.value === filters.month)?.label}
                  <button
                    onClick={() => handleFilterChange('month', '')}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.year && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  Metai: {filters.year}
                  <button
                    onClick={() => handleFilterChange('year', '')}
                    className="ml-1 text-purple-600 hover:text-purple-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.client && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                  Klientas: {filters.client}
                  <button
                    onClick={() => handleFilterChange('client', '')}
                    className="ml-1 text-orange-600 hover:text-orange-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.invoice_sent && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
                  Sąskaita: {filters.invoice_sent === 'true' ? 'Išrašyta' : 'Neišrašyta'}
                  <button
                    onClick={() => handleFilterChange('invoice_sent', '')}
                    className="ml-1 text-teal-600 hover:text-teal-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.agency && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                  Agentūra: {filters.agency}
                  <button
                    onClick={() => handleFilterChange('agency', '')}
                    className="ml-1 text-indigo-600 hover:text-indigo-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.media_received && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
                  Media: {mediaReceivedOptions.find(o => o.value === filters.media_received)?.label}
                  <button
                    onClick={() => handleFilterChange('media_received', '')}
                    className="ml-1 text-teal-600 hover:text-teal-800"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
