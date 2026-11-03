import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import XLSX from 'xlsx-js-style';
import type { CampaignOrderInput, CampaignScreen } from '@/lib/campaign-calculator';
import { buildReklamosPlanasXlsxBuffer } from '@/lib/export-reklamos-planas';
import { mergePlanScreenIds } from '@/lib/reklamos-planas-data';

function screens(count: number): CampaignScreen[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `s${index}`,
    name: `Ekranas ${index}`,
    city: 'Vilnius',
    ots: 1,
    priority: count - index,
    price: { '0': 1 },
    link: 'https://piksel.lt',
  }));
}

function order(ids: string[]): CampaignOrderInput {
  const grid = new Array(17 * 7).fill(0);
  grid[0] = 1;
  return {
    id: 'o1',
    client: 'Test',
    agency: 'Test',
    invoice_id: 1,
    viaduct: false,
    from: '2026-09-21',
    to: '2026-10-01',
    screens: ids,
    grid,
    clip_duration: 10,
    viaduct_frequency: 1,
    discount: 0,
  };
}

describe('reklamos planas rows past 48 screens', () => {
  it('keeps view counts and borders on screens added past the old footer', async () => {
    const list = screens(52);
    const added = list.slice(48).map((screen) => screen.id);
    const { buffer } = await buildReklamosPlanasXlsxBuffer({
      order: order(added),
      partnerId: null,
      screens: list,
      bundles: [],
      mode: 'post-campaign',
    });
    const workbook = XLSX.read(buffer, { type: 'array', cellStyles: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // 49-as ekranas: 10 + 48×2.
    expect(sheet['C106']?.v).toBe('Ekranas 48');
    expect(sheet['H106']?.v).toBe('2026-09-21');
    expect(sheet['U106']?.v).toBeGreaterThan(0);
    expect(sheet['V106']?.v).toBeGreaterThan(0);
    expect(sheet['C112']?.v).toBe('Ekranas 51');
    expect(sheet['U112']?.v).toBeGreaterThan(0);
    expect(sheet['W112']?.v).toEqual(sheet['V112']?.v - sheet['U112']?.v);
    expect(sheet['J114']?.v).toBe('Viso:');

    const zip = await JSZip.loadAsync(buffer);
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheetXml).toContain('showGridLines="0"');
    expect(sheet['!ref']).toContain('206');
    expect(sheet['A200']).toBeTruthy();
    expect(sheet['X10']).toBeTruthy();
    expect(sheet['X200']).toBeTruthy();
    expect(sheet['C106']?.v).toBe('Ekranas 48');
  });
});

describe('mergePlanScreenIds', () => {
  it('adds plan screens that are missing from orders.screens', () => {
    const catalog = screens(4);
    const ids = mergePlanScreenIds(
      ['s0'],
      {
        details: {
          plan: {
            screenRows: [
              { catalogId: 's2', name: 'Ekranas 2' },
              { name: 'Ekranas 3', city: 'Vilnius' },
            ],
          },
        },
      },
      catalog
    );
    expect(ids).toEqual(['s0', 's2', 's3']);
  });
});
