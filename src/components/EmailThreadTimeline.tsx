'use client';

import {
  EMAIL_CATEGORY_COLORS,
  EMAIL_CATEGORY_LABELS,
  type ProcessedEmail,
} from '@/lib/email/types';

interface EmailThreadTimelineProps {
  emails: ProcessedEmail[];
  activeEmailId: string;
  onSelect: (email: ProcessedEmail) => void;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('lt-LT', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export function EmailThreadTimeline({
  emails,
  activeEmailId,
  onSelect,
}: EmailThreadTimelineProps) {
  if (emails.length <= 1) return null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        Gija · {emails.length} laiškai
      </h3>
      <ol className="space-y-2">
        {emails.map((item, index) => {
          const isActive = item.id === activeEmailId;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  isActive
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                    : 'border-transparent bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">#{index + 1}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {item.from_name || item.from_address || 'Nežinomas siuntėjas'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {item.subject || '(be temos)'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-400">{formatDate(item.received_at)}</p>
                    <span
                      className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${EMAIL_CATEGORY_COLORS[item.category]}`}
                    >
                      {EMAIL_CATEGORY_LABELS[item.category]}
                    </span>
                  </div>
                </div>
                {item.summary && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {item.summary}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
