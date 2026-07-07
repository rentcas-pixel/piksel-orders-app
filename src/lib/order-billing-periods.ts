import { daysInclusiveBetween, parseDateOnlyLocal } from '@/lib/date-utils';
import type { Order } from '@/types';

export interface OrderBillingPeriod {
  id?: string;
  active_from: string;
  active_to: string;
}

export type OrderBillingPeriodsMap = Record<string, OrderBillingPeriod[]>;

export function hasActiveBillingPeriods(
  periods: OrderBillingPeriod[] | null | undefined
): boolean {
  return (periods?.length ?? 0) > 0;
}

export function sortBillingPeriods(periods: OrderBillingPeriod[]): OrderBillingPeriod[] {
  return [...periods].sort((a, b) => {
    const aFrom = parseDateOnlyLocal(a.active_from)?.getTime() ?? 0;
    const bFrom = parseDateOnlyLocal(b.active_from)?.getTime() ?? 0;
    return aFrom - bFrom || a.active_from.localeCompare(b.active_from);
  });
}

export function isDayInActivePeriod(date: Date, periods: OrderBillingPeriod[]): boolean {
  for (const period of periods) {
    const start = parseDateOnlyLocal(period.active_from);
    const end = parseDateOnlyLocal(period.active_to);
    if (!start || !end) continue;
    if (date >= start && date <= end) return true;
  }
  return false;
}

export function isBillableDay(
  date: Date,
  orderFrom: string,
  orderTo: string,
  periods: OrderBillingPeriod[]
): boolean {
  const start = parseDateOnlyLocal(orderFrom);
  const end = parseDateOnlyLocal(orderTo);
  if (!start || !end || date < start || date > end) return false;
  if (!hasActiveBillingPeriods(periods)) return true;
  return isDayInActivePeriod(date, periods);
}

export function countBillableDays(
  orderFrom: string,
  orderTo: string,
  periods: OrderBillingPeriod[]
): number {
  const start = parseDateOnlyLocal(orderFrom);
  const end = parseDateOnlyLocal(orderTo);
  if (!start || !end || start > end) return 0;

  let count = 0;
  const walk = new Date(start);
  while (walk <= end) {
    if (isBillableDay(walk, orderFrom, orderTo, periods)) count++;
    walk.setDate(walk.getDate() + 1);
  }
  return count;
}

export function getBillableDaysInMonth(
  orderFrom: string,
  orderTo: string,
  year: number,
  month: number,
  periods: OrderBillingPeriod[]
): number {
  if (!Number.isFinite(month) || month < 1 || month > 12 || !Number.isFinite(year)) return 0;

  const orderStart = parseDateOnlyLocal(orderFrom);
  const orderEnd = parseDateOnlyLocal(orderTo);
  if (!orderStart || !orderEnd) return 0;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const overlapStart = orderStart > monthStart ? orderStart : monthStart;
  const overlapEnd = orderEnd < monthEnd ? orderEnd : monthEnd;
  if (overlapStart > overlapEnd) return 0;

  let count = 0;
  const walk = new Date(overlapStart);
  while (walk <= overlapEnd) {
    if (isBillableDay(walk, orderFrom, orderTo, periods)) count++;
    walk.setDate(walk.getDate() + 1);
  }
  return count;
}

export function getBillableMonthlyDistribution(
  orderFrom: string,
  orderTo: string,
  totalAmount: number,
  periods: OrderBillingPeriod[]
): Array<{ month: number; year: number; days: number; amount: number }> {
  if (!orderFrom || !orderTo || !totalAmount) return [];

  const start = parseDateOnlyLocal(orderFrom);
  const end = parseDateOnlyLocal(orderTo);
  if (!start || !end || start > end) return [];

  const totalBillableDays = countBillableDays(orderFrom, orderTo, periods);
  if (totalBillableDays <= 0) return [];

  const buckets = new Map<string, { month: number; year: number; days: number }>();
  const walk = new Date(start);
  while (walk <= end) {
    if (isBillableDay(walk, orderFrom, orderTo, periods)) {
      const year = walk.getFullYear();
      const month = walk.getMonth() + 1;
      const key = `${year}-${month}`;
      const entry = buckets.get(key) ?? { month, year, days: 0 };
      entry.days++;
      buckets.set(key, entry);
    }
    walk.setDate(walk.getDate() + 1);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((entry) => ({
      ...entry,
      amount: Math.round((entry.days / totalBillableDays) * totalAmount * 100) / 100,
    }));
}

export function billablePeriodInMonth(
  orderFrom: string,
  orderTo: string,
  year: number,
  month: number,
  periods: OrderBillingPeriod[]
): { from: string; to: string } | null {
  const orderStart = parseDateOnlyLocal(orderFrom);
  const orderEnd = parseDateOnlyLocal(orderTo);
  if (!orderStart || !orderEnd) return null;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const overlapStart = orderStart > monthStart ? orderStart : monthStart;
  const overlapEnd = orderEnd < monthEnd ? orderEnd : monthEnd;
  if (overlapStart > overlapEnd) return null;

  let first: Date | null = null;
  let last: Date | null = null;
  const walk = new Date(overlapStart);
  while (walk <= overlapEnd) {
    if (isBillableDay(walk, orderFrom, orderTo, periods)) {
      if (!first) first = new Date(walk);
      last = new Date(walk);
    }
    walk.setDate(walk.getDate() + 1);
  }
  if (!first || !last) return null;

  const formatLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    from: formatLocal(first),
    to: formatLocal(last),
  };
}

