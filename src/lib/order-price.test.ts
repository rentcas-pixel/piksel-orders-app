import { describe, expect, it } from 'vitest';
import {
  normalizeOrder,
  orderPriceNeedsPersistSync,
  resolveOrderPrice,
} from '@/lib/order-price';
import type { Order } from '@/types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    client: 'Client',
    agency: 'Agency',
    invoice_id: '4613',
    approved: false,
    viaduct: false,
    from: '2026-07-01',
    to: '2026-07-01',
    media_received: false,
    final_price: 206.35,
    invoice_sent: false,
    updated: '2026-07-01',
    ...overrides,
  };
}

describe('order-price', () => {
  it('prefers details.total over stale final_price', () => {
    const order = makeOrder({
      final_price: 206.35,
      details: { total: 185.41, finalPrice: 201.53 },
    });

    expect(resolveOrderPrice(order)).toBe(185.41);
    expect(normalizeOrder(order).final_price).toBe(185.41);
  });

  it('falls back to final_price when details.total is missing', () => {
    const order = makeOrder({
      final_price: 150,
      details: { finalPrice: 201.53 },
    });

    expect(resolveOrderPrice(order)).toBe(150);
  });

  it('detects when PocketBase final_price should be synced', () => {
    const order = makeOrder({
      final_price: 206.35,
      details: { total: 185.41 },
    });

    expect(orderPriceNeedsPersistSync(order)).toEqual({
      needed: true,
      canonicalPrice: 185.41,
    });
  });

  it('skips persist sync when prices already match', () => {
    const order = makeOrder({
      final_price: 185.41,
      details: { total: 185.41 },
    });

    expect(orderPriceNeedsPersistSync(order)).toEqual({
      needed: false,
      canonicalPrice: 185.41,
    });
  });

  it('uses spec manual price and skips calculator sync', () => {
    const order = makeOrder({
      final_price: 206.35,
      details: { total: 185.41 },
    });
    const specMap = { 'order-1': 850 };

    expect(normalizeOrder(order, specMap)).toMatchObject({
      final_price: 850,
      is_spec_order: true,
    });
    expect(orderPriceNeedsPersistSync(order, specMap)).toEqual({
      needed: false,
      canonicalPrice: 850,
    });
  });
});
