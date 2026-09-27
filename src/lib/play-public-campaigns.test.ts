import { describe, expect, it } from 'vitest';
import {
  localTestPlanIsNewer,
  mergeOrderWithPlayCampaign,
  playCampaignBarterSnapshot,
  playCampaignSnapshotFromTestOrder,
  type PlayPublicCampaignRecord,
} from '@/lib/play-public-campaigns';
import type { Order } from '@/types';

function testOrder(partial: Partial<Order> = {}): Order {
  const { details: detailPartial, ...rest } = partial;
  return {
    id: 'test-1790481431166',
    client: 'QA Codex 2026-09-27 patikra',
    agency: 'QA patikra',
    invoice_id: '1790481431166',
    approved: false,
    viaduct: false,
    from: '2026-09-27',
    to: '2026-10-24',
    media_received: false,
    final_price: 1035.09,
    invoice_sent: false,
    updated: '2026-09-27T15:00:00.000Z',
    ...rest,
    details: {
      isTest: true,
      planChangedAt: '2026-09-27T15:00:00.000Z',
      total: 1035.09,
      finalPrice: 1035.09,
      plan: {
        total: 1035.09,
        screenRows: [
          {
            name: 'Panorama',
            catalogId: 'panorama',
            from: '2026-09-27',
            to: '2026-10-24',
            net: 1035.09,
          },
        ],
      },
      ...detailPartial,
    },
  };
}

function serverRecord(updatedAt: string): PlayPublicCampaignRecord {
  return {
    token: 'tok',
    orderId: 'test-1790481431166',
    kind: 'test',
    updatedAt,
    status: 'awaiting_approval',
    locked: false,
    campaign: {
      date_from: '2026-09-27',
      date_to: '2026-10-10',
      final_price: 528.44,
    },
    screens: [
      {
        screen_id: 'panorama',
        name: 'Panorama',
        from: '2026-09-27',
        to: '2026-10-10',
        net_price: 528.44,
        calculation_snapshot: { name: 'Panorama' },
      },
    ],
  };
}

describe('test order plan hydrate', () => {
  it('keeps a newer local plan over an older server snapshot', () => {
    const order = testOrder();
    const record = serverRecord('2026-09-27T12:00:00.000Z');
    expect(localTestPlanIsNewer(order, record)).toBe(true);
    const merged = mergeOrderWithPlayCampaign(order, record);
    expect(merged.from).toBe('2026-09-27');
    expect(merged.to).toBe('2026-10-24');
    expect(merged.final_price).toBe(1035.09);
    expect(merged.approved).toBe(false);
    expect(merged.details?.plan?.screenRows?.[0]?.to).toBe('2026-10-24');
  });

  it('still applies a newer server plan', () => {
    const order = testOrder();
    const record = serverRecord('2026-09-27T16:00:00.000Z');
    expect(localTestPlanIsNewer(order, record)).toBe(false);
    const merged = mergeOrderWithPlayCampaign(order, record);
    expect(merged.to).toBe('2026-10-10');
    expect(merged.final_price).toBe(528.44);
    expect(merged.details?.plan?.screenRows?.[0]?.to).toBe('2026-10-10');
  });

  it('leaves a non-test order on the server plan', () => {
    const order = testOrder({
      id: 'pb-1',
      updated: '2026-09-27T18:00:00.000Z',
      details: { isTest: false, planChangedAt: '2026-09-27T18:00:00.000Z' },
    });
    const record = serverRecord('2026-09-27T12:00:00.000Z');
    expect(localTestPlanIsNewer(order, record)).toBe(false);
    const merged = mergeOrderWithPlayCampaign(order, record);
    expect(merged.to).toBe('2026-10-10');
    expect(merged.final_price).toBe(528.44);
  });

  it('writes the saved end date and price into the campaign snapshot', () => {
    const snapshot = playCampaignSnapshotFromTestOrder(testOrder(), serverRecord('2026-09-27T12:00:00.000Z'));
    expect(snapshot.campaign.date_from).toBe('2026-09-27');
    expect(snapshot.campaign.date_to).toBe('2026-10-24');
    expect(snapshot.campaign.final_price).toBe(1035.09);
    expect(snapshot.screens[0]?.to).toBe('2026-10-24');
    expect(snapshot.screens[0]?.net_price).toBe(1035.09);
  });

  it('writes a barter snapshot without an hour grid', () => {
    const snapshot = playCampaignBarterSnapshot({
      ...testOrder(),
      final_price: 0,
      details: {
        barter: true,
        barterPrice: 0,
        barterScreens: [{ id: 'panorama', name: 'Panorama' }],
      },
    });
    expect(snapshot.campaign.barter).toBe(true);
    expect(snapshot.campaign.grid).toBeUndefined();
    expect(snapshot.campaign.final_price).toBe(0);
    expect(snapshot.screens[0]?.net_price).toBe(0);
  });

  it('does not copy a paid grid when the server snapshot is barter', () => {
    const order = testOrder({
      grid: [[true]],
      details: {
        barter: true,
        barterPrice: 0,
        barterScreens: [{ id: 'panorama', name: 'Panorama' }],
        planChangedAt: '2026-09-27T12:00:00.000Z',
      },
    });
    const record = serverRecord('2026-09-27T16:00:00.000Z');
    record.campaign = {
      ...record.campaign,
      barter: true,
      final_price: 0,
      grid: [[true], [true], [true], [true], [true], [true], [true]],
    };
    const merged = mergeOrderWithPlayCampaign(order, record);
    expect(merged.grid).toBeUndefined();
    expect(merged.details?.barter).toBe(true);
    expect(merged.details?.plan?.grid).toBeUndefined();
    expect(merged.final_price).toBe(0);
    expect(merged.to).toBe('2026-10-10');
  });
});
