import { describe, expect, it } from 'vitest';
import { buildPartnerPackageEmailHtml } from './partner-plan-email';

describe('buildPartnerPackageEmailHtml', () => {
  it('į href įdeda visą patvirtinimo adresą, net jei kodas baigiasi brūkšneliu', () => {
    const html = buildPartnerPackageEmailHtml({
      campaign: 'Meliva & ruduo',
      clipUrl: 'https://files.example/klipas-',
      note: 'Pastaba <b>ne html</b>',
      confirmToken: 'abcDEF123456789-',
    });

    expect(html).toContain('href="http://localhost:3000/c/abcDEF123456789-"');
    expect(html).toContain('href="https://files.example/klipas-"');
    expect(html).toContain('Meliva &amp; ruduo');
    expect(html).not.toContain('<b>ne html</b>');
  });
});
