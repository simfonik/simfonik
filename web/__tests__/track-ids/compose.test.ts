import { describe, expect, it } from 'vitest';
import tapes from '@/data/tapes.json';
import { clock, composeId, composeRemoval, idAt, idLabel, idPlace, readComposed, splitComposed, splitPost, type TrackId } from '@/lib/track-ids/compose';

type Tape = { id: string; sides: { position: string }[] };

describe('IDs the site writes', () => {
  it('writes a time the way people do', () => {
    expect(clock(5)).toBe('0:05');
    expect(clock(754)).toBe('12:34');
    expect(clock(3723)).toBe('1:02:03');
    expect(clock(754.9)).toBe('12:34');
  });

  it('writes one line: the side, the time, the artist and the title', () => {
    expect(composeId({ position: 'B', time: 754, artist: ' Moby ', title: 'Go' })).toBe('[B 12:34] Moby - Go');
    expect(composeId({ position: null, time: 3723, artist: 'LFO', title: 'LFO  (Leeds Warehouse Mix)' })).toBe('[1:02:03] LFO - LFO (Leeds Warehouse Mix)');
    // A name the visitor didn't know keeps its place.
    expect(composeId({ position: '1A', time: 5, artist: '', title: 'Go' })).toBe('[1A 0:05] ? - Go');
  });

  it('reads back exactly what it wrote, on every side of every tape', () => {
    const names = [['Moby', 'Go'], ['The Prodigy', 'Out Of Space (Remix)'], ['808 State', 'Cubik - Kings County Perspective'], ['', 'Side Two'], ['DJ Trance', '']];
    for (const tape of tapes as Tape[]) {
      const positions = tape.sides.map((s) => s.position);
      tape.sides.forEach((side, index) => {
        for (const time of [0, 5, 754, 3723]) {
          for (const [artist, title] of names) {
            const written = composeId({ position: positions.length > 1 ? side.position : null, time, artist, title });
            expect(readComposed(written, positions), `${tape.id} ${written}`).toEqual([{ side: index, start: time, artist, title, gone: false }]);
          }
        }
      });
    }
  });

  it('takes its own form apart without knowing the tape, for showing in the comments', () => {
    expect(splitComposed('[1B 1:02:03] ? - Go')).toEqual({ position: '1B', time: 3723, artist: '', title: 'Go', gone: false });
    expect(splitComposed('[0:05] Moby - Go')).toEqual({ position: null, time: 5, artist: 'Moby', title: 'Go', gone: false });
    expect(splitComposed('I think [0:05] Moby - Go')).toBeNull();
  });

  it('writes and reads the line that takes a mark away', () => {
    expect(composeRemoval({ position: 'B', time: 754 })).toBe('[B 12:34] no track starts here');
    expect(composeRemoval({ position: null, time: 5 })).toBe('[0:05] no track starts here');
    expect(splitComposed('[B 12:34] no track starts here')).toEqual({ position: 'B', time: 754, artist: '', title: '', gone: true });
    expect(readComposed('[0:05] no track starts here', ['A'])).toEqual([{ side: 0, start: 5, artist: '', title: '', gone: true }]);
  });

  it('reads a post of several lines as so many IDs, and a comment with any talk in it as talk', () => {
    const post = ['[A 0:00] The Prodigy - Hyperspeed', '[A 3:41] Butsch - The Count', '', '[A 2:10] no track starts here'].join('\n');
    expect(splitPost(post)?.map((id) => [id.time, id.artist, id.gone])).toEqual([[0, 'The Prodigy', false], [221, 'Butsch', false], [130, '', true]]);
    expect(readComposed(post, ['A', 'B'])?.map((id) => [id.side, id.start])).toEqual([[0, 0], [0, 221], [0, 130]]);
    expect(splitPost('[A 0:00] The Prodigy - Hyperspeed\nwhat a tune')).toBeNull();
    expect(splitPost('   ')).toBeNull();
    // One line for a side the tape doesn't have, and the whole comment is left to the reader of prose.
    expect(readComposed('[A 0:00] The Prodigy - Hyperspeed\n[C 3:41] Butsch - The Count', ['A', 'B'])).toBeNull();
  });

  it('leaves anything else to the reader of prose', () => {
    const positions = ['A', 'B'];
    expect(readComposed('12:34 Moby - Go', positions)).toBeNull();
    expect(readComposed('great tape! [B 12:34] Moby - Go', positions)).toBeNull();
    // A side the tape doesn't have, and no side on a tape that has two.
    expect(readComposed('[C 12:34] Moby - Go', positions)).toBeNull();
    expect(readComposed('[12:34] Moby - Go', positions)).toBeNull();
    expect(readComposed('[12:34] Moby - Go', ['A'])).toEqual([{ side: 0, start: 754, artist: 'Moby', title: 'Go', gone: false }]);
  });
});

describe('the ID at a moment of the tape', () => {
  const ids: TrackId[] = [
    { start: 0, end: 120, artist: 'Moby', title: 'Go', known: true, by: 'a', date: '2020-01-01' },
    { start: 120, end: 300, artist: '', title: '', known: false, by: 'b', date: '2020-01-01' },
    { start: 400, end: 500, artist: '', title: 'Cubik', known: true, by: 'c', date: '2020-01-01' },
  ];

  it('is the track whose stretch holds that moment, and nothing in a gap', () => {
    expect(idAt(ids, 0)?.title).toBe('Go');
    expect(idAt(ids, 119.9)?.title).toBe('Go');
    expect(idAt(ids, 120)?.known).toBe(false);
    expect(idAt(ids, 350)).toBeNull();
    expect(idAt(ids, 499)?.title).toBe('Cubik');
    expect(idAt(ids, 500)).toBeNull();
    expect(idAt([], 10)).toBeNull();
  });

  it('is said in one line', () => {
    expect(idLabel(ids[0])).toBe('Moby — Go');
    expect(idLabel(ids[1])).toBe('Unknown track');
    expect(idLabel(ids[2])).toBe('Cubik');
  });
  it('says where an ID is the way the player writes times, with the side first on a tape that has sides', () => {
    expect(idPlace('A', 115)).toBe('A 0:01:55');
    expect(idPlace('1B', 3723)).toBe('1B 1:02:03');
    expect(idPlace(null, 115)).toBe('0:01:55');
  });
});
