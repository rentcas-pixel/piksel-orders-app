'use client';

import type { ComponentType } from 'react';
import {
  ArchiveBoxIcon,
  ClockIcon,
  EnvelopeIcon,
  InboxIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import type { EmailArchiveFilter } from '@/lib/email/types';

interface SidebarItem {
  value: EmailArchiveFilter;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
}

interface EmailMailboxSidebarProps {
  value: EmailArchiveFilter;
  onChange: (value: EmailArchiveFilter) => void;
  accountEmail?: string | null;
  unreadCount?: number;
  reminderCount?: number;
  lastSyncedAt?: string | null;
}

function formatSidebarDate(value: string): string {
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

export function EmailMailboxSidebar({
  value,
  onChange,
  accountEmail,
  unreadCount = 0,
  reminderCount = 0,
  lastSyncedAt,
}: EmailMailboxSidebarProps) {
  const items: SidebarItem[] = [
    { value: 'active', label: 'Gautieji', icon: InboxIcon },
    {
      value: 'unread',
      label: 'Neskaityti',
      icon: EnvelopeIcon,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      value: 'reminders',
      label: 'Priminimai',
      icon: ClockIcon,
      badge: reminderCount > 0 ? reminderCount : undefined,
    },
    { value: 'sent', label: 'Išsiųsti', icon: PaperAirplaneIcon },
    { value: 'archived', label: 'Archyvas', icon: ArchiveBoxIcon },
  ];

  return (
    <aside className="sticky top-4 flex w-52 shrink-0 flex-col self-start rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/80">
      <div className="border-b border-gray-200 px-3 py-3 dark:border-gray-700">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
          {accountEmail ?? 'Paštas'}
        </p>
        {lastSyncedAt && (
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Sync: {formatSidebarDate(lastSyncedAt)}
          </p>
        )}
      </div>

      <nav className="flex flex-col gap-0.5 p-2" aria-label="Pašto aplankai">
        {items.map((item) => {
          const active = value === item.value;
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                active
                  ? 'bg-white font-medium text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
                  : 'text-gray-600 hover:bg-white/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    active
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export function getMailboxFolderTitle(filter: EmailArchiveFilter): string {
  switch (filter) {
    case 'unread':
      return 'Neskaityti';
    case 'reminders':
      return 'Priminimai';
    case 'sent':
      return 'Išsiųsti';
    case 'archived':
      return 'Archyvas';
    default:
      return 'Gautieji';
  }
}
