'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  BeakerIcon,
  BuildingLibraryIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  ClockIcon,
  ComputerDesktopIcon,
  DocumentTextIcon,
  PhotoIcon,
  QueueListIcon,
  SignalIcon,
  TvIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { useAppSession } from '@/hooks/useAppSession';
import { PAGE_META, appTabHref, parseAppTab, type AppTab } from '@/lib/app-navigation';
import { PlayInboxBadge } from '@/components/PlayInbox';
import { PLAY_WORK_LINKS } from '@/lib/play-nav';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const WORK_ICONS: Record<string, Icon> = {
  '/test-orders': BeakerIcon,
  '/monitoring': SignalIcon,
  '/devices': TvIcon,
  '/media': PhotoIcon,
};

const TAB_ICONS: Record<AppTab, Icon> = {
  orders: QueueListIcon,
  invoices: DocumentTextIcon,
  bank: BuildingLibraryIcon,
  revenue: ComputerDesktopIcon,
  partners: UserGroupIcon,
  agencies: BuildingOffice2Icon,
  latest: ClockIcon,
  analytics: ChartBarIcon,
};

function navItemClass(active: boolean) {
  return [
    'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
    active
      ? 'bg-gray-100 font-medium text-gray-900 dark:bg-gray-700 dark:text-white'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/60 dark:hover:text-white',
  ].join(' ');
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const { session } = useAppSession();
  const onHome = pathname === '/';
  const homeTab = onHome ? parseAppTab(searchParams.get('tab')) || 'orders' : null;

  return (
    <>
      <div className="px-4 pb-4 pt-5">
        <Link href="/" onClick={onNavigate} className="flex items-center">
          <Image
            src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
            alt="Piksel"
            width={160}
            height={52}
            className="h-8 w-auto dark:invert"
            priority
          />
        </Link>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6" aria-label="Play meniu">
        <div>
          <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Sandbox
          </p>
          <div className="space-y-0.5">
            {session?.role === 'admin' && <Link href="/inbox" onClick={onNavigate} className={navItemClass(pathname === '/inbox')}>
              <DocumentTextIcon className="h-4 w-4 shrink-0" aria-hidden /> Inbox <PlayInboxBadge />
            </Link>}
            {PLAY_WORK_LINKS.map((item) => {
              const Icon = WORK_ICONS[item.href] ?? QueueListIcon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={navItemClass(active)}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        {session && (
          <div>
            <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Portalas
            </p>
            <div className="space-y-0.5">
              {session.visibleTabs.map((tab) => {
                const Icon = TAB_ICONS[tab];
                const active = homeTab === tab;
                return (
                  <Link
                    key={tab}
                    href={appTabHref(tab)}
                    scroll={false}
                    onClick={onNavigate}
                    className={navItemClass(active)}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {PAGE_META[tab].title}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}

interface PlaySidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function PlaySidebar({ mobileOpen, onClose }: PlaySidebarProps) {
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 lg:flex">
        <SidebarNav />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Uždaryti meniu"
            onClick={onClose}
          />
          <aside className="relative flex h-full w-56 flex-col bg-white shadow-xl dark:bg-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2 top-3 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Uždaryti meniu"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <SidebarNav onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
