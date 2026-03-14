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

/** Ekrano kaina užsakyme: iš details.screenPrices arba lygiai padalinta final_price */
export function getScreenPriceInOrder(order: Order, screenId: string): number {
  const screenPrices = order.details?.screenPrices;
  if (screenPrices && typeof screenPrices[screenId] === 'number') {
    return screenPrices[screenId];
  }
  const screens = order.screens?.length || 1;
  return order.final_price / screens;
}

/** Pajamos vienam ekranui per dieną: suma / dienų / ekranų */
export function getRevenuePerScreenPerDay(order: Order): number {
  const days = getDaysInRange(order.from, order.to);
  const screenCount = order.screens?.length || 1;
  if (days <= 0 || screenCount <= 0) return 0;
  return order.final_price / days / screenCount;
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
    const screenIds = order.screens?.filter(Boolean);
    if (!screenIds?.length) continue; // Nerodyti užsakymų be priskirtų ekranų
    const totalDays = getDaysInRange(order.from, order.to);
    if (totalDays <= 0) continue;

    for (const screenId of screenIds) {
      const daysInMonth = getDaysInMonth(order.from, order.to, filterYear, filterMonth);

      if (daysInMonth <= 0) continue;

      const screenPrice = getScreenPriceInOrder(order, screenId);
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
