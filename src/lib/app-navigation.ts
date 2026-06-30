export type AppTab = 'orders' | 'invoices' | 'bank' | 'email' | 'revenue' | 'partners' | 'agencies' | 'analytics' | 'latest';

export type InvoicesSubTab = 'issued' | 'received' | 'balance';

export type BankSubTab = 'dashboard' | 'income' | 'expense' | 'balance';

export const BANK_SUB_TABS: { value: BankSubTab; label: string }[] = [
  { value: 'income', label: 'Gauta' },
  { value: 'expense', label: 'Išleista' },
  { value: 'balance', label: 'Balansas' },
  { value: 'dashboard', label: 'Apžvalga' },
];

export const INVOICES_SUB_TABS: { value: InvoicesSubTab; label: string }[] = [
  { value: 'issued', label: 'Išrašytos' },
  { value: 'received', label: 'Gautos' },
  { value: 'balance', label: 'Balansas' },
];

export const PAGE_META: Record<AppTab, { title: string; description: string }> = {
  orders: {
    title: 'Užsakymai',
    description: 'Valdykite reklamos užsakymus, statusus ir sąskaitas.',
  },
  invoices: {
    title: 'Sąskaitos',
    description: 'Išrašytos, gautos sąskaitos ir balansas.',
  },
  bank: {
    title: 'Bankas',
    description: 'Banko pavedimai, apžvalga, sudengimas ir balansas.',
  },
  email: {
    title: 'Paštas',
    description: 'AI el. pašto asistentas — laiškų analizė ir atsakymai.',
  },
  revenue: {
    title: 'Ekranų pajamos',
    description: 'Pajamos pagal ekranus ir pasirinktą laikotarpį.',
  },
  partners: {
    title: 'Partneriai',
    description: 'Partnerių pajamų suvestinė.',
  },
  agencies: {
    title: 'Agentūros',
    description: 'Agentūrų užsakymų ir sumų analizė.',
  },
  latest: {
    title: 'Naujausi',
    description: 'Neseniai patvirtinti užsakymai.',
  },
  analytics: {
    title: 'Analizė',
    description: 'KPI ir tendencijos pagal užsakymus.',
  },
};

export const APP_TABS: AppTab[] = ['orders', 'revenue', 'partners', 'agencies', 'latest', 'analytics', 'invoices', 'bank'];

export const STAFF_APP_TABS: AppTab[] = [
  'orders',
  'revenue',
  'partners',
  'agencies',
  'latest',
  'analytics',
  'invoices',
];

export const ADMIN_ONLY_APP_TABS: AppTab[] = ['bank'];

export const STAFF_INVOICES_SUB_TABS: InvoicesSubTab[] = ['issued'];

export const ADMIN_ONLY_INVOICES_SUB_TABS: InvoicesSubTab[] = ['received', 'balance'];

export interface AppBreadcrumbSegment {
  label: string;
}

export function getAppBreadcrumb(
  activeTab: AppTab,
  options?: {
    invoicesSubTab?: InvoicesSubTab;
    bankSubTab?: BankSubTab;
    ordersViewMode?: 'list' | 'calendar';
  }
): AppBreadcrumbSegment[] {
  const segments: AppBreadcrumbSegment[] = [{ label: PAGE_META[activeTab].title }];

  if (activeTab === 'invoices' && options?.invoicesSubTab) {
    const sub = INVOICES_SUB_TABS.find((tab) => tab.value === options.invoicesSubTab);
    if (sub) segments.push({ label: sub.label });
  }

  if (activeTab === 'bank' && options?.bankSubTab) {
    const sub = BANK_SUB_TABS.find((tab) => tab.value === options.bankSubTab);
    if (sub) segments.push({ label: sub.label });
  }

  if (activeTab === 'orders' && options?.ordersViewMode === 'calendar') {
    segments.push({ label: 'Kalendorius' });
  }

  return segments;
}
