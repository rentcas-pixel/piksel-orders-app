'use client';

import { CalendarDaysIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import type { OrdersListFilters, OrdersViewMode } from '@/lib/orders-filters';
import { PortalFiltersBar } from '@/components/PortalFiltersBar';

interface OrdersSearchFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: OrdersListFilters;
  onFiltersChange: (filters: OrdersListFilters) => void;
  viewMode: OrdersViewMode;
  onViewModeChange: (mode: OrdersViewMode) => void;
}

export function OrdersSearchFilters({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
}: OrdersSearchFiltersProps) {
  return (
    <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 space-y-3">
      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 p-1">
        <button
          type="button"
          onClick={() => onViewModeChange('list')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
            viewMode === 'list'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
          }`}
        >
          <TableCellsIcon className="w-4 h-4" />
          Sąrašas
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('calendar')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
            viewMode === 'calendar'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
          }`}
        >
          <CalendarDaysIcon className="w-4 h-4" />
          Kalendorius
        </button>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
        <PortalFiltersBar
          embedded
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          filters={filters}
          onFiltersChange={onFiltersChange}
          showMonthYear={viewMode === 'list'}
        />
      </div>
    </div>
  );
}
