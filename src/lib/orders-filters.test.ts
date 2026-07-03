import { describe, expect, it } from 'vitest';
import { resolveListMonthYear } from '@/lib/orders-filters';

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
