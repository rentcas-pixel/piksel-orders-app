import type { AppTab, InvoicesSubTab } from '@/lib/app-navigation';
import {
  ADMIN_ONLY_APP_TABS,
  APP_TABS,
  STAFF_APP_TABS,
  STAFF_INVOICES_SUB_TABS,
} from '@/lib/app-navigation';

export type AppRole = 'admin' | 'staff';

export function getVisibleAppTabs(role: AppRole): AppTab[] {
  if (role === 'admin') return APP_TABS;
  return STAFF_APP_TABS;
}

export function getVisibleInvoicesSubTabs(role: AppRole): InvoicesSubTab[] {
  if (role === 'admin') return ['issued', 'received', 'balance'];
  return STAFF_INVOICES_SUB_TABS;
}

export function canAccessAppTab(role: AppRole, tab: AppTab): boolean {
  return getVisibleAppTabs(role).includes(tab);
}

export function canAccessInvoicesSubTab(role: AppRole, subTab: InvoicesSubTab): boolean {
  return getVisibleInvoicesSubTabs(role).includes(subTab);
}

/** Bankas, paštas, gautos sąskaitos, balansai — tik admin. */
export function hasAdminFinanceAccess(role: AppRole | null | undefined): boolean {
  return role === 'admin';
}

export function hasIssuedInvoiceAccess(role: AppRole | null | undefined): boolean {
  return role === 'admin' || role === 'staff';
}

export function isAdminOnlyAppTab(tab: AppTab): boolean {
  return ADMIN_ONLY_APP_TABS.includes(tab);
}
