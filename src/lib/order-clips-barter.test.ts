import { describe, expect, it } from 'vitest';
import {
  enrichScreensFromCatalog,
  evaluateOrderClips,
  type OrderClipRecord,
  type OrderClipScreen,
} from '@/lib/order-clips';
import { normalizeTestOrder, type TestOrder } from '@/lib/test-orders';

const PANORAMA = '0n331qw8r35uiek';
const COMPENSA = 'z4kvcyc17l4a3w1';
const MADA = '9e9d2oezptn5ld7';

function bareScreen(id: string, name: string): OrderClipScreen {
  return {
    id,
    name,
    city: 'Vilnius',
    owner: 'Piksel',
    type: null,
    resolution: null,
  };
}

function clip(id: string, kind: 'static' | 'video'): OrderClipRecord {
  return {
    id,
    orderId: 'test-barter',
    filename: kind === 'static' ? 'plakatas.jpg' : 'klipas.mp4',
    mimeType: kind === 'static' ? 'image/jpeg' : 'video/mp4',
    width: 1152,
    height: 576,
    resolutionKey: '1152x576',
    resolutionLabel: '1152 × 576',
    uploadKind: kind,
    createdAt: '2026-09-27T00:00:00.000Z',
  };
}

describe('barter clip screens', () => {
  it('fills resolution and type from the screen catalog', async () => {
    const screens = await enrichScreensFromCatalog(
      [
        bareScreen(PANORAMA, 'Panorama Vilnius'),
        bareScreen(COMPENSA, 'Compensa Vilnius'),
        bareScreen(MADA, 'Mada Vilnius'),
      ],
      { barter: true }
    );

    expect(screens.map((screen) => [screen.name, screen.resolution, screen.type])).toEqual([
      ['Panorama Vilnius', '1152 x 576', 'Statinis'],
      ['Compensa Vilnius', '1152 x 576', 'Video'],
      ['Mada Vilnius', '1152 x 576', 'Video'],
    ]);
  });

  it('leaves a paid order without the local catalog', async () => {
    const screens = await enrichScreensFromCatalog(
      [bareScreen(PANORAMA, 'Panorama Vilnius')],
      { barter: false }
    );
    expect(screens[0]?.resolution ?? null).toBeNull();
    expect(screens[0]?.type ?? null).toBeNull();
  });

  it('attaches a clip by catalog resolution and the file kind', async () => {
    const screens = await enrichScreensFromCatalog(
      [
        bareScreen(PANORAMA, 'Panorama Vilnius'),
        bareScreen(COMPENSA, 'Compensa Vilnius'),
        bareScreen(MADA, 'Mada Vilnius'),
      ],
      { barter: true }
    );
    const evaluation = evaluateOrderClips(screens, [clip('static-1', 'static')]);

    expect(evaluation.plan.missingScreenResolutions).toBe(false);
    expect(evaluation.plan.coverageLabel).not.toBe('Trūksta ekranų rezoliucijų');
    const covered = evaluation.plan.matchedAssignments[0]?.screenNames ?? [];
    expect(covered).toContain('Panorama Vilnius');
    expect(covered).not.toContain('Compensa Vilnius');
    expect(covered).not.toContain('Mada Vilnius');
  });
});

describe('normalizeTestOrder barter rows', () => {
  it('keeps catalog type and resolution and still drops the hour grid', () => {
    const order = {
      id: 'test-barter',
      client: 'Barteris',
      agency: 'Media House',
      invoice_id: '1790525438762',
      approved: true,
      viaduct: false,
      from: '2026-09-27',
      to: '2026-10-03',
      media_received: false,
      final_price: 0,
      invoice_sent: false,
      updated: '2026-09-27T00:00:00.000Z',
      grid: [[true]],
      details: {
        isTest: true as const,
        barter: true,
        barterPrice: 0,
        live: { status: 'idle' as const },
        barterScreens: [{ id: PANORAMA, name: 'Panorama Vilnius', city: 'Vilnius' }],
        plan: {
          screenRows: [
            {
              name: 'Panorama Vilnius',
              city: 'Vilnius',
              catalogId: PANORAMA,
              owner: 'Piksel',
              type: 'Statinis',
              resolution: '1152 x 576',
              net: 12,
              gross: 20,
              impressions: 4,
            },
          ],
          total: 99,
        },
      },
    } as TestOrder;

    const next = normalizeTestOrder(order);
    const row = next.details.plan?.screenRows?.[0];
    expect(next.grid).toBeUndefined();
    expect(next.final_price).toBe(0);
    expect(next.details.plan?.total).toBe(0);
    expect(row?.type).toBe('Statinis');
    expect(row?.resolution).toBe('1152 x 576');
    expect(row?.net).toBe(0);
    expect(row?.impressions).toBe(0);
  });
});
