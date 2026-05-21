'use client';

import Image from 'next/image';
import {
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  ClockIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { AppTab } from '@/lib/app-navigation';
import { APP_TABS, PAGE_META } from '@/lib/app-navigation';

const RAIL_NAV: { id: AppTab; icon: typeof ClipboardDocumentListIcon; label: string }[] = [
  { id: 'orders', icon: ClipboardDocumentListIcon, label: 'Užsakymai' },
  { id: 'revenue', icon: ChartBarIcon, label: 'Pajamos' },
  { id: 'partners', icon: UserGroupIcon, label: 'Partneriai' },
  { id: 'agencies', icon: BuildingOffice2Icon, label: 'Agentūros' },
  { id: 'latest', icon: ClockIcon, label: 'Naujausi' },
  { id: 'analytics', icon: SparklesIcon, label: 'Analizė' },
];

interface LayoutProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onAddOrder: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  children: React.ReactNode;
}

function TabBar({
  activeTab,
  onTabChange,
  variant,
}: {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  variant: 'underline' | 'pills' | 'dark';
}) {
  return (
    <nav className="flex gap-1 overflow-x-auto pb-px">
      {APP_TABS.map((tab) => {
        const active = activeTab === tab;
        if (variant === 'pills') {
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              {PAGE_META[tab].title}
            </button>
          );
        }
        if (variant === 'dark') {
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                active
                  ? 'border-white text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {PAGE_META[tab].title}
            </button>
          );
        }
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              active
                ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400'
            }`}
          >
            {PAGE_META[tab].title}
          </button>
        );
      })}
    </nav>
  );
}

/** Variant 3 — KPI dashboard (Invoices mockup style) */
export function DashboardLayout({
  activeTab,
  onTabChange,
  onAddOrder,
  searchQuery,
  onSearchChange,
  children,
}: LayoutProps) {
  const meta = PAGE_META[activeTab];
  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-gray-950">
      <header className="border-b border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Image
            src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
            alt="Piksel"
            width={100}
            height={32}
            className="h-7 w-auto dark:invert"
          />
          <div className="relative hidden flex-1 max-w-md sm:block">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Ieškoti..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={onAddOrder}
            className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900"
          >
            + Naujas užsakymas
          </button>
        </div>
        <div className="mx-auto max-w-[1400px] border-t border-gray-100 px-4 dark:border-gray-800 md:px-6">
          <TabBar activeTab={activeTab} onTabChange={onTabChange} variant="underline" />
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{meta.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{meta.description}</p>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

/** Variant 4 — Minimal, table-first */
export function MinimalLayout({
  activeTab,
  onTabChange,
  onAddOrder,
  searchQuery,
  onSearchChange,
  children,
}: LayoutProps) {
  const meta = PAGE_META[activeTab];
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Image
            src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
            alt="Piksel"
            width={90}
            height={28}
            className="h-6 w-auto dark:invert"
          />
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Paieška..."
              className="w-full border-0 border-b border-gray-200 bg-transparent py-2 pl-9 text-sm focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={onAddOrder}
            className="text-xs font-medium text-gray-900 underline-offset-4 hover:underline dark:text-white"
          >
            + Naujas
          </button>
        </div>
        <div className="mx-auto max-w-[1400px] px-4 md:px-8">
          <TabBar activeTab={activeTab} onTabChange={onTabChange} variant="underline" />
        </div>
      </div>
      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 md:px-8">
        <h1 className="text-lg font-medium text-gray-900 dark:text-white">{meta.title}</h1>
        {children}
      </main>
    </div>
  );
}

/** Variant 5 — Dense, dark chrome */
export function DenseLayout({
  activeTab,
  onTabChange,
  onAddOrder,
  searchQuery,
  onSearchChange,
  children,
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-black">
      <header className="bg-gray-900 text-white">
        <div className="flex items-center gap-3 px-3 py-2">
          <Image
            src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
            alt="Piksel"
            width={80}
            height={24}
            className="h-5 w-auto brightness-0 invert"
          />
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Ieškoti..."
              className="w-full rounded border border-gray-700 bg-gray-800 py-1 pl-8 pr-2 text-xs text-white placeholder:text-gray-500"
            />
          </div>
          <button
            type="button"
            onClick={onAddOrder}
            className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-semibold text-gray-900"
          >
            <CalendarDaysIcon className="h-3.5 w-3.5" />
            Naujas
          </button>
        </div>
        <div className="border-t border-gray-800 px-1">
          <TabBar activeTab={activeTab} onTabChange={onTabChange} variant="dark" />
        </div>
      </header>
      <main className="p-2 space-y-2">{children}</main>
    </div>
  );
}

/** 6 — Ocean blue gradient */
export function OceanLayout({ activeTab, onTabChange, onAddOrder, searchQuery, onSearchChange, children }: LayoutProps) {
  const meta = PAGE_META[activeTab];
  return (
    <div className="min-h-screen bg-sky-50 dark:bg-slate-950">
      <header className="bg-gradient-to-r from-sky-500 via-blue-600 to-blue-700 text-white shadow-lg">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-4 md:px-6">
          <Image
            src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
            alt="Piksel"
            width={100}
            height={32}
            className="h-7 w-auto brightness-0 invert"
          />
          <div className="relative hidden flex-1 max-w-md sm:block">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-200" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Ieškoti..."
              className="w-full rounded-lg border border-white/20 bg-white/15 py-2 pl-9 pr-3 text-sm text-white placeholder:text-sky-200 focus:bg-white/25 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onAddOrder}
            className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-blue-700 shadow hover:bg-sky-50"
          >
            + Naujas
          </button>
        </div>
        <div className="mx-auto max-w-[1400px] border-t border-white/20 px-4 md:px-6">
          <nav className="flex gap-1 overflow-x-auto py-1">
            {APP_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
                  activeTab === tab ? 'bg-white/20 text-white' : 'text-sky-100 hover:bg-white/10'
                }`}
              >
                {PAGE_META[tab].title}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
        <h1 className="text-xl font-semibold text-sky-900 dark:text-sky-100">{meta.title}</h1>
        {children}
      </main>
    </div>
  );
}

