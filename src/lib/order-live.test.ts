import { describe, expect, it } from 'vitest';
import {
  buildOrderLiveSnapshot,
  describeLiveDirtyFallback,
  describeLiveUpdateNotice,
  describeOrderLiveChanges,
  shortClipNoticeName,
  clipIdsFromLiveStamp,
  liveReconcileNotice,
  orderLiveClipStamp,
  orderLiveContentKey,
  orderLiveNeedsUpdate,
  orderLiveWasSentToPlayer,
  snapshotFromLiveState,
} from '@/lib/order-live';
import type { Order } from '@/types';

function liveOrder(patch: Partial<Order> & { details?: Order['details'] }): Order {
  return {
    id: 'test-1',
    client: 'Moller',
    agency: '',
    invoice_id: '1',
    approved: true,
    viaduct: false,
    from: '2026-09-18',
    to: '2026-09-24',
    media_received: true,
    final_price: 0,
    invoice_sent: false,
    updated: '2026-09-18',
    ...patch,
    details: {
      isTest: true,
      live: {
        status: 'live',
        screenNames: ['Panorama Vilnius', 'Laisvės kelias'],
      },
      plan: {
        screenNames: ['Panorama Vilnius', 'Laisvės kelias'],
        screenRows: [
          { name: 'Panorama Vilnius' },
          { name: 'Laisvės kelias' },
        ],
      },
      ...(patch.details || {}),
    },
  };
}

describe('orderLiveWasSentToPlayer', () => {
  it('ignores a local Live flag that never reached the player', () => {
    expect(orderLiveWasSentToPlayer({ status: 'live', screenNames: ['Panorama'] })).toBe(false);
    expect(orderLiveWasSentToPlayer({ status: 'idle' })).toBe(false);
  });

  it('treats a stored publish as live on the player', () => {
    expect(
      orderLiveWasSentToPlayer({
        status: 'live',
        publishedAt: '2026-09-25T12:00:00.000Z',
      })
    ).toBe(true);
    expect(orderLiveWasSentToPlayer({ status: 'live', playerApi: 'https://player.piksel.lt' })).toBe(
      true
    );
    expect(orderLiveWasSentToPlayer({ status: 'live', playerItemCount: 2 })).toBe(true);
  });
});

describe('liveReconcileNotice', () => {
  it('stays calm when the player rejects the key', () => {
    const notice = liveReconcileNotice(
      new Error('Grotuvo serveris užrakintas. Live raktas nepriimtas.')
    );
    expect(notice).toContain('nekeista');
    expect(notice).not.toContain('nepriimtas');
  });
});

describe('orderLiveNeedsUpdate', () => {
  it('is quiet when plan screens still match last Live', () => {
    expect(orderLiveNeedsUpdate(liveOrder({}))).toBe(false);
  });

  it('flags Atnaujinti Live after screens are removed from the plan', () => {
    expect(
      orderLiveNeedsUpdate(
        liveOrder({
          details: {
            isTest: true,
            live: {
              status: 'live',
              screenNames: ['Panorama Vilnius', 'Laisvės kelias'],
            },
            plan: {
              screenNames: ['Panorama Vilnius'],
              screenRows: [{ name: 'Panorama Vilnius' }],
            },
          },
        })
      )
    ).toBe(true);
  });

  it('uses stored fingerprint when present', () => {
    const order = liveOrder({});
    const key = orderLiveContentKey(order);
    expect(
      orderLiveNeedsUpdate({
        ...order,
        details: {
          ...order.details,
          live: {
            status: 'live',
            screenNames: order.details?.live?.screenNames,
            publishedContentKey: key,
          },
        },
      })
    ).toBe(false);
    expect(
      orderLiveNeedsUpdate({
        ...order,
        client: 'Moller 4 ziedai',
        details: {
          ...order.details,
          live: {
            status: 'live',
            screenNames: order.details?.live?.screenNames,
            publishedContentKey: key,
          },
        },
      })
    ).toBe(true);
  });

  it('flags Atnaujinti Live when clip duration or viaduct frequency changes', () => {
    const order = liveOrder({
      clip_duration: 10,
      details: {
        isTest: true,
        live: { status: 'live', screenNames: ['Panorama Vilnius'] },
        plan: {
          screenNames: ['Panorama Vilnius'],
          screenRows: [{ name: 'Panorama Vilnius' }],
          clip_duration: 10,
          viaductFrequency: 1,
        },
      },
    });
    const key = orderLiveContentKey(order);
    const published = {
      ...order,
      details: {
        ...order.details,
        live: {
          status: 'live' as const,
          screenNames: ['Panorama Vilnius'],
          publishedContentKey: key,
        },
      },
    };
    expect(orderLiveNeedsUpdate(published)).toBe(false);
    expect(
      orderLiveNeedsUpdate({
        ...published,
        details: {
          ...published.details,
          plan: { ...published.details?.plan, clip_duration: 15 },
        },
      })
    ).toBe(true);
  });
});

