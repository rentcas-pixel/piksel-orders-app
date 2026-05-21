'use client';

import Image from 'next/image';
import {
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  SparklesIcon,
  ClockIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

import type { AppTab } from '@/lib/app-navigation';
import { PAGE_META } from '@/lib/app-navigation';

export type { AppTab };

const NAV: { id: AppTab; label: string; icon: typeof ClipboardDocumentListIcon }[] = [
  { id: 'orders', label: PAGE_META.orders.title, icon: ClipboardDocumentListIcon },
  { id: 'revenue', label: PAGE_META.revenue.title, icon: ChartBarIcon },
  { id: 'partners', label: PAGE_META.partners.title, icon: UserGroupIcon },
  { id: 'agencies', label: PAGE_META.agencies.title, icon: BuildingOffice2Icon },
  { id: 'latest', label: PAGE_META.latest.title, icon: ClockIcon },
  { id: 'analytics', label: PAGE_META.analytics.title, icon: SparklesIcon },
];

interface AppShellProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onAddOrder: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  pageTitle: string;
  pageDescription: string;
  children: React.ReactNode;
}

export function AppShell({
  activeTab,
  onTabChange,
  onAddOrder,
  searchQuery,
  onSearchChange,
  pageTitle,
  pageDescription,
  children,
}: AppShellProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="flex min-h-screen bg-[#f4f5f7] dark:bg-gray-950">
      <aside className="hidden md:flex w-[200px] shrink-0 flex-col border-r border-gray-200/80 bg-white dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <Image
            src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
            alt="Piksel"
            width={120}
            height={40}
            className="h-7 w-auto dark:invert"
          />
        </div>
        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`} />
                {label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Tema"
          >
            {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={onAddOrder}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <CalendarDaysIcon className="w-4 h-4" />
            Naujas
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200/80 bg-white/90 px-4 py-2 backdrop-blur-md dark:bg-gray-900/90 dark:border-gray-800 md:px-5">
          <div className="md:hidden shrink-0">
            <Image
              src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
              alt="Piksel"
              width={100}
              height={32}
              className="h-7 w-auto dark:invert"
            />
          </div>
          <div className="relative flex-1 max-w-xl">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Ieškoti kliento, agentūros, Nr..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/5 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <select
            className="md:hidden rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:bg-gray-800 dark:border-gray-700"
            value={activeTab}
            onChange={(e) => onTabChange(e.target.value as AppTab)}
          >
            {NAV.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </header>

        <main className="flex-1 p-3 md:p-4 md:pt-5 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                {pageTitle}
              </h1>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{pageDescription}</p>
            </div>
            <button
              type="button"
              onClick={onAddOrder}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            >
              <CalendarDaysIcon className="w-4 h-4" />
              Pridėti užsakymą
            </button>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
