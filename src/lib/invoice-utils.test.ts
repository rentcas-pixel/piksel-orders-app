import { describe, expect, it } from 'vitest';
import {
  isFullCampaignInvoice,
  resolveInvoiceAmountMode,
  resolveSavedInvoiceBaseAmount,
  compareInvoiceNumbers,
} from '@/lib/invoice-utils';
import type { Order } from '@/types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    client: 'Client',
    agency: 'Agency',
    invoice_id: '5000',
    approved: true,
    viaduct: false,
    from: '2026-06-22',
    to: '2026-07-05',
    media_received: false,
    final_price: 1259.5,
    invoice_sent: false,
    updated: '2026-01-01',
    ...overrides,
  };
}

describe('isFullCampaignInvoice', () => {
  const order = makeOrder();

  it('detects full campaign by matching order period', () => {
    expect(
      isFullCampaignInvoice(
        {
          period_from: '2026-06-22',
          period_to: '2026-07-05',
          amount: 500,
        },
        order
      )
    ).toBe(true);
    expect(resolveInvoiceAmountMode({ period_from: '2026-06-22', period_to: '2026-07-05' }, order)).toBe(
      'full'
    );
  });

  it('treats partial-month invoice as monthly', () => {
    expect(
      isFullCampaignInvoice(
        {
          period_from: '2026-06-22',
          period_to: '2026-06-30',
        },
        order
      )
    ).toBe(false);
    expect(resolveInvoiceAmountMode({ period_from: '2026-06-22', period_to: '2026-06-30' }, order)).toBe(
      'monthly'
    );
  });
});

describe('resolveSavedInvoiceBaseAmount', () => {
  it('keeps manually saved amount instead of auto-calculated base', () => {
    expect(resolveSavedInvoiceBaseAmount(994.95, 981.29)).toBe(994.95);
  });

  it('uses auto-calculated base when saved amount matches', () => {
    expect(resolveSavedInvoiceBaseAmount(981.29, 981.29)).toBe(981.29);
  });
});

describe('compareInvoiceNumbers', () => {
  it('sorts by numeric PIK sequence', () => {
    expect(compareInvoiceNumbers('PIK 100', 'PIK 99')).toBeGreaterThan(0);
    expect(compareInvoiceNumbers('PIK 3842', 'PIK 3843')).toBeLessThan(0);
  });
});
