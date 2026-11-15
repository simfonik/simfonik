// The timeline's own rules for a track given from outside (app/proto/trainspotter/tracklist-primitive.ts).
import { describe, expect, it } from 'vitest';
import { tidyCue } from '@/app/proto/trainspotter/tracklist-primitive';

const SIDES = ['A', 'B', 'C', 'D'];

describe('a track written from outside', () => {
  it('keeps its times however long the part on screen is', () => {
    // A set of four tapes showing part A, 40 minutes long. A whole-tracklist write (an undo, a return visit)
    // carries part D's tracks too, and one of them starts 66 minutes in.
    const cue = tidyCue({ id: 'x', track: 'D', start: 4000, end: 4300, artist: 'Alpha', title: 'One', known: true }, SIDES)!;
    expect([cue.track, cue.start, cue.end]).toEqual(['D', 4000, 4300]);
  });

  it('is made whole: rounded, in order, at least five seconds, on a side the tape has', () => {
    const cue = tidyCue({ track: 'Z', start: 10.4, end: 11 }, SIDES)!;
    expect([cue.track, cue.start, cue.end]).toEqual(['A', 10, 15]);
    expect(tidyCue({ track: 'A', start: -5, end: 30 }, SIDES)!.start).toBe(0);
  });

  it('is refused without usable times', () => {
    expect(tidyCue({ track: 'A', start: Number.NaN }, SIDES)).toBeNull();
    expect(tidyCue({ track: 'A' }, SIDES)).toBeNull();
  });

  it('is known when it has a name, unless told otherwise', () => {
    expect(tidyCue({ track: 'A', start: 0, artist: 'Alpha' }, SIDES)!.known).toBe(true);
    expect(tidyCue({ track: 'A', start: 0 }, SIDES)!.known).toBe(false);
  });
});
