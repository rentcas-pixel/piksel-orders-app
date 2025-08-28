'use client';

import React from 'react';
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
}

export function SearchAndFilters({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange
}: SearchAndFiltersProps) {
  const months = [
    { value: '', label: 'Visi mėnesiai' },
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
  const currentYear = new Date().getFullYear();

  const statuses = [
    { value: '', label: 'Visi statusai' },
    { value: 'taip', label: 'Patvirtinta' },
    { value: 'ne', label: 'Nepatvirtinta' },
    { value: 'rezervuota', label: 'Rezervuota' },
    { value: 'atšaukta', label: 'Atšaukta' }
  ];

  const mediaReceivedOptions = [
    { value: '', label: 'Visi media' },
    { value: 'true', label: 'Media gautas' },
    { value: 'false', label: 'Media negautas' }
  ];



  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Set default filters when component mounts
  React.useEffect(() => {
    // Force set default filters on first load
    onFiltersChange({
      status: '', // Visi statusai
      month: '', // Visi mėnesiai
      year: currentYear.toString(), // 2025 metai
      client: '',
      agency: '',
      media_received: '',
      invoice_sent: ''
    });
  }, [currentYear, onFiltersChange]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Paieška
          </label>
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

        {/* Filters */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Filtrai
          </label>
          {/* Active filters info */}
          {(filters.status || filters.month || filters.client || filters.agency) && (
            <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-md">
              ℹ️ Aktyvūs filtrai: {filters.status ? `${statuses.find(s => s.value === filters.status)?.label}, ` : ''}{filters.month ? `${months.find(m => m.value === filters.month)?.label}, ` : ''}{filters.client ? `Klientas: ${filters.client}, ` : ''}{filters.agency ? `Agentūra: ${filters.agency}` : ''}
            </div>
          )}
          
          {/* Default filters info */}
          {filters.status === '' && filters.month === '' && filters.year === currentYear.toString() && (
            <div className="text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-md">
              🎯 By default: Visi statusai, Visi mėnesiai, 2025 metai
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
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
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>

            <select
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
            >
              {years.map((year) => (
                <option key={year} value={year.toString()}>
                  {year}
                </option>
              ))}
            </select>

            <select
              value={filters.media_received}
              onChange={(e) => handleFilterChange('media_received', e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
            >
              {mediaReceivedOptions.map((option) => (
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
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
            />

            <input
              type="text"
              placeholder="Agentūra"
              value={filters.agency}
              onChange={(e) => handleFilterChange('agency', e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {(filters.status || filters.month || filters.year || filters.client || filters.agency) && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
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
