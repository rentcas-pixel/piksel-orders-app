import { describe, expect, it } from 'vitest';
import type { CampaignScreen } from '@/lib/campaign-calculator';
import {
  buildMediaLabelsFromClips,
  buildPikselPostCampaignReportRows,
  isPikselCampaignScreen,
  orderClipMediaId,
  resolveCampaignScreenIds,
} from '@/lib/post-campaign-report';
import { flattenCampaignGrid } from '@/lib/reklamos-planas-grid';
import { toCampaignOrderInput } from '@/lib/reklamos-planas-data';

function makeScreen(overrides: Partial<CampaignScreen> & { id: string; name: string }): CampaignScreen {
  return {
    ots: 1,
    price: { '1': 10 },
    ...overrides,
  };
}

describe('flattenCampaignGrid', () => {
  it('flattens day×hour boolean grid used by test orders', () => {
    const days = Array.from({ length: 7 }, () => Array(17).fill(true));
    const flat = flattenCampaignGrid(days);
    expect(flat).toHaveLength(119);
    expect(flat.every((v) => v === 1)).toBe(true);
  });
});

describe('isPikselCampaignScreen', () => {
  it('treats screens without partner as Piksel', () => {
    expect(isPikselCampaignScreen(makeScreen({ id: 'a', name: 'A' }))).toBe(true);
  });

  it('treats partner screens as non-Piksel', () => {
    expect(
      isPikselCampaignScreen(makeScreen({ id: 'c', name: 'C', partner: 'partner-1' }))
    ).toBe(false);
  });
});

describe('resolveCampaignScreenIds', () => {
  const catalog = [
    makeScreen({ id: '0n331qw8r35uiek', name: 'Panorama', city: 'Vilnius' }),
  ];

  it('resolves Panorama from plan screenNames when screens[] is empty', () => {
    const ids = resolveCampaignScreenIds(
      {
        screens: [],
        details: { plan: { screenNames: ['Panorama'] } },
      },
      catalog
    );
    expect(ids).toEqual(['0n331qw8r35uiek']);
  });
});

describe('buildPikselPostCampaignReportRows', () => {
  const screens = [
    makeScreen({ id: '0n331qw8r35uiek', name: 'Panorama', city: 'Vilnius', ots: 107 }),
  ];

  it('computes planned ~3570 from flattened grid + live plays', () => {
    const days = Array.from({ length: 7 }, () => Array(17).fill(true));
    const campaignOrder = toCampaignOrderInput({
      id: 'test-1784699114362',
      client: 'Reklaminis laikrodis',
      agency: 'X',
      invoice_id: '1784699114362',
      viaduct: false,
      from: '2026-07-22',
      to: '2026-07-28',
      screens: ['0n331qw8r35uiek'],
      grid: days,
      clip_duration: 10,
      discount: 80,
      details: {
        isTest: true,
        plan: {
          screenNames: ['Panorama'],
          screenRows: [
            { name: 'Panorama', catalogId: '0n331qw8r35uiek', impressions: 3570 },
          ],
          grid: days,
        },
        live: { screenNames: ['Panorama'] },
      },
    });

    const rows = buildPikselPostCampaignReportRows({
      order: {
        ...campaignOrder,
        details: {
          plan: {
            screenNames: ['Panorama'],
            screenRows: [
              { name: 'Panorama', catalogId: '0n331qw8r35uiek', impressions: 3570 },
            ],
          },
          live: { screenNames: ['Panorama'] },
        },
      },
      screens,
      bundles: [],
      livePlays: {
        campaignId: 'test-1784699114362',
        liveScreens: ['panorama'],
        screens: {
          panorama: { total: 42, byDay: { '2026-07-24': 42 } },
        },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Panorama');
    expect(rows[0].source).toBe('live');
    expect(rows[0].shownViews).toBe(42);
    expect(rows[0].plannedViews).toBe(3570);
  });

  it('attaches clip rows from live byMedia + mediaLabels', () => {
    const orderId = 'test-multi-clip';
    const clipA = 'clipA1';
    const clipB = 'clipB2';
    const mediaA = orderClipMediaId(orderId, clipA);
    const mediaB = orderClipMediaId(orderId, clipB);
    const mediaLabels = buildMediaLabelsFromClips(orderId, [
      { id: clipA, filename: 'banner-a.jpg' },
      { id: clipB, filename: 'banner-b.mp4' },
    ]);
    const days = Array.from({ length: 7 }, () => Array(17).fill(true));
    const campaignOrder = toCampaignOrderInput({
      id: orderId,
      client: 'X',
      agency: 'Y',
      invoice_id: '1',
      viaduct: false,
      from: '2026-07-22',
      to: '2026-07-28',
      screens: ['0n331qw8r35uiek'],
      grid: days,
      clip_duration: 10,
      discount: 0,
      details: {
        isTest: true,
        plan: {
          screenNames: ['Panorama'],
          screenRows: [
            { name: 'Panorama', catalogId: '0n331qw8r35uiek', impressions: 100 },
          ],
          grid: days,
        },
        live: { screenNames: ['Panorama'] },
      },
    });

    const rows = buildPikselPostCampaignReportRows({
      order: {
        ...campaignOrder,
        details: {
          plan: {
            screenNames: ['Panorama'],
            screenRows: [
              { name: 'Panorama', catalogId: '0n331qw8r35uiek', impressions: 100 },
            ],
          },
          live: { screenNames: ['Panorama'] },
        },
      },
      screens,
      bundles: [],
      mediaLabels,
      livePlays: {
        campaignId: orderId,
        liveScreens: ['panorama'],
        screens: {
          panorama: {
            total: 100,
            byDay: { '2026-07-24': 100 },
            byMedia: { [mediaA]: 60, [mediaB]: 40 },
          },
        },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].shownViews).toBe(100);
    expect(rows[0].clips).toEqual([
      { mediaId: mediaA, name: 'banner-a.jpg', shownViews: 60 },
      { mediaId: mediaB, name: 'banner-b.mp4', shownViews: 40 },
    ]);
  });
});
