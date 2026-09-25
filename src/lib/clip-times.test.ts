import { describe, expect, it } from 'vitest';
import {
  appendClipRemoval,
  classifyNewClipChange,
  clipTimeLines,
  formatClipTime,
  looseRemovals,
  removalChangeLine,
  removalsForSlot,
  storedUploadTime,
} from '@/lib/clip-times';

const localClip = {
  id: 'clip-1750000000000-ab12cd',
  createdAt: '2026-09-25T11:10:00.000Z',
  uploadKind: 'static' as const,
  mimeType: 'video/mp4',
  resolutionKey: '1152x576',
};

describe('formatClipTime', () => {
  it('formats Europe/Vilnius as YYYY-MM-DD HH:mm', () => {
    expect(formatClipTime('2026-09-25T11:10:00.000Z')).toBe('2026-09-25 14:10');
    expect(formatClipTime('2026-01-15T12:00:00.000Z')).toBe('2026-01-15 14:00');
  });

  it('omits a missing or broken timestamp', () => {
    expect(formatClipTime(undefined)).toBeNull();
    expect(formatClipTime('ne data')).toBeNull();
  });
});

describe('clipTimeLines', () => {
  it('shows Įkelta from a stored local upload and hides server and screens', () => {
    expect(clipTimeLines(localClip).times).toEqual([
      { label: 'Įkelta', at: '2026-09-25 14:10' },
    ]);
    expect(clipTimeLines({ ...localClip, serverPath: '/media/a.mp4' } as never).times).toEqual([
      { label: 'Įkelta', at: '2026-09-25 14:10' },
    ]);
  });

  it('does not treat an imported createdAt as an upload time', () => {
    expect(
      storedUploadTime({
        id: 'media-from-player',
        createdAt: '2026-09-25T11:10:00.000Z',
      })
    ).toBeNull();
    expect(
      clipTimeLines({
        id: 'media-from-player',
        createdAt: '2026-09-25T11:10:00.000Z',
      }).times
    ).toEqual([]);
  });

  it('shows Serveryje and Ekranuose only from stored times', () => {
    const lines = clipTimeLines({
      ...localClip,
      uploadedAt: '2026-09-25T11:10:00.000Z',
      onServerAt: '2026-09-25T11:12:00.000Z',
      onScreensAt: '2026-09-25T12:01:00.000Z',
    });
    expect(lines.times).toEqual([
      { label: 'Įkelta', at: '2026-09-25 14:10' },
      { label: 'Serveryje', at: '2026-09-25 14:12' },
      { label: 'Ekranuose', at: '2026-09-25 15:01' },
    ]);
  });

  it('uses the order Live time only when this clip is in that publish', () => {
    const inPublish = clipTimeLines(localClip, {
      publishedAt: '2026-09-25T12:01:00.000Z',
      publishedClipIds: [localClip.id],
    });
    expect(inPublish.times.map((line) => line.label)).toEqual(['Įkelta', 'Ekranuose']);

    const otherClip = clipTimeLines(localClip, {
      publishedAt: '2026-09-25T12:01:00.000Z',
      publishedClipIds: ['clip-someone-else'],
    });
    expect(otherClip.times.map((line) => line.label)).toEqual(['Įkelta']);

    const emptyStamp = clipTimeLines(localClip, {
      publishedAt: '2026-09-25T12:01:00.000Z',
      publishedClipIds: [],
    });
    expect(emptyStamp.times.map((line) => line.label)).toEqual(['Įkelta']);
  });

  it('shows a change line only when a real change was stored', () => {
    expect(clipTimeLines(localClip).change).toBeNull();
    expect(
      clipTimeLines({
        ...localClip,
        fileChange: { kind: 'replaced', at: '2026-09-25T13:40:00.000Z' },
      }).change
    ).toEqual({ label: 'Pakeistas failas', at: '2026-09-25 16:40' });
  });
});

describe('classifyNewClipChange', () => {
  it('marks the first file of a kind as a new file', () => {
    expect(
      classifyNewClipChange(
        [{ ...localClip, uploadKind: 'video', id: 'clip-1' }],
        { ...localClip, id: 'clip-2' }
      )
    ).toBe('added');
  });

  it('marks the same resolution as a replacement and a different one as a new file', () => {
    expect(
      classifyNewClipChange([localClip], { ...localClip, id: 'clip-new' })
    ).toBe('replaced');
    expect(
      classifyNewClipChange([localClip], {
        ...localClip,
        id: 'clip-new',
        resolutionKey: '1920x1080',
      })
    ).toBe('added');
  });
});

describe('removal notices', () => {
  const removed = {
    clipId: 'clip-old',
    orderId: 'order-1',
    at: '2026-09-25T13:40:00.000Z',
    uploadKind: 'static' as const,
    resolutionKey: '1152x576',
    filename: 'old.mp4',
  };

  it('formats a removal and keeps it on the matching slot', () => {
    expect(removalChangeLine(removed)).toEqual({
      label: 'Pašalintas failas',
      at: '2026-09-25 16:40',
    });
    expect(removalsForSlot([removed], 'static', '1152x576')).toEqual([removed]);
    expect(removalsForSlot([removed], 'video', '1152x576')).toEqual([]);
    expect(looseRemovals([removed], 'static', ['1152x576'])).toEqual([]);
    expect(looseRemovals([{ ...removed, resolutionKey: null }], 'static', ['1152x576'])).toEqual([
      { ...removed, resolutionKey: null },
    ]);
  });

  it('appends a removal without dropping other orders', () => {
    const other = { ...removed, orderId: 'order-2', clipId: 'clip-other' };
    const next = appendClipRemoval([other], removed);
    expect(next.map((row) => row.orderId)).toEqual(['order-2', 'order-1']);
  });
});
