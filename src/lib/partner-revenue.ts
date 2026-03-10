import { Order, Screen, Partner } from '@/types';
import { getDaysInRange, getDaysInMonth, getScreenPriceInOrder } from './screen-revenue';

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
    const screenIds = order.screens?.filter(Boolean);
    if (!screenIds?.length) continue;

    const totalDays = getDaysInRange(order.from, order.to);
    if (totalDays <= 0) continue;

    const daysInMonth = getDaysInMonth(order.from, order.to, filterYear, filterMonth);
    if (daysInMonth <= 0) continue;

    const partnerAmounts = new Map<string, number>();

    for (const screenId of screenIds) {
      const screen = screensWithPartner[screenId];
      const partnerId = screen?.partner;
      if (!partnerId) continue;

      const screenPrice = getScreenPriceInOrder(order, screenId);
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
