import { Order, Screen, Partner } from '@/types';
import {
  getDaysInRange,
  getDaysInMonth,
  type RevenueAnalysisPeriod,
} from './screen-revenue';

export interface PartnerRevenueSummary {
  partnerId: string;
  partnerName: string;
  totalRevenue: number;
  totalDays: number;
  orderCount: number;
  orders: { order: Order; daysInMonth: number; amount: number }[];
}

/** Surinkti partnerių pajamas pagal pasirinktą mėnesį */
export function calculatePartnerRevenues(
  orders: Order[],
  screensWithPartner: Record<string, Screen>,
  partners: Partner[],
  filterYear: number,
  filterMonth: number
): PartnerRevenueSummary[] {
  const partnerMap = new Map<string, PartnerRevenueSummary>();
  const partnerNames = new Map(partners.map(p => [p.id, p.name]));

  for (const order of orders) {
    if (!order.approved) continue;
    const screenIds = [...new Set(order.screens?.filter(Boolean) || [])];
    if (!screenIds?.length) continue;

    const totalDays = getDaysInRange(order.from, order.to);
    if (totalDays <= 0) continue;

    const daysInMonth = getDaysInMonth(order.from, order.to, filterYear, filterMonth);
    if (!Number.isFinite(daysInMonth) || daysInMonth <= 0) continue;

    const partnerAmounts = new Map<string, number>();

    for (const screenId of screenIds) {
      const screen = screensWithPartner[screenId];
      const partnerId = screen?.partner;
      if (!partnerId) continue;

      // Partner split must be based on final order amount distributed by screen count.
      const screenPrice = (Number(order.final_price) || 0) / screenIds.length;
      const revenueForMonth = (screenPrice / totalDays) * daysInMonth;

      partnerAmounts.set(partnerId, (partnerAmounts.get(partnerId) || 0) + revenueForMonth);
    }

    for (const [partnerId, amount] of partnerAmounts) {
      const partnerName = partnerNames.get(partnerId) || `ID: ${partnerId.slice(0, 8)}`;
      const existing = partnerMap.get(partnerId);

      if (existing) {
        existing.totalRevenue += amount;
        existing.totalDays += daysInMonth;
        existing.orderCount += 1;
        existing.orders.push({ order, daysInMonth, amount });
      } else {
        partnerMap.set(partnerId, {
          partnerId,
          partnerName,
          totalRevenue: amount,
          totalDays: daysInMonth,
          orderCount: 1,
          orders: [{ order, daysInMonth, amount }],
        });
      }
    }
  }

  return Array.from(partnerMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export function calculatePartnerRevenuesForPeriod(
  orders: Order[],
  screensWithPartner: Record<string, Screen>,
  partners: Partner[],
  period: RevenueAnalysisPeriod
): PartnerRevenueSummary[] {
  if (period.month === null) {
    const merged = new Map<string, PartnerRevenueSummary>();
    const orderIdsByPartner = new Map<string, Set<string>>();

    for (let month = 1; month <= 12; month += 1) {
      for (const row of calculatePartnerRevenues(
        orders,
        screensWithPartner,
        partners,
        period.year,
        month
      )) {
        const existing = merged.get(row.partnerId);
        if (existing) {
          existing.totalRevenue += row.totalRevenue;
          existing.totalDays += row.totalDays;
          existing.orders.push(...row.orders);
        } else {
          merged.set(row.partnerId, {
            ...row,
            orders: [...row.orders],
          });
          orderIdsByPartner.set(row.partnerId, new Set());
        }

        const orderIds = orderIdsByPartner.get(row.partnerId)!;
        for (const { order } of row.orders) {
          orderIds.add(order.id);
        }
      }
    }

    for (const [partnerId, summary] of merged) {
      summary.orderCount = orderIdsByPartner.get(partnerId)?.size ?? 0;
    }

    return Array.from(merged.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  return calculatePartnerRevenues(
    orders,
    screensWithPartner,
    partners,
    period.year,
    period.month
  );
}
