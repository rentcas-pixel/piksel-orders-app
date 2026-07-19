import { describe, expect, it } from 'vitest';
import {
  buildMediaBriefHtml,
  buildMediaBriefText,
  collectRequiredResolutions,
  evaluateMediaResolutions,
  formatResolution,
  parseResolution,
  resolutionKey,
} from '@/lib/media-resolution-check';

describe('parseResolution', () => {
  it('parses spaced x format', () => {
    expect(parseResolution('1152 x 576')).toEqual({ width: 1152, height: 576 });
  });

  it('parses thousand-separator dots', () => {
    expect(parseResolution('3.040 x 240')).toEqual({ width: 3040, height: 240 });
  });

  it('parses compact and unicode multiply', () => {
    expect(parseResolution('448×672')).toEqual({ width: 448, height: 672 });
    expect(parseResolution('960x576')).toEqual({ width: 960, height: 576 });
  });

  it('returns null for empty/invalid', () => {
    expect(parseResolution('')).toBeNull();
    expect(parseResolution('unknown')).toBeNull();
  });
});

describe('collectRequiredResolutions', () => {
  it('dedupes by resolution and keeps screen names', () => {
    const required = collectRequiredResolutions([
      { name: 'Ozas', resolution: '1152 x 576' },
      { name: 'Senukai', resolution: '1152 x 576' },
      { name: 'Kalvarijų', resolution: '448 x 672' },
      { name: 'Broken', resolution: '' },
    ]);

    expect(required).toHaveLength(2);
    expect(required[0].key).toBe('1152x576');
    expect(required[0].screenNames).toEqual(['Ozas', 'Senukai']);
    expect(required[1].label).toBe(formatResolution({ width: 448, height: 672 }));
  });
});

describe('buildMediaBriefText', () => {
  it('lists resolutions for email copy-paste', () => {
    const required = collectRequiredResolutions([
      { name: 'Ozas', resolution: '1152 x 576' },
      { name: 'Kalvarijų', resolution: '448 x 672' },
    ]);
    const text = buildMediaBriefText(required);
    expect(text).toBe(
      [
        'Reikalingi šie klipai:',
        '',
        '• 1152 × 576 — Ozas',
        '• 448 × 672 — Kalvarijų',
      ].join('\n')
    );

    const html = buildMediaBriefHtml(required);
    expect(html).toContain('<ul');
    expect(html).not.toContain('<strong>');
    expect(html).not.toContain('<table');
    expect(html).toContain('1152 × 576 — Ozas');
    expect(html).toContain('448 × 672 — Kalvarijų');
  });
});

describe('evaluateMediaResolutions', () => {
  it('marks complete when all required keys are covered', () => {
    const required = collectRequiredResolutions([
      { name: 'A', resolution: '1152 x 576' },
      { name: 'B', resolution: '448 x 672' },
    ]);
    const result = evaluateMediaResolutions(required, [
      {
        fileName: 'a.mp4',
        width: 1152,
        height: 576,
        key: resolutionKey({ width: 1152, height: 576 }),
        label: '1152 × 576',
      },
      {
        fileName: 'b.mp4',
        width: 448,
        height: 672,
        key: resolutionKey({ width: 448, height: 672 }),
        label: '448 × 672',
      },
    ]);

    expect(result.isComplete).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('reports missing and unmatched clips', () => {
    const required = collectRequiredResolutions([
      { name: 'A', resolution: '1152 x 576' },
      { name: 'B', resolution: '448 x 672' },
    ]);
    const result = evaluateMediaResolutions(required, [
      {
        fileName: 'extra.mp4',
        width: 1920,
        height: 1080,
        key: '1920x1080',
        label: '1920 × 1080',
      },
    ]);

    expect(result.isComplete).toBe(false);
    expect(result.missing.map((m) => m.key).sort()).toEqual(['1152x576', '448x672']);
    expect(result.unmatchedClips).toHaveLength(1);
  });
});
