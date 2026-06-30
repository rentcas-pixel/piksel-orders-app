'use client';

import { ScaleIcon } from '@heroicons/react/24/outline';
import { FilterTabGroup } from '@/components/FilterTabGroup';
import { INVOICES_SUB_TABS, type InvoicesSubTab } from '@/lib/app-navigation';

interface InvoicesSubTabsNavProps {
  value: InvoicesSubTab;
  visibleSubTabs: InvoicesSubTab[];
  onChange: (tab: InvoicesSubTab) => void;
}

export function InvoicesSubTabsNav({ value, visibleSubTabs, onChange }: InvoicesSubTabsNavProps) {
  const options = INVOICES_SUB_TABS.filter((tab) => visibleSubTabs.includes(tab.value)).map(
    (tab) => ({
      ...tab,
      ...(tab.value === 'balance' ? { icon: ScaleIcon } : {}),
    })
  );

  return (
    <div className="mb-4">
      <FilterTabGroup
        label="Sąskaitų tipas"
        value={value}
        options={options}
        onChange={onChange}
      />
    </div>
  );
}
