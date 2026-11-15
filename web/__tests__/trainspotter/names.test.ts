// Names in order without times, and which of them could be an unnamed track (app/proto/trainspotter/names.ts).
import { describe, expect, it } from 'vitest';
import { placeNames, suggestNames } from '@/app/proto/trainspotter/names';
import type { Listed } from '@/app/proto/trainspotter/parse';
import type { Cue } from '@/app/proto/trainspotter/tracklist-primitive';

const name = (n: number, artist: string, at?: number): Listed => ({ side: 0, n, artist, title: artist ? 'Song' : '', known: Boolean(artist), author: 'Keeper', date: '2026-01-01', running: true, at });
const track = (start: number, artist = ''): Cue => ({ id: `t${start}`, track: 'A', start, end: start + 60, artist, title: artist ? 'Song' : '', known: Boolean(artist) });
const names = (l: Listed[]) => l.map((x) => x.artist);

// A keeper's side: Alpha at 0:00, two names with no time, Delta at 7:48, one more with no time, an unknown
// the keeper timed at 10:18, another with no time, and Golf at 16:04.
const order = [name(1, 'Alpha', 0), name(2, 'Bravo'), name(3, 'Charlie'), name(4, 'Delta', 468), name(5, 'Echo'), name(6, '', 618), name(7, 'Foxtrot'), name(8, 'Golf', 964)];
const timeline = [track(0, 'Alpha'), track(468, 'Delta'), track(618), track(964, 'Golf')];

describe('which track carries which listed name', () => {
  it('matches each name to its track', () => {
    const at = placeNames(order, timeline);
    expect(at.get(order[3])?.start).toBe(468);
    expect(at.has(order[1])).toBe(false);
  });

  it('gives a record that is listed twice its two tracks, in order', () => {
    const twice = [name(1, 'Theme'), name(2, 'Alpha'), name(3, 'Theme')];
    const at = placeNames(twice, [track(0, 'Theme'), track(200, 'Alpha'), track(430, 'Theme')]);
    expect(at.get(twice[0])?.start).toBe(0);
    expect(at.get(twice[2])?.start).toBe(430);
  });
});

describe('names offered for a track nobody has named', () => {
  const at = placeNames(order, timeline);
  const offer = (start: number) => names(suggestNames(track(start), order, at, [...timeline, track(start)]));

  it('offers the names whose place takes in the track, and only those', () => {
    expect(offer(180)).toEqual(['Bravo', 'Charlie']); // between Alpha at 0:00 and Delta at 7:48
    expect(offer(540)).toEqual(['Echo']); // between Delta at 7:48 and the keeper's unknown at 10:18
    expect(offer(800)).toEqual(['Foxtrot']); // between that unknown and Golf at 16:04
  });

  it('offers none for the track the list itself marks unknown', () => {
    expect(names(suggestNames(timeline[2], order, at, timeline))).toEqual([]);
  });

  it('offers none for a track that already has a name', () => {
    expect(suggestNames(timeline[1], order, at, timeline)).toEqual([]);
  });

  it('falls back to the nearest names in the order when no name’s place takes in the track', () => {
    expect(offer(1200)).toEqual(['Charlie', 'Echo', 'Foxtrot']); // after Golf, where the list has nothing left
  });
});
