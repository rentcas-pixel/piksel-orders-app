import { describe, expect, it } from 'vitest';
import {
  createCampaignCalculator,
  type CampaignOrderInput,
  type CampaignScreen,
} from '@/lib/campaign-calculator';

const screen: CampaignScreen = {
  id: 's1',
  name: 'Ekranas',
  ots: 1,
  price: { '0': 1 },
};

function order(from: string, to: string): CampaignOrderInput {
  const grid = new Array(17 * 7).fill(0);
  grid[0] = 1;
  return {
    id: 'o1',
    client: 'Test',
    agency: 'Test',
    invoice_id: 1,
    viaduct: false,
    from,
    to,
    screens: [screen.id],
    grid,
    clip_duration: 10,
    viaduct_frequency: 1,
    discount: 0,
  };
}

describe('campaign day loop across DST', () => {
  it('finishes a range that includes the October clock change', () => {
    const calc = createCampaignCalculator(
      order('2026-10-18', '2026-10-31'),
      [screen],
      [],
      null
    );
    const started = Date.now();
    const views = calc.views(screen);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(Number.isFinite(views)).toBe(true);
    expect(views).toBeGreaterThan(0);
  });
});