describe('describeOrderLiveChanges', () => {
  it('lists end date, added screen and clip in Lithuanian', () => {
    const published = buildOrderLiveSnapshot(
      liveOrder({
        to: '2026-09-20',
        details: {
          isTest: true,
          plan: {
            screenNames: ['Akropolis'],
            screenRows: [{ name: 'Akropolis' }],
          },
        },
      }),
      'clip-a|old.mp4|||'
    );
    const current = buildOrderLiveSnapshot(
      liveOrder({
        to: '2026-09-25',
        details: {
          isTest: true,
          plan: {
            screenNames: ['Akropolis', 'Panorama'],
            screenRows: [{ name: 'Akropolis' }, { name: 'Panorama' }],
          },
        },
      }),
      'clip-b|new.mp4|||'
    );
    expect(describeOrderLiveChanges(published, current)).toEqual([
      'Pabaiga pakeista: rugsėjo 20 → 25 d.',
      'Pridėtas ekranas „Panorama“.',
      'Pakeistas klipas.',
    ]);
  });

  it('does not crash when a stored live snapshot has no screenNames', () => {
    const order = liveOrder({});
    const published = snapshotFromLiveState(
      {
        publishedSnapshot: {
          client: 'Moller',
          from: '2026-09-18',
          to: '2026-09-24',
          screenNames: undefined as unknown as string[],
          clipDuration: 10,
          viaduct: false,
          viaductFrequency: 1,
          clockOverlay: false,
          clipStamp: '',
          rowStamp: '',
          gridKey: '',
        },
        screenNames: ['Panorama Vilnius'],
      },
      order
    );
    const current = buildOrderLiveSnapshot(order);
    expect(describeOrderLiveChanges(published, current)).toEqual([
      'Pridėtas ekranas „Laisvės kelias“.',
    ]);
  });

  it('does not call a grid-only fingerprint a changed broadcast plan', () => {
    const published = buildOrderLiveSnapshot(liveOrder({}));
    const current = {
      ...published,
      gridKey: '[[false]]',
    };
    expect(describeLiveDirtyFallback(published, current)).toEqual([]);
  });

  it('reads dates from the stored content key when snapshot is missing', () => {
    const order = liveOrder({ to: '2026-09-20' });
    const live = {
      status: 'live' as const,
      screenNames: ['Panorama Vilnius', 'Laisvės kelias'],
      publishedContentKey: orderLiveContentKey(order),
    };
    const published = snapshotFromLiveState(live, order);
    const current = buildOrderLiveSnapshot({ ...order, to: '2026-09-25' });
    expect(describeOrderLiveChanges(published, current)).toEqual([
      'Pabaiga pakeista: rugsėjo 20 → 25 d.',
    ]);
  });

  it('stamps clips by id, filename and custom schedule', () => {
    expect(
      orderLiveClipStamp([
        {
          id: '2',
          filename: 'b.mp4',
          displayFrom: '2026-09-20',
          displayTo: '',
          displayScreenNames: ['Panorama'],
        },
        {
          id: '1',
          filename: 'a.mp4',
          displayFrom: '',
          displayTo: '',
          displayScreenNames: [],
        },
      ])
    ).toBe('1|a.mp4|||;2|b.mp4|2026-09-20||panorama');
    expect(
      clipIdsFromLiveStamp('1|a.mp4|||;2|b.mp4|2026-09-20||panorama')
    ).toEqual(['1', '2']);
  });
});

