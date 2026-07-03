import { describe, expect, it } from 'vitest';
import {
  computePostCampaignDifference,
  computePostCampaignShownViews,
  getMonthBoostRange,
  postCampaignShownMultiplier,
} from '@/lib/reklamos-planas-post-campaign';

describe('getMonthBoostRange', () => {
  it('returns january boost range', () => {
    expect(getMonthBoostRange(0, 15)).toEqual({ min: 0.48, max: 0.64 });
  });

  it('interpolates august range by day', () => {
    const early = getMonthBoostRange(7, 1);
    const late = getMonthBoostRange(7, 31);
    expect(early.min).toBeGreaterThan(late.min);
    expect(early.max).toBeGreaterThan(late.max);
  });
});

describe('postCampaignShownMultiplier', () => {
  it('is deterministic for the same inputs', () => {
    const first = postCampaignShownMultiplier('order-1', 'screen-1', '2026-01-01', '2026-01-31');
    const second = postCampaignShownMultiplier('order-1', 'screen-1', '2026-01-01', '2026-01-31');
    expect(first).toBe(second);
  });

  it('is always at least 1', () => {
    const multiplier = postCampaignShownMultiplier('order-9', 'screen-2', '2026-06-01', '2026-06-30');
    expect(multiplier).toBeGreaterThanOrEqual(1);
  });
});

describe('computePostCampaignShownViews', () => {
  it('rounds shown views using the multiplier', () => {
    const planned = 10_000;
    const multiplier = postCampaignShownMultiplier('order-1', 'screen-1', '2026-02-01', '2026-02-28');
    const shown = computePostCampaignShownViews(
      planned,
      'order-1',
      'screen-1',
      '2026-02-01',
      '2026-02-28'
    );

    expect(shown).toBe(Math.round(planned * multiplier));
    expect(shown).toBeGreaterThanOrEqual(planned);
  });

  it('returns zero for non-positive planned views', () => {
    expect(
      computePostCampaignShownViews(0, 'order-1', 'screen-1', '2026-02-01', '2026-02-28')
    ).toBe(0);
  });
});

describe('computePostCampaignDifference', () => {
  it('returns shown minus planned', () => {
    expect(computePostCampaignDifference(1000, 1150)).toBe(150);
    expect(computePostCampaignDifference(1000, 1000)).toBe(0);
  });
});
