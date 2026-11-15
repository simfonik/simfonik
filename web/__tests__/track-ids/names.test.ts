import { describe, expect, it } from 'vitest';
import type { ListedTrack, TrackId } from '@/lib/track-ids/compose';
import { suggest } from '@/lib/track-ids/names';

const line = (n: number, artist: string, title: string, at?: number): ListedTrack => ({ n, artist, title, known: true, at });
const id = (start: number, artist: string, title: string): TrackId => ({ start, end: start + 240, artist, title, known: true, by: 'Rents' });

// Ten tracks on a side of 40 minutes: four minutes each, if they were all the same length.
const order = [
  line(1, 'Orbital', 'Chime'),
  line(2, 'Moby', 'Go'),
  line(3, 'Joey Beltram', 'Energy Flash'),
  line(4, 'LFO', 'LFO'),
  line(5, 'Altern 8', 'Infiltrate 202'),
  line(6, 'The Prodigy', 'Charly'),
  line(7, 'SL2', 'DJs Take Control'),
  line(8, 'Bizarre Inc', 'Playing With Knives'),
  line(9, 'Rhythm Section', 'Feel The Rhythm'),
  line(10, 'Shut Up And Dance', 'Raving I’m Raving'),
];
const numbers = (lines: ListedTrack[]) => lines.map((l) => l.n);

describe('names a list offers for a moment nobody has ID’d', () => {
  it('offers the two lines nearest to where the moment falls on the side, in list order', () => {
    expect(numbers(suggest(0, order, [], 2400))).toEqual([1, 2]);
    // Half way through the side is where the sixth track would start.
    expect(numbers(suggest(1200, order, [], 2400))).toEqual([5, 6]);
    expect(numbers(suggest(2300, order, [], 2400))).toEqual([9, 10]);
  });

  it('never offers a line that is already on the tape, and counts from the lines that are', () => {
    // The fourth and the eighth are ID’d, at 20:00 and 30:00: later than an even side would have them.
    const ids = [id(1200, 'LFO', 'LFO'), id(1800, 'Bizarre Inc', 'Playing With Knives')];
    // Between them are the fifth, sixth and seventh. A little past half way is the sixth, then the seventh.
    expect(numbers(suggest(1560, order, ids, 2400))).toEqual([6, 7]);
    // Before the fourth are the first three. A third of the way there is the second.
    expect(numbers(suggest(400, order, ids, 2400))).toEqual([1, 2]);
    // The moment the fourth starts is the fourth: the nearest lines not yet placed are offered.
    expect(numbers(suggest(1200, order, ids, 2400))).not.toContain(4);
  });

  it('prefers a line whose place takes in the moment to a nearer one whose place does not', () => {
    // The second is known to start at 30:00, so the first plays before that and the rest after.
    const ids = [id(1800, 'Moby', 'Go')];
    expect(numbers(suggest(600, order, ids, 2400))).toEqual([1, 3]);
    expect(numbers(suggest(600, order, ids, 2400, 1))).toEqual([1]);
  });

  it('goes by the IDs gone by where the side’s length is not known', () => {
    const ids = [id(0, 'Orbital', 'Chime'), id(300, 'Moby', 'Go')];
    expect(numbers(suggest(700, order, ids, null))).toEqual([3, 4]);
  });

  it('knows a short name is on the tape when the ID reads the same', () => {
    expect(numbers(suggest(300, order, [id(240, 'Moby', 'Go')], 2400))).not.toContain(2);
  });

  it('uses a time the list gives a line as it would an ID', () => {
    const timed = order.map((l) => (l.n === 6 ? { ...l, at: 600 } : l));
    // The sixth starts at 10:00 by the list, so 5:00 is half way through the five before it.
    expect(numbers(suggest(300, timed, [], 2400))).toEqual([3, 4]);
  });

  it('offers nothing where the list itself has the track down as unknown, or has no lines left', () => {
    const withUnknown: ListedTrack[] = [...order.slice(0, 2), { n: 3, artist: '', title: '', known: false, at: 480 }, ...order.slice(3)];
    expect(suggest(490, withUnknown, [], 2400)).toEqual([]);
    expect(suggest(100, order.slice(0, 1), [id(0, 'Orbital', 'Chime')], 2400)).toEqual([]);
  });
});
