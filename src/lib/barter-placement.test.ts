import { describe, expect, it } from 'vitest';
import {
  BARTER_HOURS,
  barterDayFits,
  barterFitsHour,
  barterHourDecision,
  barterOrdersOnScreen,
  barterRowsBesideCampaigns,
  earlierBartersOnHour,
  isPikselOwnedRegularScreen,
} from '@/lib/barter-placement';

describe('barter under-6 rule', () => {
  it('places when 5 clips are already in the hour and skips at 6', () => {
    expect(barterHourDecision(5)).toBe('place');
    expect(barterHourDecision(6)).toBe('skip');
    expect(barterFitsHour({ paidOrders: 5, earlierBartersOnHour: 0 })).toBe(true);
    expect(barterFitsHour({ paidOrders: 6, earlierBartersOnHour: 0 })).toBe(false);
  });

  it('counts an earlier barter toward the 6', () => {
    const orders = [
      {
        id: 'test-1',
        from: '2026-09-01',
        to: '2026-09-30',
        screenNames: ['Panorama'],
      },
      {
        id: 'test-2',
        from: '2026-09-01',
        to: '2026-09-30',
        screenNames: ['Panorama'],
      },
    ];
    const onScreen = barterOrdersOnScreen(orders, 'Panorama');
    const firstEarlier = earlierBartersOnHour(onScreen, 'test-1', '2026-09-27');
    const secondEarlier = earlierBartersOnHour(onScreen, 'test-2', '2026-09-27');

    expect(firstEarlier).toBe(0);
    expect(barterFitsHour({ paidOrders: 5, earlierBartersOnHour: firstEarlier })).toBe(true);
    expect(secondEarlier).toBe(1);
    expect(barterFitsHour({ paidOrders: 5, earlierBartersOnHour: secondEarlier })).toBe(false);
    expect(barterFitsHour({ paidOrders: 4, earlierBartersOnHour: secondEarlier })).toBe(true);
  });

  it('does not let a barter on another screen take a slot', () => {
    const orders = [
      {
        id: 'test-a',
        from: '2026-09-01',
        to: '2026-09-30',
        screenNames: ['Kitas ekranas'],
      },
      {
        id: 'test-b',
        from: '2026-09-01',
        to: '2026-09-30',
        screenNames: ['Panorama'],
      },
    ];
    const onScreen = barterOrdersOnScreen(orders, 'Panorama');
    expect(onScreen.map((order) => order.id)).toEqual(['test-b']);
    expect(earlierBartersOnHour(onScreen, 'test-b', '2026-09-27')).toBe(0);
  });

  it('stops before the 23:00 blackout', () => {
    expect(BARTER_HOURS[0]).toBe(6);
    expect(BARTER_HOURS[BARTER_HOURS.length - 1]).toBe(22);
    expect(BARTER_HOURS).not.toContain(23);
    expect(barterDayFits((hour) => hour === 23)).toBe(false);
    expect(barterDayFits((hour) => hour === 22)).toBe(true);
  });

  it('does not draw a second barter row for an order already on the schedule', () => {
    const rows = barterRowsBesideCampaigns(
      [
        { id: 'test-1790528875210', name: 'Remimas-Zalgiris' },
        { id: 'test-other', name: 'Kitas' },
      ],
      new Set(['test-1790528875210'])
    );
    expect(rows.map((row) => row.id)).toEqual(['test-other']);
  });

  it('keeps partner screens and viaducts out of the picker', () => {
    expect(isPikselOwnedRegularScreen({ owner: 'Piksel', viaduct: false })).toBe(true);
    expect(isPikselOwnedRegularScreen({ owner: ' piksel ', viaduct: false })).toBe(true);
    expect(isPikselOwnedRegularScreen({ owner: 'Owexx', viaduct: false })).toBe(false);
    expect(isPikselOwnedRegularScreen({ owner: 'Piksel', viaduct: true })).toBe(false);
  });
});
