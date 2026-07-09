import { describe, expect, it } from 'vitest';
import type { Order } from '@/types';
import {
  countBillableDays,
  filterOrdersForPeriodTab,
  getBillableDaysInMonth,
  getBillableMonthlyDistribution,
  hasActiveBillingPeriods,
  orderMatchesBillingPeriodFilter,
  orderMatchesCurrentPeriodTab,
  orderMatchesFuturePeriodTab,
  orderMatchesPastPeriodTab,
  orderHasNonContinuousBilling,
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

  it('detects non-continuous billing vs full campaign', () => {
    const order = makeOrder();
    expect(orderHasNonContinuousBilling(order, [])).toBe(false);
    expect(orderHasNonContinuousBilling(order, samplePeriods)).toBe(true);
    expect(
      orderHasNonContinuousBilling(order, [
        { active_from: '2026-04-01', active_to: '2026-10-16' },
      ])
    ).toBe(false);
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

  it('matches current tab only on active split days', () => {
    const order = makeOrder({ from: '2026-05-04', to: '2026-12-27' });
    const splitPeriods = [
      { active_from: '2026-05-04', active_to: '2026-05-10' },
      { active_from: '2026-11-09', active_to: '2026-12-27' },
    ];
    const may5 = new Date(2026, 4, 5);
    const july9 = new Date(2026, 6, 9);
    const nov10 = new Date(2026, 10, 10);
    const jan1_2027 = new Date(2027, 0, 1);

    expect(orderMatchesCurrentPeriodTab(order, splitPeriods, may5)).toBe(true);
    expect(orderMatchesCurrentPeriodTab(order, splitPeriods, july9)).toBe(false);
    expect(orderMatchesCurrentPeriodTab(order, splitPeriods, nov10)).toBe(true);
    expect(orderMatchesCurrentPeriodTab(order, [], july9)).toBe(true);

    expect(orderMatchesFuturePeriodTab(order, splitPeriods, july9)).toBe(true);
    expect(orderMatchesFuturePeriodTab(order, splitPeriods, may5)).toBe(false);
    expect(orderMatchesFuturePeriodTab(order, splitPeriods, nov10)).toBe(false);
    expect(orderMatchesFuturePeriodTab(order, [], july9)).toBe(false);

    expect(orderMatchesPastPeriodTab(order, splitPeriods, jan1_2027)).toBe(true);
    expect(orderMatchesPastPeriodTab(order, splitPeriods, july9)).toBe(false);
    expect(orderMatchesPastPeriodTab(order, splitPeriods, may5)).toBe(false);

    const currentFiltered = filterOrdersForPeriodTab(
      [order],
      'current',
      { [order.id]: splitPeriods },
      july9
    );
    expect(currentFiltered).toHaveLength(0);

    const futureFiltered = filterOrdersForPeriodTab(
      [order],
      'future',
      { [order.id]: splitPeriods },
      july9
    );
    expect(futureFiltered).toHaveLength(1);
  });
});
