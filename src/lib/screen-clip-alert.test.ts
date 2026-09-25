import { describe, expect, it } from 'vitest';
import { collectOrderScreenAlerts, isListMediaScreenAlert, orderLiveSeenOnPlayer, resolveScreenClipAlert } from '@/lib/screen-clip-alert';

describe('resolveScreenClipAlert', () => {
  it('alerts when the screen has no clip', () => {
    expect(
      resolveScreenClipAlert({
        hasClip: false,
        deviceStatus: 'online',
        liveExpected: true,
        delivered: true,
      })?.code
    ).toBe('no-clip');
  });

  it('alerts when the screen is off, even if a clip exists', () => {
    expect(
      resolveScreenClipAlert({
        hasClip: true,
        deviceStatus: 'offline',
        liveExpected: true,
        delivered: false,
      })
    ).toMatchObject({ code: 'off', label: 'Išjungtas' });
    expect(
      resolveScreenClipAlert({
        hasClip: true,
        deviceStatus: 'missing',
        liveExpected: true,
        delivered: false,
      })?.code
    ).toBe('off');
  });

  it('alerts when Live was sent but the clip did not reach an online screen', () => {
    expect(
      resolveScreenClipAlert({
        hasClip: true,
        deviceStatus: 'online',
        liveExpected: true,
        delivered: false,
      })
    ).toMatchObject({ code: 'not-delivered', label: 'Nenuėjo' });
  });

  it('is quiet when clip is ready, screen is on, and nothing was sent yet', () => {
    expect(
      resolveScreenClipAlert({
        hasClip: true,
        deviceStatus: 'online',
        liveExpected: false,
        delivered: false,
      })
    ).toBeNull();
  });

  it('marks Išsiųsta when the clip reached an online screen', () => {
    expect(
      resolveScreenClipAlert({
        hasClip: true,
        deviceStatus: 'online',
        liveExpected: true,
        delivered: true,
      })
    ).toMatchObject({ code: 'sent', kind: 'ok', label: 'Išsiųsta' });
  });
});

describe('collectOrderScreenAlerts', () => {
  it('flags a covered screen that has no player', () => {
    const now = new Date().toISOString();
    const alerts = collectOrderScreenAlerts({
      screens: [{ name: 'Laisvės kelias' }, { name: 'Panorama' }],
      coveredScreenNames: ['Laisvės kelias', 'Panorama'],
      devices: [
        {
          deviceCode: 'PIK-1',
          screenName: 'Panorama',
          width: 1152,
          height: 576,
          lastSeenAt: now,
        },
      ],
      monitors: [
        {
          device: {
            deviceCode: 'PIK-1',
            screenName: 'Panorama',
            width: 1152,
            height: 576,
            lastSeenAt: now,
          },
          status: 'online',
          ageMs: 0,
          playlistCount: 1,
          campaignCount: 1,
          campaigns: ['Locals'],
          rotation: [{ id: 'clip-1', campaignId: 'test-1', campaign: 'Locals' }],
          nowPlaying: null,
          previewUrl: null,
        },
      ],
      liveExpected: true,
      orderId: 'test-1',
      client: 'Locals',
    });
    expect(alerts).toEqual([
      expect.objectContaining({
        name: 'Laisvės kelias',
        alert: expect.objectContaining({
          code: 'off',
          label: 'Išjungtas',
          deviceStatus: 'missing',
        }),
      }),
    ]);
  });

  it('does not flag Nenuėjo after Live already sent to that screen', () => {
    const now = new Date().toISOString();
    const alerts = collectOrderScreenAlerts({
      screens: [{ name: 'Panorama' }],
      coveredScreenNames: ['Panorama'],
      devices: [
        {
          deviceCode: 'PIK-1',
          screenName: 'Panorama',
          width: 1152,
          height: 576,
          lastSeenAt: now,
        },
      ],
      monitors: [],
      liveExpected: true,
      sentScreenNames: ['Panorama'],
      orderId: 'test-1',
      client: 'Polestar',
    });
    expect(alerts).toEqual([]);
  });
});

describe('isListMediaScreenAlert', () => {
  it('flags a plan screen with no player, but not a temporarily offline one', () => {
    expect(
      isListMediaScreenAlert({
        code: 'off',
        kind: 'alert',
        label: 'Išjungtas',
        title: 'neprijungtas',
        deviceStatus: 'missing',
      })
    ).toBe(true);
    expect(
      isListMediaScreenAlert({
        code: 'off',
        kind: 'alert',
        label: 'Išjungtas',
        title: 'atsijungęs',
        deviceStatus: 'offline',
      })
    ).toBe(false);
  });
});

describe('orderLiveSeenOnPlayer', () => {
  const panorama = (patch: {
    nowPlaying?: { id: string; campaignId: string; campaign: string } | null;
    rotation?: { id: string; campaignId: string; campaign: string }[];
    campaigns?: string[];
  }) => ({
    device: {
      deviceCode: 'PIK-1',
      screenName: 'Panorama',
      width: 1152,
      height: 576,
    },
    status: 'online' as const,
    ageMs: 0,
    playlistCount: 1,
    campaignCount: 1,
    campaigns: patch.campaigns || ['Maxima savaitė'],
    rotation: patch.rotation || [],
    nowPlaying: patch.nowPlaying === undefined
      ? { id: 'clip-new', campaignId: 'ord-1', campaign: 'Maxima savaitė' }
      : patch.nowPlaying,
    previewUrl: null,
  });

  const akropolis = (patch: {
    nowPlaying?: { id: string; campaignId: string; campaign: string } | null;
    rotation?: { id: string; campaignId: string; campaign: string }[];
  }) => ({
    device: {
      deviceCode: 'PIK-2',
      screenName: 'Akropolis',
      width: 1152,
      height: 576,
    },
    status: 'online' as const,
    ageMs: 0,
    playlistCount: 1,
    campaignCount: 1,
    campaigns: ['Maxima savaitė'],
    rotation: patch.rotation || [],
    nowPlaying: patch.nowPlaying === undefined ? null : patch.nowPlaying,
    previewUrl: null,
  });

  it('is true only when every published screen shows a clip from this version', () => {
    expect(
      orderLiveSeenOnPlayer(
        [
          panorama({}),
          akropolis({
            nowPlaying: { id: 'clip-new', campaignId: 'ord-1', campaign: 'Maxima savaitė' },
          }),
        ],
        'ord-1',
        ['Panorama', 'Akropolis'],
        ['clip-new']
      )
    ).toBe(true);
  });

  it('stays false when one screen still has the old clip and another is missing', () => {
    expect(
      orderLiveSeenOnPlayer(
        [
          panorama({
            nowPlaying: { id: 'clip-old', campaignId: 'ord-1', campaign: 'Maxima savaitė' },
          }),
        ],
        'ord-1',
        ['Panorama', 'Akropolis'],
        ['clip-new']
      )
    ).toBe(false);
  });

  it('does not treat a matching campaign name as this version', () => {
    expect(
      orderLiveSeenOnPlayer(
        [
          panorama({
            nowPlaying: null,
            campaigns: ['Maxima savaitė'],
          }),
        ],
        'ord-1',
        ['Panorama'],
        ['clip-new']
      )
    ).toBe(false);
  });
});
