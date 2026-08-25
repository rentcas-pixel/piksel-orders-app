import { describe, expect, it } from 'vitest';
import {
  alertsByOrderId,
  daysUntilBroadcastStart,
  isPartnerConfirmAlertWindow,
  unconfirmedPartnerNames,
} from '@/lib/partner-confirm-alert';

const now = new Date(2026, 7, 25);

describe('daysUntilBroadcastStart', () => {
  it('counts calendar days in local time', () => {
    expect(daysUntilBroadcastStart('2026-08-26', now)).toBe(1);
    expect(daysUntilBroadcastStart('2026-08-25', now)).toBe(0);
    expect(daysUntilBroadcastStart('2026-08-24', now)).toBe(-1);
    expect(daysUntilBroadcastStart('2026-09-04', now)).toBe(10);
  });
});

describe('isPartnerConfirmAlertWindow', () => {
  it('opens at 1 day left, today, and overdue', () => {
    expect(isPartnerConfirmAlertWindow(1)).toBe(true);
    expect(isPartnerConfirmAlertWindow(0)).toBe(true);
    expect(isPartnerConfirmAlertWindow(-2)).toBe(true);
    expect(isPartnerConfirmAlertWindow(2)).toBe(false);
    expect(isPartnerConfirmAlertWindow(null)).toBe(false);
  });
});

describe('unconfirmedPartnerNames', () => {
  it('skips Piksel and confirmed partners', () => {
    expect(
      unconfirmedPartnerNames([
        {
          order_id: '1',
          partner_id: 'p',
          partner_name: 'Piksel',
          confirmed_at: null,
        },
        {
          order_id: '1',
          partner_id: 'o',
          partner_name: 'Owexx',
          confirmed_at: null,
        },
        {
          order_id: '1',
          partner_id: 'g',
          partner_name: 'Gijota',
          confirmed_at: '2026-08-25T10:00:00.000Z',
        },
      ])
    ).toEqual(['Owexx']);
  });

  it('treats a partner as confirmed if any stage is confirmed', () => {
    expect(
      unconfirmedPartnerNames([
        {
          order_id: '1',
          partner_id: 'o',
          partner_name: 'Owexx',
          confirmed_at: null,
        },
        {
          order_id: '1',
          partner_id: 'o',
          partner_name: 'Owexx',
          confirmed_at: '2026-08-25T10:00:00.000Z',
        },
      ])
    ).toEqual([]);
  });
});

describe('alertsByOrderId', () => {
  it('groups names per order', () => {
    expect(
      alertsByOrderId([
        {
          order_id: 'a',
          partner_id: 'o',
          partner_name: 'Owexx',
          confirmed_at: null,
        },
        {
          order_id: 'b',
          partner_id: 'g',
          partner_name: 'Gijota',
          confirmed_at: null,
        },
      ])
    ).toEqual({ a: ['Owexx'], b: ['Gijota'] });
  });
});
