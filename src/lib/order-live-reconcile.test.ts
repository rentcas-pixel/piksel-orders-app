import { beforeEach, describe, expect, it, vi } from 'vitest';

const unpublishOrderFromPlayer = vi.fn();

vi.mock('@/lib/player-bridge', () => ({
  publishOrderToPlayer: vi.fn(),
  unpublishOrderFromPlayer: (...args: unknown[]) => unpublishOrderFromPlayer(...args),
}));

vi.mock('@/lib/order-clips', () => ({
  listOrderClips: vi.fn(async () => []),
  resolveOrderClipScreens: vi.fn(async () => []),
  evaluateOrderClips: vi.fn(() => ({
    pikselScreens: [],
    missingScreenResolutions: false,
    required: [],
    matchedAssignments: [],
    result: { coveredKeys: [] },
  })),
}));

vi.mock('@/lib/test-orders', () => ({
  isTestOrder: (order: { id?: string } | null | undefined) => String(order?.id || '').startsWith('test-'),
  getTestOrder: () => null,
  upsertTestOrder: (order: unknown) => order,
}));

import { reconcileOrderLiveState } from '@/lib/order-live';
import type { Order } from '@/types';

function order(live: Order['details']): Order {
  return {
    id: 'test-open',
    client: 'Polestar',
    agency: '',
    invoice_id: '1',
    approved: true,
    viaduct: false,
    from: '2026-09-21',
    to: '2026-09-27',
    media_received: false,
    final_price: 0,
    invoice_sent: false,
    updated: '2026-09-25',
    details: { isTest: true, ...live },
  };
}

describe('reconcileOrderLiveState on open', () => {
  beforeEach(() => {
    unpublishOrderFromPlayer.mockReset();
  });

  it('does not call the player for a local Live flag', async () => {
    const result = await reconcileOrderLiveState(
      order({ live: { status: 'live', screenNames: ['Panorama'] } })
    );
    expect(unpublishOrderFromPlayer).not.toHaveBeenCalled();
    expect(result.state.status).toBe('idle');
    expect(result.notice).toBeUndefined();
  });

  it('keeps the window data when the player rejects the key', async () => {
    unpublishOrderFromPlayer.mockRejectedValue(
      new Error('Grotuvo serveris užrakintas. Live raktas nepriimtas.')
    );
    const result = await reconcileOrderLiveState(
      order({
        live: {
          status: 'live',
          publishedAt: '2026-09-25T10:00:00.000Z',
          playerApi: 'https://player.piksel.lt',
        },
      })
    );
    expect(unpublishOrderFromPlayer).toHaveBeenCalledTimes(1);
    expect(result.state.status).toBe('live');
    expect(result.notice).toContain('nekeista');
  });
});
