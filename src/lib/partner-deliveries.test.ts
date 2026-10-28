import { describe, expect, it } from 'vitest';
import { createPartnerDeliveryToken } from './partner-deliveries';

describe('createPartnerDeliveryToken', () => {
  it('naudoja tik raides ir skaičius, be galinio brūkšnelio', () => {
    for (let i = 0; i < 200; i++) {
      const token = createPartnerDeliveryToken();
      expect(token).toMatch(/^[A-Za-z0-9]{16}$/);
      expect(token.endsWith('-')).toBe(false);
      expect(token.endsWith('_')).toBe(false);
    }
  });
});
