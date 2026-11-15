// The player's scrub bar is drawn from each side's measured loudness (lib/waveform.ts).
import { describe, expect, it } from 'vitest';
import { outline, thin } from '@/lib/waveform';

const points = (mask: string) => decodeURIComponent(mask).match(/points="([^"]+)"/)![1].split(' ').map((p) => p.split(',').map(Number));

describe('fewer levels for a narrow bar', () => {
  it('takes the mean of the levels each one replaces', () => {
    expect(thin([0, 100, 200, 100, 50, 50], 3)).toEqual([50, 150, 50]);
  });

  it('keeps every part of the side, whatever the counts', () => {
    const levels = Array.from({ length: 600 }, (_, i) => i % 256);
    const out = thin(levels, 300);
    expect(out).toHaveLength(300);
    expect(out[0]).toBe(1); // the mean of 0 and 1, rounded
    expect(out[299]).toBe(Math.round((levels[598] + levels[599]) / 2));
  });

  it('leaves a list that is already short enough alone', () => {
    const levels = [10, 20, 30];
    expect(thin(levels, 300)).toBe(levels);
  });
});

describe('the outline of a side’s sound', () => {
  it('is mirrored about the middle: loud is tall, quiet is thin', () => {
    const [loudTop, quietTop, quietBottom, loudBottom] = points(outline([255, 64]));
    expect(loudTop).toEqual([0, 0]);
    expect(loudBottom).toEqual([0, 100]);
    expect(quietTop[1]).toBeCloseTo(50 - (64 / 255) * 50, 1);
    expect(quietBottom[1]).toBeCloseTo(50 + (64 / 255) * 50, 1);
  });

  it('keeps a hairline through silence, and never grows past the bar', () => {
    const [silentTop, loudTop, , silentBottom] = points(outline([0, 999]));
    expect(silentBottom[1] - silentTop[1]).toBeCloseTo(10, 1);
    expect(loudTop).toEqual([1, 0]);
  });

  it('is a picture a stylesheet can use as a mask', () => {
    expect(outline([10, 20, 30])).toMatch(/^url\("data:image\/svg\+xml,/);
  });
});
