import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { resolvePlanChangedAt, type PlanChangeSnapshot } from '@/lib/plan-changed-at';

const NOW = '2026-09-25T17:26:00.000Z';
const MEDIA_UPDATED = '2026-09-25T17:48:55.550Z';

function polestar(): PlanChangeSnapshot {
  return {
    id: 'test-1789734035648',
    from: '2026-09-18',
    to: '2026-09-24',
    intensity: 'Individualus',
    screens: ['9e9d2oezptn5ld7'],
    details: {
      plan: {
        intensity: 'Individualus',
        screenNames: ['Mada'],
        screenRows: [
          {
            name: 'Mada',
            catalogId: '9e9d2oezptn5ld7',
            from: '2026-09-18',
            to: '2026-09-24',
          },
        ],
      },
    },
  };
}

function calculatorPlan(overrides: Record<string, unknown> = {}) {
  return {
    from: '2026-09-18',
    to: '2026-09-24',
    intensity: 'Individualus',
    screens: [
      {
        active: true,
        id: 'local-mada',
        catalogId: '9e9d2oezptn5ld7',
        name: 'Mada',
        from: '2026-09-18',
        to: '2026-09-24',
      },
    ],
    ...overrides,
  };
}

function loadCalculatorStamp() {
  const source = readFileSync('public/skaiciuokle/app.js', 'utf8');
  const start = source.indexOf('function hubPlanText(');
  const end = source.indexOf('function upsertHubTestOrderFromPlan(');
  const context = vm.createContext({ Date });
  vm.runInContext(source.slice(start, end), context);
  return (existing: unknown, plan: unknown, nowIso: string) =>
    vm.runInContext('hubPlanChangedAt', context)(existing, plan, nowIso) as string;
}

describe('resolvePlanChangedAt', () => {
  it('leaves an existing plan without a time when dates, intensity, and screens stay', () => {
    const order = polestar();
    expect(resolvePlanChangedAt(order, order, NOW)).toBeUndefined();
    expect(resolvePlanChangedAt(order, { ...order, intensity: 'individualus' }, NOW)).toBeUndefined();
  });

  it('does not reuse a media-coverage or order updated time', () => {
    const order = polestar();
    expect(resolvePlanChangedAt(order, order, MEDIA_UPDATED)).toBeUndefined();
    expect(resolvePlanChangedAt(order, { ...order }, MEDIA_UPDATED)).not.toBe(MEDIA_UPDATED);
  });

  it('stamps a new time only when dates, intensity, or screens change', () => {
    const order = polestar();
    expect(resolvePlanChangedAt(order, { ...order, to: '2026-09-30' }, NOW)).toBe(NOW);
    expect(resolvePlanChangedAt(order, { ...order, intensity: 'Max' }, NOW)).toBe(NOW);
    expect(
      resolvePlanChangedAt(
        order,
        {
          ...order,
          screens: ['9e9d2oezptn5ld7', 'panorama-id'],
          details: {
            plan: {
              screenNames: ['Mada', 'Panorama'],
              screenRows: [
                { name: 'Mada', catalogId: '9e9d2oezptn5ld7', from: '2026-09-18', to: '2026-09-24' },
                { name: 'Panorama', catalogId: 'panorama-id', from: '2026-09-18', to: '2026-09-24' },
              ],
            },
          },
        },
        NOW
      )
    ).toBe(NOW);
  });

  it('keeps a previous plan time when a later save does not change the plan', () => {
    const order = polestar();
    order.details = { ...order.details, planChangedAt: '2026-09-25T17:10:00.000Z' };
    expect(resolvePlanChangedAt(order, order, NOW)).toBe('2026-09-25T17:10:00.000Z');
  });

  it('stamps a screen date change and ignores a brand new order', () => {
    const order = polestar();
    const shifted = {
      ...order,
      details: {
        plan: {
          screenNames: ['Mada'],
          screenRows: [
            { name: 'Mada', catalogId: '9e9d2oezptn5ld7', from: '2026-09-19', to: '2026-09-24' },
          ],
        },
      },
    };
    expect(resolvePlanChangedAt(order, shifted, NOW)).toBe(NOW);
    expect(resolvePlanChangedAt({ from: '2026-09-18' }, order, NOW)).toBeUndefined();
  });
});

describe('calculator plan stamp', () => {
  it('saves the same time as the order helper and skips an unchanged Polestar plan', () => {
    const stamp = loadCalculatorStamp();
    const order = polestar();
    expect(stamp(order, calculatorPlan(), NOW)).toBe('');
    expect(stamp(order, calculatorPlan(), MEDIA_UPDATED)).toBe('');
    expect(stamp({ ...order, updated: MEDIA_UPDATED }, calculatorPlan({ to: '2026-10-01' }), NOW)).toBe(NOW);
    expect(
      stamp(
        order,
        calculatorPlan({
          screens: [
            {
              active: true,
              id: 'local-mada',
              catalogId: '9e9d2oezptn5ld7',
              name: 'Mada',
              from: '2026-09-18',
              to: '2026-09-24',
            },
            {
              active: true,
              id: 'local-panorama',
              catalogId: 'panorama',
              name: 'Panorama',
              from: '2026-09-18',
              to: '2026-09-24',
            },
          ],
        }),
        NOW
      )
    ).toBe(NOW);
    const kept = {
      ...order,
      details: { ...order.details, planChangedAt: '2026-09-25T17:10:00.000Z' },
    };
    expect(stamp(kept, calculatorPlan({ intensity: 'Max' }), NOW)).toBe(NOW);
    expect(stamp(kept, calculatorPlan(), MEDIA_UPDATED)).toBe('2026-09-25T17:10:00.000Z');
  });
});
