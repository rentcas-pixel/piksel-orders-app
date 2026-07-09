import { describe, expect, it } from 'vitest';
import { applySpecPriceToOrder, applySpecPricesToOrders } from '@/lib/order-spec-price';
import type { Order } from '@/types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    client: 'Client',
    agency: 'Agency',
    invoice_id: '100',
    approved: true,
    viaduct: false,
    from: '2026-07-01',
    to: '2026-07-31',
    media_received: false,
    final_price: 200,
    invoice_sent: false,
    updated: '2026-07-01',
    details: { total: 185.41 },
    ...overrides,
  };
}

describe('order-spec-price', () => {
  it('overrides final_price from spec map', () => {
    const order = makeOrder();
    const result = applySpecPriceToOrder(order, { 'order-1': 850 });

    expect(result.final_price).toBe(850);
    expect(result.is_spec_order).toBe(true);
    expect(result.details?.total).toBe(185.41);
  });

  it('leaves non-spec orders unchanged', () => {
    const order = makeOrder();
    const result = applySpecPricesToOrders([order], {});

    expect(result[0].final_price).toBe(200);
    expect(result[0].is_spec_order).toBeFalsy();
  });
});
