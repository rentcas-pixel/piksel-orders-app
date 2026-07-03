import { describe, expect, it } from 'vitest';
import {
  billingMonthDateRange,
  buildMonthStatusMap,
  invoiceMatchesBillingMonth,
  monthFlagKey,
  nextInvoiceStatusOnToggle,
  periodCoversBillingMonth,
  periodsOverlap,
} from '@/lib/invoice-month-status';
import type { Order, OrderInvoiceStatus } from '@/types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    client: 'BTA',
    agency: 'Agency',
    invoice_id: '4479',
    approved: true,
    viaduct: false,
    from: '2026-01-10',
    to: '2026-02-20',
    media_received: false,
    final_price: 1000,
    invoice_sent: false,
    updated: '2026-01-01',
    ...overrides,
  };
}

function makeLegacyStatus(
  orderId: string,
  patch: Partial<Pick<OrderInvoiceStatus, 'invoice_issued' | 'invoice_sent'>> = {}
): OrderInvoiceStatus {
  return {
    order_id: orderId,
    invoice_issued: false,
    invoice_sent: false,
    updated: '2026-01-01T00:00:00.000Z',
    ...patch,
  };
}

describe('billingMonthDateRange', () => {
  it('returns first and last day of month', () => {
    expect(billingMonthDateRange('2026', '2')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('returns null for invalid month', () => {
    expect(billingMonthDateRange('2026', '')).toBeNull();
    expect(billingMonthDateRange('2026', '13')).toBeNull();
  });
});

describe('periodsOverlap', () => {
  it('detects overlapping ranges', () => {
    expect(periodsOverlap('2026-01-15', '2026-02-10', '2026-02-01', '2026-02-28')).toBe(
      true
    );
    expect(periodsOverlap('2026-03-01', '2026-03-31', '2026-02-01', '2026-02-28')).toBe(
      false
    );
  });
});

describe('periodCoversBillingMonth', () => {
  it('matches invoice period overlapping billing month', () => {
    expect(
      periodCoversBillingMonth('2026-01-10', '2026-02-20', '2026-02-01', {
        month: '2',
        year: '2026',
      })
    ).toBe(true);
  });

  it('falls back to invoice date when period is missing', () => {
    expect(
      periodCoversBillingMonth(null, null, '2026-02-15', { month: '2', year: '2026' })
    ).toBe(true);
    expect(
      periodCoversBillingMonth(null, null, '2026-01-15', { month: '2', year: '2026' })
    ).toBe(false);
  });
});

describe('invoiceMatchesBillingMonth', () => {
  it('matches by period for a specific month filter', () => {
    expect(
      invoiceMatchesBillingMonth(
        {
          invoice_date: '2026-02-01',
          period_from: '2026-01-10',
          period_to: '2026-02-20',
        },
        '2',
        '2026'
      )
    ).toBe(true);
  });
});

describe('buildMonthStatusMap — multi-month orders', () => {
  const order = makeOrder();
  const billingFeb = { month: '2', year: '2026' };
  const billingJan = { month: '1', year: '2026' };

  it('uses month coverage for invoice_issued and per-month sent flag', () => {
    const febKey = monthFlagKey(order.id, '2026', '2');
    const statusMap = buildMonthStatusMap({
      orderIds: [order.id],
      ordersById: { [order.id]: order },
      billing: billingFeb,
      coverages: [
        {
          orderId: order.id,
          invoiceId: 'inv-1',
          periodFrom: '2026-01-10',
          periodTo: '2026-02-20',
          invoiceDate: '2026-02-01',
        },
      ],
      legacyStatuses: {
        [order.id]: makeLegacyStatus(order.id, { invoice_sent: true }),
      },
      monthFlags: {
        [febKey]: { invoice_issued: false, invoice_sent: true },
      },
    });

    expect(statusMap[order.id]).toEqual({
      invoice_issued: true,
      invoice_sent: true,
    });
  });

  it('honors manual invoice_issued per month without invoice coverage', () => {
    const janKey = monthFlagKey(order.id, '2026', '1');
    const statusMap = buildMonthStatusMap({
      orderIds: [order.id],
      ordersById: { [order.id]: order },
      billing: billingJan,
      coverages: [],
      legacyStatuses: {},
      monthFlags: {
        [janKey]: { invoice_issued: true, invoice_sent: false },
      },
    });

    expect(statusMap[order.id]).toEqual({
      invoice_issued: true,
      invoice_sent: false,
    });
  });

  it('inherits legacy invoice_issued for a month without an explicit per-month flag', () => {
    const orderMayJune = makeOrder({ from: '2026-05-28', to: '2026-06-24' });
    const statusMap = buildMonthStatusMap({
      orderIds: [orderMayJune.id],
      ordersById: { [orderMayJune.id]: orderMayJune },
      billing: { month: '6', year: '2026' },
      coverages: [
        {
          orderId: orderMayJune.id,
          invoiceId: 'inv-may',
          periodFrom: '2026-05-28',
          periodTo: '2026-05-31',
          invoiceDate: '2026-05-31',
        },
      ],
      legacyStatuses: {
        [orderMayJune.id]: makeLegacyStatus(orderMayJune.id, { invoice_issued: true }),
      },
      monthFlags: {},
    });

    expect(statusMap[orderMayJune.id]?.invoice_issued).toBe(true);
  });

  it('respects an explicit per-month issued=false flag over legacy', () => {
    const orderMayJune = makeOrder({ from: '2026-05-28', to: '2026-06-24' });
    const juneKey = monthFlagKey(orderMayJune.id, '2026', '6');
    const statusMap = buildMonthStatusMap({
      orderIds: [orderMayJune.id],
      ordersById: { [orderMayJune.id]: orderMayJune },
      billing: { month: '6', year: '2026' },
      coverages: [],
      legacyStatuses: {
        [orderMayJune.id]: makeLegacyStatus(orderMayJune.id, { invoice_issued: true }),
      },
      monthFlags: {
        [juneKey]: { invoice_issued: false, invoice_sent: false },
      },
    });

    expect(statusMap[orderMayJune.id]?.invoice_issued).toBe(false);
  });

  it('uses year-scoped coverage and legacy for year-only billing', () => {
    const orderMayJune = makeOrder({ from: '2026-05-28', to: '2026-06-24' });
    const statusMap = buildMonthStatusMap({
      orderIds: [orderMayJune.id],
      ordersById: { [orderMayJune.id]: orderMayJune },
      billing: { month: '', year: '2026' },
      coverages: [
        {
          orderId: orderMayJune.id,
          invoiceId: 'inv-may',
          periodFrom: '2026-05-28',
          periodTo: '2026-05-31',
          invoiceDate: '2026-05-31',
        },
      ],
      legacyStatuses: {
        [orderMayJune.id]: makeLegacyStatus(orderMayJune.id, { invoice_issued: true }),
      },
      monthFlags: {},
    });

    expect(statusMap[orderMayJune.id]?.invoice_issued).toBe(true);
  });

  it('keeps invoice_sent false when month has coverage but sent flag is off', () => {
    const statusMap = buildMonthStatusMap({
      orderIds: [order.id],
      ordersById: { [order.id]: order },
      billing: billingFeb,
      coverages: [
        {
          orderId: order.id,
          invoiceId: 'inv-1',
          periodFrom: '2026-01-10',
          periodTo: '2026-02-20',
          invoiceDate: '2026-02-01',
        },
      ],
      legacyStatuses: {},
      monthFlags: {},
    });

    expect(statusMap[order.id]?.invoice_sent).toBe(false);
  });

  it('inherits legacy invoice_sent when no explicit per-month flag exists', () => {
    const statusMap = buildMonthStatusMap({
      orderIds: [order.id],
      ordersById: { [order.id]: order },
      billing: billingFeb,
      coverages: [
        {
          orderId: order.id,
          invoiceId: 'inv-1',
          periodFrom: '2026-01-10',
          periodTo: '2026-02-20',
          invoiceDate: '2026-02-01',
        },
      ],
      legacyStatuses: {
        [order.id]: makeLegacyStatus(order.id, { invoice_sent: true }),
      },
      monthFlags: {},
    });

    expect(statusMap[order.id]?.invoice_sent).toBe(true);
  });

  it('inherits legacy invoice_sent for a month without an explicit per-month flag', () => {
    const orderMayJune = makeOrder({ from: '2026-05-28', to: '2026-06-24' });
    const statusMap = buildMonthStatusMap({
      orderIds: [orderMayJune.id],
      ordersById: { [orderMayJune.id]: orderMayJune },
      billing: { month: '6', year: '2026' },
      coverages: [],
      legacyStatuses: {
        [orderMayJune.id]: makeLegacyStatus(orderMayJune.id, {
          invoice_issued: true,
          invoice_sent: true,
        }),
      },
      monthFlags: {},
    });

    expect(statusMap[orderMayJune.id]).toEqual({
      invoice_issued: true,
      invoice_sent: true,
    });
  });

  it('marks issued and sent false when billing month has no invoice coverage', () => {
    const janKey = monthFlagKey(order.id, '2026', '1');
    const statusMap = buildMonthStatusMap({
      orderIds: [order.id],
      ordersById: { [order.id]: order },
      billing: billingJan,
      coverages: [
        {
          orderId: order.id,
          invoiceId: 'inv-1',
          periodFrom: '2026-02-01',
          periodTo: '2026-02-28',
          invoiceDate: '2026-02-01',
        },
      ],
      legacyStatuses: {
        [order.id]: makeLegacyStatus(order.id, { invoice_sent: true }),
      },
      monthFlags: {
        [janKey]: { invoice_issued: false, invoice_sent: false },
      },
    });

    expect(statusMap[order.id]).toEqual({
      invoice_issued: false,
      invoice_sent: false,
    });
  });

  it('allows different sent flags per billing month', () => {
    const janKey = monthFlagKey(order.id, '2026', '1');
    const febKey = monthFlagKey(order.id, '2026', '2');

    const janStatus = buildMonthStatusMap({
      orderIds: [order.id],
      ordersById: { [order.id]: order },
      billing: billingJan,
      coverages: [
        {
          orderId: order.id,
          invoiceId: 'inv-jan',
          periodFrom: '2026-01-10',
          periodTo: '2026-01-31',
          invoiceDate: '2026-01-31',
        },
      ],
      legacyStatuses: {},
      monthFlags: {
        [janKey]: { invoice_issued: false, invoice_sent: true },
        [febKey]: { invoice_issued: false, invoice_sent: false },
      },
    });

    const febStatus = buildMonthStatusMap({
      orderIds: [order.id],
      ordersById: { [order.id]: order },
      billing: billingFeb,
      coverages: [
        {
          orderId: order.id,
          invoiceId: 'inv-feb',
          periodFrom: '2026-02-01',
          periodTo: '2026-02-20',
          invoiceDate: '2026-02-01',
        },
      ],
      legacyStatuses: {},
      monthFlags: {
        [janKey]: { invoice_issued: false, invoice_sent: true },
        [febKey]: { invoice_issued: false, invoice_sent: false },
      },
    });

    expect(janStatus[order.id]?.invoice_sent).toBe(true);
    expect(febStatus[order.id]?.invoice_sent).toBe(false);
  });
});

describe('nextInvoiceStatusOnToggle', () => {
  it('marks issued when sent is toggled on', () => {
    expect(
      nextInvoiceStatusOnToggle(
        { invoice_issued: false, invoice_sent: false },
        'invoice_sent',
        true
      )
    ).toEqual({ invoice_issued: true, invoice_sent: true });
  });

  it('clears sent when issued is toggled off', () => {
    expect(
      nextInvoiceStatusOnToggle(
        { invoice_issued: true, invoice_sent: true },
        'invoice_issued',
        false
      )
    ).toEqual({ invoice_issued: false, invoice_sent: false });
  });
});

describe('buildMonthStatusMap — single-month orders', () => {
  const order = makeOrder({ from: '2026-02-01', to: '2026-02-28' });

  it('uses legacy invoice_sent when not multi-month', () => {
    const statusMap = buildMonthStatusMap({
      orderIds: [order.id],
      ordersById: { [order.id]: order },
      billing: { month: '2', year: '2026' },
      coverages: [
        {
          orderId: order.id,
          invoiceId: 'inv-1',
          periodFrom: '2026-02-01',
          periodTo: '2026-02-28',
          invoiceDate: '2026-02-15',
        },
      ],
      legacyStatuses: {
        [order.id]: makeLegacyStatus(order.id, { invoice_sent: true }),
      },
      monthFlags: {},
    });

    expect(statusMap[order.id]?.invoice_sent).toBe(true);
  });

  it('honors manual invoice_issued when billing month has no invoice yet', () => {
    const statusMap = buildMonthStatusMap({
      orderIds: [order.id],
      ordersById: { [order.id]: order },
      billing: { month: '2', year: '2026' },
      coverages: [],
      legacyStatuses: {
        [order.id]: makeLegacyStatus(order.id, { invoice_issued: true }),
      },
      monthFlags: {},
    });

    expect(statusMap[order.id]?.invoice_issued).toBe(true);
  });

  it('keeps invoice_issued true when month has invoice coverage', () => {
    const statusMap = buildMonthStatusMap({
      orderIds: [order.id],
      ordersById: { [order.id]: order },
      billing: { month: '2', year: '2026' },
      coverages: [
        {
          orderId: order.id,
          invoiceId: 'inv-1',
          periodFrom: '2026-02-01',
          periodTo: '2026-02-28',
          invoiceDate: '2026-02-15',
        },
      ],
      legacyStatuses: {},
      monthFlags: {},
    });

    expect(statusMap[order.id]?.invoice_issued).toBe(true);
  });
});
