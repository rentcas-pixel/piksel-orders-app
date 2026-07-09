import type { Order } from '@/types';
import { isSpecOrder, type OrderSpecPriceMap } from '@/lib/order-spec-price';

const PRICE_EPSILON = 0.01;

export function roundOrderPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Kainos šaltinis: skaičiuoklės details.total → final_price → details.finalPrice */
export function resolveOrderPrice(order: Pick<Order, 'final_price' | 'details'>): number {
  const detailsTotal = order.details?.total;
  if (typeof detailsTotal === 'number' && detailsTotal > 0) {
    return roundOrderPrice(detailsTotal);
  }

  const finalPrice = Number(order.final_price);
  if (finalPrice > 0) {
    return roundOrderPrice(finalPrice);
  }

  const detailsFinalPrice = order.details?.finalPrice;
  if (typeof detailsFinalPrice === 'number' && detailsFinalPrice > 0) {
    return roundOrderPrice(detailsFinalPrice);
  }

  return 0;
}

export function orderPriceNeedsPersistSync(
  order: Order,
  specPriceMap?: OrderSpecPriceMap
): {
  needed: boolean;
  canonicalPrice: number;
} {
  if (isSpecOrder(order, specPriceMap)) {
    const manual = specPriceMap?.[order.id] ?? order.final_price;
    return { needed: false, canonicalPrice: roundOrderPrice(Number(manual) || 0) };
  }

  const hasDetailsTotal =
    typeof order.details?.total === 'number' && order.details.total > 0;
  const canonicalPrice = resolveOrderPrice(order);
  const storedPrice = roundOrderPrice(Number(order.final_price) || 0);

  return {
    needed:
      hasDetailsTotal && Math.abs(canonicalPrice - storedPrice) >= PRICE_EPSILON,
    canonicalPrice,
  };
}

/** Atnaujina final_price atmintyje pagal details.total (rodymui be refresh). */
export function normalizeOrder(order: Order, specPriceMap?: OrderSpecPriceMap): Order {
  if (isSpecOrder(order, specPriceMap)) {
    const manual = specPriceMap?.[order.id] ?? order.final_price;
    return {
      ...order,
      final_price: roundOrderPrice(Number(manual) || 0),
      is_spec_order: true,
    };
  }

  const resolved = resolveOrderPrice(order);
  const stored = roundOrderPrice(Number(order.final_price) || 0);

  if (Math.abs(resolved - stored) < PRICE_EPSILON) {
    return order;
  }

  return { ...order, final_price: resolved };
}

export function normalizeOrders(orders: Order[], specPriceMap?: OrderSpecPriceMap): Order[] {
  return orders.map((order) => normalizeOrder(order, specPriceMap));
}
