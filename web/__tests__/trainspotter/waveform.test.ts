// The overview strip's outline of a side's sound (app/proto/trainspotter/waveform.ts).
import { describe, expect, it } from 'vitest';
import { outline } from '@/app/proto/trainspotter/waveform';

const points = (mask: string) => decodeURIComponent(mask).match(/points="([^"]+)"/)![1].split(' ').map((p) => p.split(',').map(Number));

describe('the outline of a side’s sound', () => {
  it('is mirrored about the middle: loud is tall, quiet is thin', () => {
    const [loudTop, quietTop, quietBottom, loudBottom] = points(outline([255, 64]));
    expect(loudTop).toEqual([0, 0]);
    expect(loudBottom).toEqual([0, 100]);
    expect(quietTop[1]).toBeCloseTo(50 - (64 / 255) * 50, 1);
    expect(quietBottom[1]).toBeCloseTo(50 + (64 / 255) * 50, 1);
  });

  it('keeps a hairline through silence, and never grows past the lane', () => {
    const [silentTop, , , silentBottom] = points(outline([0, 999]));
    expect(silentBottom[1] - silentTop[1]).toBeCloseTo(12, 1);
    expect(points(outline([0, 999]))[1]).toEqual([1, 0]);
  });

  it('is a picture a stylesheet can use as a mask', () => {
    expect(outline([10, 20, 30])).toMatch(/^url\("data:image\/svg\+xml,/);
  });
});
