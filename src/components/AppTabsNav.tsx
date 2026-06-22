'use client';

import type { AppTab } from '@/lib/app-navigation';
import { APP_TABS, PAGE_META } from '@/lib/app-navigation';
import { filterPillActiveClass, filterPillInactiveClass } from '@/lib/portal-ui';

interface AppTabsNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export function AppTabsNav({ activeTab, onTabChange }: AppTabsNavProps) {
  return (
    <nav
      className="mb-4 pl-3 flex flex-wrap gap-x-4 gap-y-1"
      aria-label="Pagrindinė navigacija"
    >
      {APP_TABS.map((tab) => {
        const active = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`py-1.5 text-sm transition-all whitespace-nowrap ${
              active ? filterPillActiveClass : filterPillInactiveClass
            }`}
          >
            {PAGE_META[tab].title}
          </button>
        );
      })}
    </nav>
  );
}
