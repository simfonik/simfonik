import { describe, expect, it } from 'vitest';
import comments from '@/data/tape-comments.json';
import tapes from '@/data/tapes.json';
import { clock, composeId, composeRemoval, ID_POST, idLabel, idPlace, readComposed, splitComposed } from '@/lib/track-ids/compose';

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

  it('closes up a dash inside an artist’s name, which would otherwise read back as where the title starts', () => {
    const written = composeId({ position: null, time: 60, artist: 'Jean - Michel Jarre', title: 'Oxygene - Part IV' });
    expect(written).toBe('[1:00] Jean-Michel Jarre - Oxygene - Part IV');
    expect(splitComposed(written)).toMatchObject({ artist: 'Jean-Michel Jarre', title: 'Oxygene - Part IV' });
    // A name that is only a question mark reads back as no name, as one left empty does.
    expect(splitComposed(composeId({ position: null, time: 60, artist: '?', title: 'Go' }))).toMatchObject({ artist: '', title: 'Go' });
    // Whatever the names, the line never reads as the one that takes a mark away.
    expect(splitComposed(composeId({ position: null, time: 60, artist: '', title: 'no track starts here' }))).toMatchObject({ title: 'no track starts here', gone: false });
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
            // And with the line of the list it is, whatever that line's own words.
            for (const [was, called] of names) {
              const renamed = composeId({ position: positions.length > 1 ? side.position : null, time, artist, title, line: { artist: was, title: called } });
              expect(readComposed(renamed, positions), `${tape.id} ${renamed}`).toEqual([{ side: index, start: time, artist, title, gone: false, line: { artist: was, title: called } }]);
            }
          }
        }
      });
    }
  });

  it('says which line of the list an ID is, where it names the track otherwise, and never of a mark with no name', () => {
    const line = { artist: 'Moby', title: 'Go' };
    expect(composeId({ position: 'B', time: 754, artist: 'Moby', title: 'Go (Woodtick Mix)', line })).toBe('[B 12:34] Moby - Go (Woodtick Mix) [was Moby - Go]');
    expect(splitComposed('[B 12:34] Moby - Go (Woodtick Mix) [was Moby - Go]')).toEqual({ position: 'B', time: 754, artist: 'Moby', title: 'Go (Woodtick Mix)', gone: false, line });
    expect(composeId({ position: null, time: 60, artist: '', title: '', line })).toBe('[1:00] ? - ?');
    // A title that ends in brackets of its own is a title.
    expect(splitComposed('[1:00] Moby - Go [Woodtick Mix]')).toEqual({ position: null, time: 60, artist: 'Moby', title: 'Go [Woodtick Mix]', gone: false });
    expect(splitComposed('[1:00] Moby - Go [was Moby - Go [Woodtick Mix]]')?.line).toEqual({ artist: 'Moby', title: 'Go [Woodtick Mix]' });
  });

  it('has a pattern a database can tell a post of IDs by, which says what the reader says of every comment', () => {
    const post = new RegExp(ID_POST, 'i');
    const posts = ['[1:00] Moby - Go', '[B 1:02:03] ? - ?', '[A 12:34] no track starts here', '[1:00] Moby - Go\n[2:00] LFO - LFO\n', '[1:00] Moby - Go\r\n[2:00] No Track Starts Here', '[B 12:34] Moby - Go (Woodtick Mix) [was Moby - Go]'];
    const talk = ['what a tape', '[1:00] great bit', 'Moby - Go at [1:00]', '[1:00] Moby - Go\nlove this one', 'Side A\n[00:00] Hope - Tree Frog', '[1:00]Moby - Go', ''];
    // (A line with a side's label is of a tape with sides, and one without is of a tape that is one recording.)
    const sides = (content: string) => (/^\[[AB] /.test(content) ? ['A', 'B'] : ['A']);
    for (const content of posts) expect([post.test(content), readComposed(content, sides(content)) !== null], content).toEqual([true, true]);
    for (const content of talk) expect([post.test(content), readComposed(content, sides(content)) !== null], content).toEqual([false, false]);
    // Every comment in the archive, each on its own tape: none was made with the form, and none reads as if it were.
    for (const [tapeId, said] of Object.entries(comments as Record<string, { content: string }[]>)) {
      const positions = (tapes as Tape[]).find((tape) => tape.id === tapeId)?.sides.map((side) => side.position) ?? [];
      for (const { content } of said) expect([post.test(content), readComposed(content, positions) !== null], content.slice(0, 60)).toEqual([false, false]);
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
    expect(readComposed(post, ['A', 'B'])?.map((id) => [id.side, id.start, id.artist, id.gone])).toEqual([[0, 0, 'The Prodigy', false], [0, 221, 'Butsch', false], [0, 130, '', true]]);
    expect(readComposed('[A 0:00] The Prodigy - Hyperspeed\nwhat a tune', ['A', 'B'])).toBeNull();
    expect(readComposed('   ', ['A', 'B'])).toBeNull();
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

describe('an ID, as the page says it', () => {
  const ids = [
    { artist: 'Moby', title: 'Go', known: true },
    { artist: '', title: '', known: false },
    { artist: '', title: 'Cubik', known: true },
  ];

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
