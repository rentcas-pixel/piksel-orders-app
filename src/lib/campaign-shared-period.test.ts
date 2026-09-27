import { describe, expect, it } from 'vitest';
import { inheritSharedScreenPeriod } from '@/lib/campaign-shared-period';

describe('inheritSharedScreenPeriod', () => {
  it('moves screens that followed the old shared period and leaves a deliberate one', () => {
    const rows = inheritSharedScreenPeriod(
      [
        { name: 'Panorama', from: '2026-09-27', to: '2026-10-03' },
        { name: 'Akropolis', from: '2026-09-27', to: '2026-10-01', customPeriod: true },
      ],
      '2026-09-27',
      '2026-10-03',
      '2026-09-27',
      '2026-10-10'
    );
    expect(rows[0]).toMatchObject({ from: '2026-09-27', to: '2026-10-10' });
    expect(rows[1]).toMatchObject({ from: '2026-09-27', to: '2026-10-01' });
  });
});