describe('describeLiveUpdateNotice', () => {
  it('shortens a long clip filename', () => {
    expect(shortClipNoticeName('JAU_10_METU_su_laikmaciu.mp4')).toBe('Jau 10 metų...');
    expect(shortClipNoticeName('Polestar Volvo.mp4')).toBe('Polestar Volvo');
  });

  it('uses the plan sentence only for dates, intensity, or screens', () => {
    const published = buildOrderLiveSnapshot(
      liveOrder({ to: '2026-09-20', intensity: 'Max' }),
      'clip-a|old.mp4|||'
    );
    const dated = buildOrderLiveSnapshot(
      liveOrder({ to: '2026-09-25', intensity: 'Max' }),
      'clip-a|old.mp4|||'
    );
    expect(describeLiveUpdateNotice(published, dated)).toEqual([
      'Pakeistas transliacijų planas.',
    ]);
    expect(
      describeLiveUpdateNotice(published, dated, {
        planChangedAt: '2026-09-25T17:08:00.000Z',
      })
    ).toEqual(['Pakeistas transliacijų planas. 2026-09-25, 20:08']);

    const louder = buildOrderLiveSnapshot(
      liveOrder({ to: '2026-09-20', intensity: 'Medi' }),
      'clip-a|old.mp4|||'
    );
    expect(
      describeLiveUpdateNotice(published, louder, {
        intensityPublished: 'Max',
        intensityCurrent: 'Medi',
      })
    ).toEqual(['Pakeistas transliacijų planas.']);

    const withScreen = buildOrderLiveSnapshot(
      liveOrder({
        to: '2026-09-20',
        intensity: 'Max',
        details: {
          isTest: true,
          plan: {
            screenNames: ['Panorama Vilnius', 'Laisvės kelias', 'Akropolis'],
            screenRows: [
              { name: 'Panorama Vilnius' },
              { name: 'Laisvės kelias' },
              { name: 'Akropolis' },
            ],
          },
        },
      }),
      'clip-a|old.mp4|||'
    );
    expect(describeLiveUpdateNotice(published, withScreen)).toEqual([
      'Pakeistas transliacijų planas.',
    ]);
  });

  it('names a clip change and keeps the plan sentence when both happened', () => {
    const published = buildOrderLiveSnapshot(
      liveOrder({ to: '2026-09-20' }),
      'clip-a|old.mp4|||'
    );
    const current = buildOrderLiveSnapshot(
      liveOrder({ to: '2026-09-25' }),
      'clip-a|old.mp4|||;clip-b|JAU_10_METU_su_laikmaciu.mp4|||'
    );
    expect(describeLiveUpdateNotice(published, current, { publishedClipCount: 1 })).toEqual([
      'Pakeistas transliacijų planas.',
      'Įkeltas papildomas klipas „Jau 10 metų...“',
    ]);
  });

  it('names a replaced clip and a deleted clip from the published stamp', () => {
    const published = buildOrderLiveSnapshot(
      liveOrder({}),
      'clip-a|old.mp4|||;clip-b|gone.mp4|||'
    );
    const current = buildOrderLiveSnapshot(
      liveOrder({}),
      'clip-a|new.mp4|||'
    );
    expect(describeLiveUpdateNotice(published, current)).toEqual([
      'Ištrintas klipas „Gone“',
      'Pakeistas klipas „New“',
    ]);
  });

  it('calls the first upload new and a later one additional', () => {
    const published = buildOrderLiveSnapshot(liveOrder({}), '');
    const current = buildOrderLiveSnapshot(liveOrder({}), 'clip-a|first.mp4|||');
    expect(
      describeLiveUpdateNotice(published, current, {
        publishedClipCount: 0,
        clips: [
          {
            id: 'clip-a',
            filename: 'first.mp4',
            uploadedAt: '2026-09-25T16:00:00.000Z',
            fileChange: 'added',
          },
        ],
      })
    ).toEqual(['Įkeltas naujas klipas „First“ 2026-09-25, 19:00']);
    expect(
      describeLiveUpdateNotice(published, current, {
        publishedClipCount: 0,
        publishedAt: '2026-09-18T12:31:46.242Z',
        clips: [{ id: 'clip-a', filename: 'first.mp4', fileChange: 'added' }],
      })
    ).toEqual(['Įkeltas naujas klipas „First“']);
  });

  it('names Polestar clip uploads and does not say the plan changed', () => {
    const order = liveOrder({
      client: 'Polestar',
      intensity: 'Max',
      details: {
        isTest: true,
        plan: {
          intensity: 'Max',
          screenNames: ['Panorama', 'Mada'],
          screenRows: [
            { name: 'Panorama', from: '2026-09-18', to: '2026-09-24' },
            { name: 'Mada', from: '2026-09-18', to: '2026-09-24' },
          ],
        },
      },
    });
    const published = snapshotFromLiveState(
      {
        status: 'live',
        screenNames: ['Mada', 'Panorama'],
        publishedAt: '2026-09-18T12:31:46.242Z',
        clipCount: 2,
      },
      order
    );
    const current = buildOrderLiveSnapshot(order, '');
    expect(
      describeLiveUpdateNotice(published, current, {
        publishedClipCount: 2,
        publishedAt: '2026-09-18T12:31:46.242Z',
        intensityPublished: 'Max',
        intensityCurrent: 'Max',
        clips: [
          {
            id: 'clip-1790355420741-2ht6noki',
            filename: 'JAU_10_METU_su_laikmaciu.mp4',
            uploadedAt: '2026-09-25T16:57:00.741Z',
          },
          {
            id: 'clip-1790356401003-n7rekki4',
            filename: 'Polestar Volvo.mp4',
            uploadedAt: '2026-09-25T17:13:21.003Z',
            fileChange: 'added',
          },
        ],
      })
    ).toEqual([
      'Įkeltas papildomas klipas „Jau 10 metų...“ 2026-09-25, 19:57',
      'Įkeltas papildomas klipas „Polestar Volvo“ 2026-09-25, 20:13',
    ]);
  });

  it('uses a stored removal time and leaves the time off when it is missing', () => {
    const published = buildOrderLiveSnapshot(liveOrder({}), 'clip-b|gone.mp4|||');
    const current = buildOrderLiveSnapshot(liveOrder({}), '');
    expect(
      describeLiveUpdateNotice(published, current, {
        removals: [
          {
            id: 'clip-b',
            filename: 'gone.mp4',
            at: '2026-09-25T17:13:17.340Z',
          },
        ],
      })
    ).toEqual(['Ištrintas klipas „Gone“ 2026-09-25, 20:13']);
    expect(describeLiveUpdateNotice(published, current)).toEqual(['Ištrintas klipas „Gone“']);
  });
});