/** 7 — Floating cards */
export function CardsLayout({ activeTab, onTabChange, onAddOrder, searchQuery, onSearchChange, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#e8eaed] dark:bg-gray-950">
      <header className="bg-white shadow-sm dark:bg-gray-900">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Image
            src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
            alt="Piksel"
            width={100}
            height={32}
            className="h-7 w-auto dark:invert"
          />
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={onAddOrder}
            className="rounded-full bg-gray-900 px-4 py-2 text-xs font-medium text-white"
          >
            + Naujas
          </button>
        </div>
        <div className="mx-auto max-w-[1400px] px-4 md:px-6">
          <TabBar activeTab={activeTab} onTabChange={onTabChange} variant="pills" />
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6 [&>*]:rounded-2xl [&>*]:shadow-lg [&>*]:shadow-gray-300/40">
        {children}
      </main>
    </div>
  );
}

/** 8 — Icon rail */
export function RailLayout({ activeTab, onTabChange, onAddOrder, children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-gradient-to-b from-violet-600 to-indigo-800 py-4 dark:border-gray-800">
        <Image
          src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
          alt="Piksel"
          width={32}
          height={32}
          className="mb-4 h-7 w-7 rounded object-cover brightness-0 invert"
        />
        {RAIL_NAV.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => onTabChange(id)}
            className={`rounded-lg p-2.5 transition-colors ${
              activeTab === id ? 'bg-white/25 text-white' : 'text-violet-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
        <button
          type="button"
          title="Naujas užsakymas"
          onClick={onAddOrder}
          className="mt-auto rounded-lg bg-white/20 p-2.5 text-white hover:bg-white/30"
        >
          <CalendarDaysIcon className="h-5 w-5" />
        </button>
      </aside>
      <main className="flex-1 space-y-3 overflow-auto p-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{PAGE_META[activeTab].title}</h1>
        {children}
      </main>
    </div>
  );
}

/** 9 — Terminal */
export function TerminalLayout({ activeTab, onTabChange, onAddOrder, searchQuery, onSearchChange, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-black font-mono text-emerald-400">
      <header className="border-b border-emerald-900/60 bg-gray-950 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-emerald-500">piksel@orders</span>
          <span className="text-emerald-700">~</span>
          <div className="relative flex-1 max-w-md">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="grep klientas..."
              className="w-full border-0 bg-transparent text-sm text-emerald-300 placeholder:text-emerald-800 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onAddOrder}
            className="border border-emerald-700 px-2 py-0.5 text-[11px] hover:bg-emerald-950"
          >
            [+] new
          </button>
        </div>
        <nav className="mt-2 flex gap-2 overflow-x-auto text-[11px]">
          {APP_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={activeTab === tab ? 'text-emerald-300 underline' : 'text-emerald-700 hover:text-emerald-500'}
            >
              ./{tab}
            </button>
          ))}
        </nav>
      </header>
      <main className="space-y-2 p-3">{children}</main>
    </div>
  );
}

/** 10 — Warm stone/amber */
export function WarmLayout({ activeTab, onTabChange, onAddOrder, searchQuery, onSearchChange, children }: LayoutProps) {
  const meta = PAGE_META[activeTab];
  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950">
      <header className="border-b border-amber-200/80 bg-gradient-to-b from-amber-50 to-stone-50 dark:border-amber-900/40 dark:from-stone-900 dark:to-stone-950">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-4 md:px-6">
          <Image
            src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
            alt="Piksel"
            width={100}
            height={32}
            className="h-7 w-auto dark:invert"
          />
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-600/60" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Paieška..."
              className="w-full rounded-lg border border-amber-200 bg-white/80 py-2 pl-9 pr-3 text-sm text-stone-800 dark:border-amber-800 dark:bg-stone-900 dark:text-amber-50"
            />
          </div>
          <button
            type="button"
            onClick={onAddOrder}
            className="rounded-lg border border-amber-400 bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            + Pridėti
          </button>
        </div>
        <div className="mx-auto max-w-[1400px] px-4 md:px-6">
          <TabBar activeTab={activeTab} onTabChange={onTabChange} variant="pills" />
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-800 dark:text-amber-50">{meta.title}</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">{meta.description}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
