import { Order, Screen } from '@/types';
import { daysInclusiveBetween, parseDateOnlyLocal } from './date-utils';

/** Dienų skaičius laikotarpyje (nuo iki, imtinai) */
export function getDaysInRange(from: string, to: string): number {
  const start = parseDateOnlyLocal(from);
  const end = parseDateOnlyLocal(to);
  if (!start || !end) return 0;
  return daysInclusiveBetween(start, end);
}

/** Kiek dienų užsakymo laikotarpis kerta su nurodytu mėnesiu */
export function getDaysInMonth(
  orderFrom: string,
  orderTo: string,
  year: number,
  month: number
): number {
  if (!Number.isFinite(month) || month < 1 || month > 12 || !Number.isFinite(year)) {
    return 0;
  }
  const orderStart = parseDateOnlyLocal(orderFrom);
  const orderEnd = parseDateOnlyLocal(orderTo);
  if (!orderStart || !orderEnd) return 0;
  const monthStart = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = new Date(year, month - 1, lastDay);

  const overlapStart = orderStart > monthStart ? orderStart : monthStart;
  const overlapEnd = orderEnd < monthEnd ? orderEnd : monthEnd;

  if (overlapStart > overlapEnd) return 0;
  return daysInclusiveBetween(overlapStart, overlapEnd);
}

/** Ekrano kaina užsakyme: final_price padalinta iš unikalių ekranų skaičiaus */
export function getScreenPriceInOrder(order: Order): number {
  const uniqueScreenCount = new Set(order.screens?.filter(Boolean) || []).size || 1;
  return (Number(order.final_price) || 0) / uniqueScreenCount;
}

/** Pajamos vienam ekranui per dieną: suma / dienų / ekranų */
export function getRevenuePerScreenPerDay(order: Order): number {
  const days = getDaysInRange(order.from, order.to);
  const screenCount = new Set(order.screens?.filter(Boolean) || []).size || 1;
  if (days <= 0 || screenCount <= 0) return 0;
  return (Number(order.final_price) || 0) / days / screenCount;
}

export interface ScreenMonthRevenue {
  screenId: string;
  screenName: string;
  month: number;
  year: number;
  days: number;
  revenue: number;
  orders: { order: Order; daysInMonth: number; screenPrice: number }[];
}

export interface ScreenRevenueSummary {
  screenId: string;
  screenName: string;
  screenCity?: string;
  totalRevenue: number;
  totalDays: number;
  revenuePerDay: number;
  orderCount: number;
  byMonth: ScreenMonthRevenue[];
}

/** Surinkti ekranų pajamas pagal pasirinktą laikotarpį (mėnuo) */
export function calculateScreenRevenues(
  orders: Order[],
  screenNames: Record<string, Screen>,
  filterYear: number,
  filterMonth: number
): ScreenRevenueSummary[] {
  const screenMap = new Map<string, ScreenRevenueSummary>();

  for (const order of orders) {
    if (!order.approved) continue;
    const screenIds = [...new Set(order.screens?.filter(Boolean) || [])];
    if (!screenIds?.length) continue; // Nerodyti užsakymų be priskirtų ekranų
    const totalDays = getDaysInRange(order.from, order.to);
    if (totalDays <= 0) continue;

    for (const screenId of screenIds) {
      const daysInMonth = getDaysInMonth(order.from, order.to, filterYear, filterMonth);

      if (!Number.isFinite(daysInMonth) || daysInMonth <= 0) continue;

      const screenPrice = getScreenPriceInOrder(order);
      const revenueForMonth = (screenPrice / totalDays) * daysInMonth;

      const existing = screenMap.get(screenId);
      const screenName = screenNames[screenId]?.name || `ID: ${screenId.slice(0, 8)}`;
      const screenCity = screenNames[screenId]?.city;

      if (existing) {
        existing.totalRevenue += revenueForMonth;
        existing.totalDays += daysInMonth;
        existing.orderCount += 1;
        existing.byMonth[0].revenue += revenueForMonth;
        existing.byMonth[0].days += daysInMonth;
        existing.byMonth[0].orders.push({ order, daysInMonth, screenPrice });
      } else {
        screenMap.set(screenId, {
          screenId,
          screenName,
          screenCity,
          totalRevenue: revenueForMonth,
          totalDays: daysInMonth,
          revenuePerDay: revenueForMonth / daysInMonth,
          orderCount: 1,
          byMonth: [{
            screenId,
            screenName,
            month: filterMonth,
            year: filterYear,
            days: daysInMonth,
            revenue: revenueForMonth,
            orders: [{ order, daysInMonth, screenPrice }],
          }],
        });
      }
    }
  }

  return Array.from(screenMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export interface RevenueAnalysisPeriod {
  year: number;
  month: number | null;
  startDate: string;
  endDate: string;
}

export function resolveRevenueAnalysisPeriod(month: string, year: string): RevenueAnalysisPeriod {
  const y = parseInt(year, 10) || new Date().getFullYear();

  if (!month.trim()) {
    return {
      year: y,
      month: null,
      startDate: `${y}-01-01`,
      endDate: `${y}-12-31`,
    };
  }

  const m = parseInt(month, 10);
  const monthPadded = month.padStart(2, '0');
  const lastDay = new Date(y, m, 0).getDate();

  return {
    year: y,
    month: m,
    startDate: `${y}-${monthPadded}-01`,
    endDate: `${y}-${monthPadded}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function calculateScreenRevenuesForPeriod(
  orders: Order[],
  screenNames: Record<string, Screen>,
  period: RevenueAnalysisPeriod
): ScreenRevenueSummary[] {
  if (period.month === null) {
    const merged = new Map<string, ScreenRevenueSummary>();
    const orderIdsByScreen = new Map<string, Set<string>>();

    for (let month = 1; month <= 12; month += 1) {
      for (const row of calculateScreenRevenues(orders, screenNames, period.year, month)) {
        const existing = merged.get(row.screenId);
        if (existing) {
          existing.totalRevenue += row.totalRevenue;
          existing.totalDays += row.totalDays;
          existing.byMonth.push(...row.byMonth);
        } else {
          merged.set(row.screenId, {
            ...row,
            byMonth: [...row.byMonth],
          });
          orderIdsByScreen.set(row.screenId, new Set());
        }

        const orderIds = orderIdsByScreen.get(row.screenId)!;
        for (const monthRow of row.byMonth) {
          for (const { order } of monthRow.orders) {
            orderIds.add(order.id);
          }
        }
      }
    }

    for (const [screenId, summary] of merged) {
      summary.orderCount = orderIdsByScreen.get(screenId)?.size ?? 0;
      summary.revenuePerDay =
        summary.totalDays > 0 ? summary.totalRevenue / summary.totalDays : 0;
    }

    return Array.from(merged.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  return calculateScreenRevenues(orders, screenNames, period.year, period.month);
}
