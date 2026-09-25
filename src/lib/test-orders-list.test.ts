import { describe, expect, it } from 'vitest';
import { isTestOrder, type TestOrder } from '@/lib/test-orders';

function order(partial: Partial<TestOrder> & Pick<TestOrder, 'id' | 'client'>): TestOrder {
  return {
    agency: 'Open',
    invoice_id: partial.id.replace(/^test-/, ''),
    approved: false,
    viaduct: false,
    from: '2026-09-21',
    to: '2026-09-27',
    media_received: false,
    final_price: 0,
    invoice_sent: false,
    updated: '2026-09-25T12:00:00.000Z',
    details: { isTest: true },
    ...partial,
    details: { isTest: true, ...partial.details },
  };
}

describe('saved browser test orders', () => {
  it('keeps stored test rows, including priced client names', () => {
    for (const client of ['Radsybos', 'JYSK', 'Tele2-Pro', 'BRC autocentras', 'Polestar']) {
      expect(isTestOrder(order({ id: `test-${client}`, client, final_price: 100 }))).toBe(true);
    }
    expect(isTestOrder(order({ id: 'test-demo-3582', client: 'Circle K' }))).toBe(true);
    expect(isTestOrder({ id: 'pb-1', details: { isTest: false } })).toBe(false);
  });
});
