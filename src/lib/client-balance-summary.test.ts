import { describe, expect, it } from 'vitest';
import {
  computeClientBalances,
  computeClientBalanceTotals,
  getInvoicesForClientRow,
} from '@/lib/client-balance-summary';
import type { Invoice, ReceivedInvoice } from '@/types';

function makeIssued(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'issued-1',
    order_id: 'order-1',
    invoice_number: 'PIK-100',
    invoice_date: '2026-02-10',
    amount: 1000,
    buyer_name: 'UAB BTA',
    buyer_company_code: '123456789',
    buyer_vat_code: 'LT123456789',
    period_from: '2026-02-01',
    period_to: '2026-02-28',
    created_at: '2026-02-10',
    ...overrides,
  } as Invoice;
}

function makeReceived(overrides: Partial<ReceivedInvoice> = {}): ReceivedInvoice {
  return {
    id: 'received-1',
    invoice_number: 'T-1',
    invoice_date: '2026-02-12',
    amount: 400,
    seller_name: 'UAB BTA',
    seller_company_code: '123456789',
    seller_vat_code: 'LT123456789',
    created_at: '2026-02-12',
    ...overrides,
  } as ReceivedInvoice;
}

describe('computeClientBalances', () => {
  it('merges issued and received for the same company code', () => {
    const rows = computeClientBalances(
      [makeIssued()],
      [makeReceived()],
      '2',
      '2026'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.displayName).toContain('BTA');
    expect(rows[0]?.issuedAmount).toBe(1000);
    expect(rows[0]?.receivedAmount).toBe(400);
    expect(rows[0]?.netBalance).toBe(600);
  });

  it('merges name variants without company code', () => {
    const rows = computeClientBalances(
      [makeIssued({ buyer_name: 'BTA', buyer_company_code: null })],
      [makeReceived({ seller_name: 'UAB BTA', seller_company_code: null })],
      '2',
      '2026'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.issuedCount).toBe(1);
    expect(rows[0]?.receivedCount).toBe(1);
  });

  it('excludes invoices outside selected month', () => {
    const rows = computeClientBalances(
      [makeIssued({ invoice_date: '2026-03-01', period_from: '2026-03-01', period_to: '2026-03-31' })],
      [makeReceived({ invoice_date: '2026-03-01' })],
      '2',
      '2026'
    );

    expect(rows).toHaveLength(0);
  });

  it('groups issued invoices by issue date, not advertising period', () => {
    const invoice = makeIssued({
      invoice_number: 'PIK 3842',
      invoice_date: '2026-06-30',
      period_from: '2026-06-16',
      period_to: '2026-07-17',
    });

    const juneRows = computeClientBalances([invoice], [], '6', '2026');
    const julyRows = computeClientBalances([invoice], [], '7', '2026');

    expect(juneRows).toHaveLength(1);
    expect(julyRows).toHaveLength(0);
  });
});

describe('computeClientBalanceTotals', () => {
  it('sums filtered rows', () => {
    const rows = computeClientBalances(
      [
        makeIssued({ id: 'a', amount: 1000 }),
        makeIssued({ id: 'b', buyer_name: 'Kitas', buyer_company_code: '987654321', amount: 500 }),
      ],
      [],
      '2',
      '2026'
    );

    const totals = computeClientBalanceTotals(rows);
    expect(totals.clientCount).toBe(2);
    expect(totals.issuedAmount).toBe(1500);
    expect(totals.netBalance).toBe(1500);
  });
});

describe('getInvoicesForClientRow', () => {
  it('returns only invoices belonging to the selected client row', () => {
    const issued = [
      makeIssued(),
      makeIssued({
        id: 'issued-2',
        buyer_name: 'Kitas klientas',
        buyer_company_code: '987654321',
      }),
    ];
    const received = [makeReceived()];
    const rows = computeClientBalances(issued, received, '2', '2026');
    const btaRow = rows.find((row) => row.companyCode === '123456789');
    expect(btaRow).toBeDefined();

    const details = getInvoicesForClientRow(btaRow!, issued, received, '2', '2026');
    expect(details.issued).toHaveLength(1);
    expect(details.received).toHaveLength(1);
    expect(details.issued[0]?.invoice_number).toBe('PIK-100');
  });
});
