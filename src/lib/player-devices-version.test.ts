import { describe, expect, it } from 'vitest';
import { formatDeviceShellVersion } from '@/lib/player-devices';

describe('formatDeviceShellVersion', () => {
  it('shows the heartbeat version', () => {
    expect(formatDeviceShellVersion('0.5.5')).toBe('0.5.5');
  });

  it('shows a dash when an old player sent no version', () => {
    expect(formatDeviceShellVersion(null)).toBe('—');
    expect(formatDeviceShellVersion(undefined)).toBe('—');
    expect(formatDeviceShellVersion('')).toBe('—');
    expect(formatDeviceShellVersion('   ')).toBe('—');
  });
});
