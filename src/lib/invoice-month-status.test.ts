import { describe, expect, it } from 'vitest';
import {
  billingMonthDateRange,
  billingMonthsCoveredByInvoice,
  buildMonthStatusMap,
  invoiceMatchesBillingMonth,
  invoiceToggleRequiresBillingMonth,
  monthFlagKey,
  nextInvoiceStatusOnToggle,
  periodCoversBillingMonth,
  periodsOverlap,
  readInvoiceStatusField,
  resolveOrderMonthInvoiceStatus,
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
});

describe('invoiceToggleRequiresBillingMonth', () => {
  it('requires a month for multi-month orders in year-only view', () => {
    const order = makeOrder({ from: '2026-05-28', to: '2026-06-24' });
    expect(invoiceToggleRequiresBillingMonth(order, { month: '', year: '2026' })).toBe(true);
    expect(invoiceToggleRequiresBillingMonth(order, { month: '6', year: '2026' })).toBe(false);
  });
});

describe('readInvoiceStatusField', () => {
  it('does not fall back to PocketBase invoice_sent for multi-month orders', () => {
    const order = makeOrder({ from: '2026-05-28', to: '2026-06-24', invoice_sent: true });
    expect(readInvoiceStatusField(order, null, 'invoice_issued')).toBe(false);
  });

  it('falls back to PocketBase invoice_sent for single-month orders', () => {
    const order = makeOrder({ from: '2026-06-01', to: '2026-06-30', invoice_sent: true });
    expect(readInvoiceStatusField(order, null, 'invoice_issued')).toBe(true);
  });
});

describe('multi-month order status', () => {
  const order = makeOrder();
  const orderMayJune = makeOrder({ id: 'order-may-june', from: '2026-05-28', to: '2026-06-24' });

  it('uses coverage and per-month flags in month view', () => {
    const febKey = monthFlagKey(order.id, '2026', '2');
    const status = resolveOrderMonthInvoiceStatus({
      order,
      billing: { month: '2', year: '2026' },
      coverages: [
        {
          orderId: order.id,
          invoiceId: 'inv-1',
          periodFrom: '2026-01-10',
          periodTo: '2026-02-20',
          invoiceDate: '2026-02-01',
        },
      ],
      legacy: makeLegacyStatus(order.id, { invoice_sent: true, invoice_issued: true }),
      monthFlags: {
        [febKey]: { invoice_issued: false, invoice_sent: true },
      },
    });

    expect(status).toEqual({ invoice_issued: true, invoice_sent: true });
  });

  it('does not inherit legacy issued/sent in month view', () => {
    const status = resolveOrderMonthInvoiceStatus({
      order: orderMayJune,
      billing: { month: '6', year: '2026' },
      coverages: [],
      legacy: makeLegacyStatus(orderMayJune.id, { invoice_issued: true, invoice_sent: true }),
      monthFlags: {},
    });

    expect(status).toEqual({ invoice_issued: false, invoice_sent: false });
  });

  it('shows year summary from coverage or any month flag', () => {
    const mayKey = monthFlagKey(orderMayJune.id, '2026', '5');
    const status = resolveOrderMonthInvoiceStatus({
      order: orderMayJune,
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
      legacy: makeLegacyStatus(orderMayJune.id, { invoice_issued: true }),
      monthFlags: {
        [mayKey]: { invoice_issued: false, invoice_sent: false },
      },
    });

    expect(status.invoice_issued).toBe(true);
    expect(status.invoice_sent).toBe(false);
  });

  it('keeps different sent flags per billing month', () => {
    const janKey = monthFlagKey(order.id, '2026', '1');
    const febKey = monthFlagKey(order.id, '2026', '2');

    const janStatus = resolveOrderMonthInvoiceStatus({
      order,
      billing: { month: '1', year: '2026' },
      coverages: [
        {
          orderId: order.id,
          invoiceId: 'inv-jan',
          periodFrom: '2026-01-10',
          periodTo: '2026-01-31',
          invoiceDate: '2026-01-31',
        },
      ],
      legacy: undefined,
      monthFlags: {
        [janKey]: { invoice_issued: false, invoice_sent: true },
        [febKey]: { invoice_issued: false, invoice_sent: false },
      },
    });

    const febStatus = resolveOrderMonthInvoiceStatus({
      order,
      billing: { month: '2', year: '2026' },
      coverages: [
        {
          orderId: order.id,
          invoiceId: 'inv-feb',
          periodFrom: '2026-02-01',
          periodTo: '2026-02-20',
          invoiceDate: '2026-02-01',
        },
      ],
      legacy: undefined,
      monthFlags: {
        [janKey]: { invoice_issued: false, invoice_sent: true },
        [febKey]: { invoice_issued: false, invoice_sent: false },
      },
    });

    expect(janStatus.invoice_sent).toBe(true);
    expect(febStatus.invoice_sent).toBe(false);
  });
});

describe('single-month order status', () => {
  const order = makeOrder({ from: '2026-02-01', to: '2026-02-28' });

  it('uses legacy invoice_sent', () => {
    const status = resolveOrderMonthInvoiceStatus({
      order,
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
      legacy: makeLegacyStatus(order.id, { invoice_sent: true }),
      monthFlags: {},
    });

    expect(status.invoice_sent).toBe(true);
  });

  it('honors manual invoice_issued without invoice coverage', () => {
    const status = resolveOrderMonthInvoiceStatus({
      order,
      billing: { month: '2', year: '2026' },
      coverages: [],
      legacy: makeLegacyStatus(order.id, { invoice_issued: true }),
      monthFlags: {},
    });

    expect(status.invoice_issued).toBe(true);
  });
});

describe('billingMonthsCoveredByInvoice', () => {
  it('returns each month touched by invoice period', () => {
    expect(
      billingMonthsCoveredByInvoice({
        orderId: 'order-1',
        invoiceId: 'inv-1',
        periodFrom: '2026-05-28',
        periodTo: '2026-06-24',
        invoiceDate: '2026-05-31',
      })
    ).toEqual([
      { month: '05', year: '2026' },
      { month: '06', year: '2026' },
    ]);
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

describe('buildMonthStatusMap', () => {
  it('resolves each order independently', () => {
    const order = makeOrder();
    const statusMap = buildMonthStatusMap({
      orderIds: [order.id],
      ordersById: { [order.id]: order },
      billing: { month: '2', year: '2026' },
      coverages: [],
      legacyStatuses: {},
      monthFlags: {},
    });

    expect(statusMap[order.id]).toEqual({ invoice_issued: false, invoice_sent: false });
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

describe('periodsOverlap', () => {
  it('detects overlapping ranges', () => {
    expect(periodsOverlap('2026-01-15', '2026-02-10', '2026-02-01', '2026-02-28')).toBe(true);
    expect(periodsOverlap('2026-03-01', '2026-03-31', '2026-02-01', '2026-02-28')).toBe(false);
  });
});
