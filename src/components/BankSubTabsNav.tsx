'use client';

import { BuildingLibraryIcon, ChartBarIcon, ScaleIcon } from '@heroicons/react/24/outline';
import { FilterTabGroup } from '@/components/FilterTabGroup';
import { BANK_SUB_TABS, type BankSubTab } from '@/lib/app-navigation';

interface BankSubTabsNavProps {
  value: BankSubTab;
  onChange: (tab: BankSubTab) => void;
}

const BANK_SUB_TAB_OPTIONS = BANK_SUB_TABS.map((tab) => ({
  ...tab,
  ...(tab.value === 'dashboard' ? { icon: ChartBarIcon } : {}),
  ...(tab.value === 'income' ? { icon: BuildingLibraryIcon } : {}),
  ...(tab.value === 'balance' ? { icon: ScaleIcon } : {}),
}));

export function BankSubTabsNav({ value, onChange }: BankSubTabsNavProps) {
  return (
    <div className="mb-4">
      <FilterTabGroup
        label="Banko kryptis"
        value={value}
        options={BANK_SUB_TAB_OPTIONS}
        onChange={onChange}
      />
    </div>
  );
}
