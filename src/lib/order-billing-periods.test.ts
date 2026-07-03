import { describe, expect, it } from 'vitest';
import type { Order } from '@/types';
import {
  countBillableDays,
  getBillableDaysInMonth,
  getBillableMonthlyDistribution,
  hasActiveBillingPeriods,
  orderMatchesBillingPeriodFilter,
  validateBillingPeriods,
} from '@/lib/order-billing-periods';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    client: 'Client',
    agency: 'Agency',
    invoice_id: '5000',
    approved: true,
    viaduct: false,
    from: '2026-04-01',
    to: '2026-10-16',
    media_received: false,
    final_price: 3000,
    invoice_sent: false,
    updated: '2026-01-01',
    ...overrides,
  };
}

const samplePeriods = [
  { active_from: '2026-04-01', active_to: '2026-05-15' },
  { active_from: '2026-05-31', active_to: '2026-09-15' },
  { active_from: '2026-09-26', active_to: '2026-10-16' },
];

describe('order billing periods', () => {
  it('detects active billing periods', () => {
    expect(hasActiveBillingPeriods([])).toBe(false);
    expect(hasActiveBillingPeriods(samplePeriods)).toBe(true);
  });

  it('counts only active days', () => {
    expect(countBillableDays('2026-04-01', '2026-10-16', [])).toBe(199);
    expect(countBillableDays('2026-04-01', '2026-10-16', samplePeriods)).toBe(199 - 15 - 10);
  });

  it('shows months with active days only', () => {
    const order = makeOrder();
    expect(getBillableDaysInMonth(order.from, order.to, 2026, 5, samplePeriods)).toBe(16);
    expect(orderMatchesBillingPeriodFilter(order, '05', '2026', samplePeriods)).toBe(true);
  });

  it('distributes amount across active days only', () => {
    const distribution = getBillableMonthlyDistribution(
      '2026-04-01',
      '2026-10-16',
      3000,
      samplePeriods
    );
    const total = distribution.reduce((sum, entry) => sum + entry.amount, 0);
    expect(Math.abs(total - 3000)).toBeLessThan(0.05);
  });

  it('validates periods inside campaign bounds', () => {
    expect(validateBillingPeriods(samplePeriods, '2026-04-01', '2026-10-16')).toBeNull();
    expect(
      validateBillingPeriods(
        [{ active_from: '2026-03-01', active_to: '2026-03-05' }],
        '2026-04-01',
        '2026-10-16'
      )
    ).toContain('ribose');
  });
});
