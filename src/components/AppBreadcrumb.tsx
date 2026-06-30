'use client';

import type { AppBreadcrumbSegment } from '@/lib/app-navigation';

interface AppBreadcrumbProps {
  segments: AppBreadcrumbSegment[];
}

export function AppBreadcrumb({ segments }: AppBreadcrumbProps) {
  if (segments.length === 0) return null;

  return (
    <nav
      aria-label="Kelias"
      className="mb-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800/60"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        Skiltis{' '}
      </span>
      {segments.map((segment, index) => (
        <span key={`${segment.label}-${index}`}>
          {index > 0 && <span className="mx-1.5 text-gray-400 dark:text-gray-500">/</span>}
          <span
            className={
              index === segments.length - 1
                ? 'font-semibold text-gray-900 dark:text-white'
                : 'text-gray-600 dark:text-gray-300'
            }
          >
            {segment.label}
          </span>
        </span>
      ))}
    </nav>
  );
}
