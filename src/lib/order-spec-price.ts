import type { Order } from '@/types';
import { roundOrderPrice } from '@/lib/order-price';

export type OrderSpecPriceMap = Record<string, number>;

export function applySpecPricesToOrders(
  orders: Order[],
  specPriceMap: OrderSpecPriceMap
): Order[] {
  if (Object.keys(specPriceMap).length === 0) return orders;

  return orders.map((order) => applySpecPriceToOrder(order, specPriceMap));
}

export function applySpecPriceToOrder(order: Order, specPriceMap: OrderSpecPriceMap): Order {
  const manualPrice = specPriceMap[order.id];
  if (typeof manualPrice !== 'number' || manualPrice <= 0) {
    return order.is_spec_order ? { ...order, is_spec_order: false } : order;
  }

  return {
    ...order,
    final_price: roundOrderPrice(manualPrice),
    is_spec_order: true,
  };
}

export function isSpecOrder(order: Pick<Order, 'id' | 'is_spec_order'>, specPriceMap?: OrderSpecPriceMap): boolean {
  if (order.is_spec_order) return true;
  if (!specPriceMap) return false;
  const price = specPriceMap[order.id];
  return typeof price === 'number' && price > 0;
}