export function orderHasBillableDaysInMonth(
  order: Order,
  month: string,
  year: string,
  periods?: OrderBillingPeriod[] | null
): boolean {
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  if (!month || !year || Number.isNaN(monthNum) || Number.isNaN(yearNum)) return false;
  if (!order.from || !order.to) return false;

  if (hasActiveBillingPeriods(periods)) {
    return getBillableDaysInMonth(order.from, order.to, yearNum, monthNum, periods!) > 0;
  }

  const orderStart = parseDateOnlyLocal(order.from);
  const orderEnd = parseDateOnlyLocal(order.to);
  if (!orderStart || !orderEnd) return false;
  const monthStart = new Date(yearNum, monthNum - 1, 1);
  const monthEnd = new Date(yearNum, monthNum, 0);
  return orderStart <= monthEnd && orderEnd >= monthStart;
}

export function orderVisibleInBillingMonth(
  order: Order,
  month: string,
  year: string,
  periods?: OrderBillingPeriod[] | null
): boolean {
  return orderMatchesBillingPeriodFilter(order, month, year, periods);
}

export function orderMatchesBillingPeriodFilter(
  order: Order,
  month: string,
  year: string,
  periods?: OrderBillingPeriod[] | null
): boolean {
  const monthNum = month ? parseInt(month, 10) : NaN;
  const yearNum = year ? parseInt(year, 10) : NaN;
  if (!year || Number.isNaN(yearNum)) return true;
  if (!order.from || !order.to) return false;

  if (hasActiveBillingPeriods(periods)) {
    if (month && !Number.isNaN(monthNum)) {
      return orderHasBillableDaysInMonth(order, month, year, periods);
    }
    for (let m = 1; m <= 12; m++) {
      if (getBillableDaysInMonth(order.from, order.to, yearNum, m, periods!) > 0) return true;
    }
    return false;
  }

  const orderStart = parseDateOnlyLocal(order.from);
  const orderEnd = parseDateOnlyLocal(order.to);
  if (!orderStart || !orderEnd) return false;

  if (month && !Number.isNaN(monthNum)) {
    const monthStart = new Date(yearNum, monthNum - 1, 1);
    const monthEnd = new Date(yearNum, monthNum, 0);
    return orderStart <= monthEnd && orderEnd >= monthStart;
  }

  const yearStart = new Date(yearNum, 0, 1);
  const yearEnd = new Date(yearNum, 11, 31);
  return orderStart <= yearEnd && orderEnd >= yearStart;
}

export function validateBillingPeriods(
  periods: OrderBillingPeriod[],
  orderFrom: string,
  orderTo: string
): string | null {
  const orderStart = parseDateOnlyLocal(orderFrom);
  const orderEnd = parseDateOnlyLocal(orderTo);
  if (!orderStart || !orderEnd || orderStart > orderEnd) {
    return 'Nurodykite teisingą užsakymo periodą.';
  }

  const parsed = periods.map((period) => ({
    from: parseDateOnlyLocal(period.active_from),
    to: parseDateOnlyLocal(period.active_to),
  }));

  for (const { from, to } of parsed) {
    if (!from || !to) return 'Kiekvienam periodui nurodykite pradžios ir pabaigos datą.';
    if (from > to) return 'Periodas: pradžia negali būti vėliau už pabaigos.';
    if (from < orderStart || to > orderEnd) {
      return 'Aktyvūs periodai turi būti kampanijos periodo ribose.';
    }
  }

  const sorted = [...parsed].sort((a, b) => a.from!.getTime() - b.from!.getTime());
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].from! <= sorted[i - 1].to!) {
      return 'Aktyvūs periodai negali persidengti.';
    }
  }

  return null;
}

export function orderSupportsBillingPeriods(order: Pick<Order, 'from' | 'to'>): boolean {
  if (!order.from || !order.to) return false;
  const start = parseDateOnlyLocal(order.from);
  const end = parseDateOnlyLocal(order.to);
  if (!start || !end || start >= end) return false;
  return daysInclusiveBetween(start, end) > 1;
}

/** Ar užsakymas turi nestandartinį sąskaitavimą (aktyvūs periodai neužpildo visos kampanijos). */
export function orderHasNonContinuousBilling(
  order: Pick<Order, 'from' | 'to'>,
  periods: OrderBillingPeriod[] | null | undefined
): boolean {
  if (!hasActiveBillingPeriods(periods) || !order.from || !order.to) return false;
  const campaignDays = countBillableDays(order.from, order.to, []);
  const activeDays = countBillableDays(order.from, order.to, periods!);
  return activeDays < campaignDays;
}
