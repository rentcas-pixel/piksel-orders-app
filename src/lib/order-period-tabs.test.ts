import { describe, expect, it } from 'vitest';
import {
  getPeriodTabPocketBaseFilter,
  isSplitAwarePeriodTab,
  paginateItems,
  periodTabTodayIso,
} from '@/lib/order-period-tabs';

describe('order period tabs', () => {
  const today = '2026-07-09';

  it('detects split-aware tabs', () => {
    expect(isSplitAwarePeriodTab('current')).toBe(true);
    expect(isSplitAwarePeriodTab('future')).toBe(true);
    expect(isSplitAwarePeriodTab('past')).toBe(true);
    expect(isSplitAwarePeriodTab('all')).toBe(false);
    expect(isSplitAwarePeriodTab(undefined)).toBe(false);
  });

  it('builds narrow pocketbase filters', () => {
    expect(getPeriodTabPocketBaseFilter('current', { today })).toBe(
      `(from<="${today}" && to>="${today}")`
    );
    expect(getPeriodTabPocketBaseFilter('future', { today })).toBe(`from>"${today}"`);
    expect(getPeriodTabPocketBaseFilter('past', { today })).toBe(`to<"${today}"`);
    expect(getPeriodTabPocketBaseFilter('all', { today })).toBe('');
  });

  it('builds wide pocketbase filters for split post-filter', () => {
    expect(getPeriodTabPocketBaseFilter('future', { today, wide: true })).toBe(`to>="${today}"`);
    expect(getPeriodTabPocketBaseFilter('past', { today, wide: true })).toBe(`from<="${today}"`);
  });

  it('paginates in-memory lists', () => {
    const items = Array.from({ length: 25 }, (_, i) => i + 1);
    const page1 = paginateItems(items, 1, 20);
    expect(page1.items).toHaveLength(20);
    expect(page1.totalItems).toBe(25);
    expect(page1.totalPages).toBe(2);

    const page2 = paginateItems(items, 2, 20);
    expect(page2.items).toEqual([21, 22, 23, 24, 25]);
  });

  it('formats today as yyyy-MM-dd', () => {
    expect(periodTabTodayIso(new Date(2026, 6, 9))).toBe('2026-07-09');
  });
});
