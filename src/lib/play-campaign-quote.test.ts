import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { quotePlayCampaign } from '@/lib/play-campaign-quote';
import { parsePikselScreenCatalog } from '@/lib/screen-catalog';

const catalog = parsePikselScreenCatalog(
  readFileSync(join(process.cwd(), 'public/skaiciuokle/screen-catalog.js'), 'utf8')
);
const fullGrid = Array.from({ length: 7 }, () => Array(17).fill(true));

describe('quotePlayCampaign', () => {
  it('prices one Panorama screen for 14 days and ignores a stored clip rate', () => {
    const quote = quotePlayCampaign(
      {
        id: 'test-1790481431166',
        client: 'QA Codex 2026-09-27 patikra',
        agency: 'QA patikra',
        invoice_id: '1790481431166',
        viaduct: false,
        from: '2026-09-27',
        to: '2026-10-10',
        screens: ['0n331qw8r35uiek'],
        grid: fullGrid,
        clip_duration: 10,
        details: {
          discount: 80,
          total: 264.21927,
          finalPrice: 264.21927,
          screenPrices: { '0n331qw8r35uiek': 0.0763 },
          plan: {
            grid: fullGrid,
            clip_duration: 10,
            screenRows: [
              {
                name: 'Panorama',
                city: 'Vilnius',
                catalogId: '0n331qw8r35uiek',
                impressions: 3570,
                ots: 379134,
                clipPrice: 0.0763,
                gross: 1361.955,
                net: 272.391,
              },
            ],
          },
        },
      },
      catalog
    );

    expect(quote.rows[0].impressions).toBe(7140);
    expect(quote.rows[0].ots).toBe(758268);
    expect(quote.rows[0].gross).toBeCloseTo(2723.91, 2);
    expect(quote.rows[0].net).toBeCloseTo(544.782, 2);
    expect(quote.rows[0].clipPrice).toBeCloseTo(0.0763, 4);
    expect(quote.screenPrices['0n331qw8r35uiek']).toBeCloseTo(544.782, 2);
    expect(quote.screenPrices['0n331qw8r35uiek']).toBeGreaterThan(1);
    expect(quote.finalPrice).toBeCloseTo(544.782, 2);
    expect(quote.amountDiscount).toBe(1);
    expect(quote.periodDiscount).toBe(2);
    expect(quote.total).toBeCloseTo(528.43854, 2);
    expect(quote.campaignOrder.details_final_price).toBeUndefined();
    expect(quote.campaignOrder.details_total).toBeUndefined();
  });

  it('keeps the 7-day Test sumos total', () => {
    const quote = quotePlayCampaign(
      {
        id: 'test-1790443431611',
        client: 'Test sumos',
        agency: 'BPN',
        invoice_id: '1790443431611',
        viaduct: false,
        from: '2026-09-26',
        to: '2026-10-02',
        screens: ['0n331qw8r35uiek', 'km2b43p066mhki3', '6c57a5845lt0v0e'],
        grid: fullGrid,
        clip_duration: 10,
        details: {
          discount: 80,
          plan: {
            grid: fullGrid,
            screenRows: [
              { name: 'Panorama', catalogId: '0n331qw8r35uiek' },
              { name: 'Laisvės kelias', catalogId: 'km2b43p066mhki3' },
              { name: 'Narbuto žiedas', catalogId: '6c57a5845lt0v0e' },
            ],
          },
        },
      },
      catalog
    );

    expect(quote.rows.map((row) => row.impressions)).toEqual([3570, 3570, 3570]);
    expect(quote.total).toBeCloseTo(784.48608, 2);
  });
});
