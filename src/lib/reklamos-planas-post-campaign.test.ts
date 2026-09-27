import { describe, expect, it } from 'vitest';
import {
  computePostCampaignDifference,
  computePostCampaignShownViews,
  excelPostCampaignFigures,
  getMonthBoostRange,
  postCampaignShownMultiplier,
} from '@/lib/reklamos-planas-post-campaign';
import { buildPostCampaignSheetName } from '@/lib/reklamos-planas-data';

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

describe('excelPostCampaignFigures', () => {
  it('matches the report row instead of subtracting the actual from zero', () => {
    expect(excelPostCampaignFigures(3570, 479)).toEqual({
      planned: 3570,
      shown: 479,
      difference: -3091,
    });
    expect(excelPostCampaignFigures(0, 479)).toEqual({
      planned: null,
      shown: 479,
      difference: null,
    });
    expect(excelPostCampaignFigures(3570, null)).toEqual({
      planned: 3570,
      shown: null,
      difference: null,
    });
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

describe('buildPostCampaignSheetName', () => {
  it('stays a legal Excel name when the order number is 13 digits', () => {
    const name = buildPostCampaignSheetName({
      invoice_id: '1790481431166',
      client: 'QA Codex 2026-09-27 patikra',
      from: '2026-09-27',
      to: '2026-10-03',
    } as never);
    expect(name.length).toBeLessThanOrEqual(31);
    expect(name).not.toMatch(/[:\\/?*[\]]/);
    expect(name.startsWith("'") || name.endsWith("'")).toBe(false);
    expect(name).toContain('1790481431166');
    expect(name).toContain('2026-');
  });
});
