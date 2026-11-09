import { describe, expect, it } from 'vitest';
import { isViaductOrder } from '@/lib/viaduct-order';

describe('isViaductOrder', () => {
  it('reads the order flag even when the client name hides it', () => {
    expect(isViaductOrder({ viaduct: true })).toBe(true);
    expect(
      isViaductOrder({
        viaduct: false,
        details: { plan: { viaduct: true } },
      })
    ).toBe(true);
  });

  it('treats a regular order as screens', () => {
    expect(isViaductOrder({ viaduct: false, intensity: 'Kas 4' })).toBe(false);
    expect(
      isViaductOrder({
        viaduct: false,
        intensity: 'Kas 2 minutės',
      })
    ).toBe(true);
  });
});
