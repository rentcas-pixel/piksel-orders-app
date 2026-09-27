import { describe, expect, it } from 'vitest';
import { campaignsOnHour } from '@/lib/device-schedule';
import type { PlayerCampaign } from '@/lib/player-devices';

function campaign(id: string, clips: number): PlayerCampaign {
  return {
    id,
    from: '2026-09-01',
    to: '2026-09-30',
    media: Array.from({ length: clips }, (_, index) => ({
      id: `${id}-${index}`,
      path: `${id}-${index}.mp4`,
    })),
  };
}

describe('hour occupancy counts orders', () => {
  it('counts a 2-clip order once and ignores the 23:00 blackout', () => {
    const campaigns = [campaign('paid', 2), campaign('other', 1)];
    expect(campaignsOnHour(campaigns, '2026-09-27', 22, {})).toBe(2);
    expect(campaignsOnHour([campaign('paid', 2)], '2026-09-27', 12, {})).toBe(1);
    expect(campaignsOnHour([campaign('paid', 2)], '2026-09-27', 23, {})).toBe(0);
  });
});
