import { describe, expect, it } from 'vitest';
import {
  orderBroadcastCoversDay,
  resolveListMonthYear,
  resolveLiveFilterDay,
} from '@/lib/orders-filters';

describe('resolveListMonthYear', () => {
  it('pads numeric month to two digits', () => {
    expect(resolveListMonthYear('3', '2026')).toEqual({ month: '03', year: '2026' });
    expect(resolveListMonthYear('02', '2026')).toEqual({ month: '02', year: '2026' });
  });

  it('returns empty month when month filter is blank', () => {
    expect(resolveListMonthYear('', '2026')).toEqual({ month: '', year: '2026' });
  });

  it('resolves current tab to a concrete month', () => {
    const result = resolveListMonthYear('current', '2026');
    expect(result.year).toBe('2026');
    expect(result.month).toMatch(/^\d{2}$/);
  });
});

describe('Live broadcast day', () => {
  const today = new Date(2026, 8, 26);

  it('uses today when the page has no single selected day', () => {
    expect(resolveLiveFilterDay({ dateFrom: '', dateTo: '' }, today)).toBe('2026-09-26');
    expect(resolveLiveFilterDay({}, today)).toBe('2026-09-26');
  });

  it('uses the selected day when nuo and iki are that same day', () => {
    expect(
      resolveLiveFilterDay({ dateFrom: '2026-09-01', dateTo: '2026-09-01' }, today)
    ).toBe('2026-09-01');
  });

  it('counts a campaign only while the day sits inside data nuo–data iki', () => {
    expect(
      orderBroadcastCoversDay({ from: '2026-09-20', to: '2026-09-30' }, '2026-09-26')
    ).toBe(true);
    expect(
      orderBroadcastCoversDay({ from: '2026-09-26', to: '2026-09-26' }, '2026-09-26')
    ).toBe(true);
    expect(
      orderBroadcastCoversDay({ from: '2026-08-17', to: '2026-09-13' }, '2026-09-26')
    ).toBe(false);
    expect(
      orderBroadcastCoversDay({ from: '2026-08-03', to: '2026-08-09' }, '2026-09-26')
    ).toBe(false);
  });
});
