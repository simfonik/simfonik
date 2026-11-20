// The reader of track IDs in comments (lib/track-ids/parse.ts), first written for the Trainspotter prototype.
//
// Two kinds of check. The first reads every archived comment on every tape and compares what comes out with a
// saved copy, so a change to the reader shows exactly which tracks on which tapes it moved; review the diff,
// and if it is what you meant, run `pnpm test -u` to accept it. The second states the reader's rules one at a
// time, on small made-up comments, so each rule has a test that fails when it breaks.
import { describe, expect, it } from 'vitest';
import comments from '@/data/tape-comments.json';
import tapes from '@/data/tapes.json';
import { settle } from '@/lib/track-ids/moments';
import { digest, parseComment, reconcile, runningOrders, sideNames, splitWholeTape, trusted, type Said, type SideNames, type Sighting } from '@/lib/track-ids/parse';

const clock = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** The tracks the reader makes of what was read, side by side: each side's moments (`reconcile`), laid out (`settle`). */
const tracksOf = (read: Sighting[], lengths: number[]) => reconcile(read, lengths).flatMap((moments, side) => settle(moments, lengths[side]).map((track) => ({ ...track, side })));

/** What the page would show for a tape: its timeline, then its running order, one line each. */
function shown(said: Said[], titles: SideNames): string[] {
  const { sightings, listed } = digest(said, titles);
  const timed = trusted(sightings, titles.length);
  return [
    ...tracksOf(timed, titles.map(() => Infinity)).map((p) => `side ${p.side} ${clock(p.start)} ${p.known ? `${p.artist} — ${p.title}` : `?? ${p.title}`.trim()} [${p.by}]`),
    ...runningOrders(listed, titles.length).flatMap((order, side) => order.map((l) => `order side ${side} no.${l.n} ${l.known ? `${l.artist} — ${l.title}` : `?? ${l.title}`.trim()} [${l.author}]`)),
  ];
}

const say = (content: string, author = 'Keeper', date = '2026-01-01'): Said => ({ author, date, content });
const AB = ['', ''];

describe('every archived comment', () => {
  it('reads as it did when this copy was saved', async () => {
    const all = comments as Record<string, { author: string; date: string; content: string }[]>;
    const lines = (tapes as { id: string; sides: { title?: string; djs?: { name: string }[] }[] }[]).flatMap((tape) => {
      const said = (all[tape.id] ?? []).map((c) => ({ author: c.author, date: c.date.slice(0, 10), content: c.content }));
      return shown(said, sideNames(tape.sides)).map((line) => `${tape.id} | ${line}`);
    });
    await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot('./archive.snapshot.txt');
  });
});

describe('a keeper’s running tracklist, posted again each time a track is ID’d', () => {
  const first = say(
    ['Side 1', 'Alpha - One', '7:48 ??', 'Bravo - Two', '10:18 ??', 'Charlie - Three', '', 'Side 2', '0:00 ?? (ambient)', '0:23 ??', 'Delta - Four', 'Echo - Five'].join('\n'),
    'Keeper',
    '2026-02-01',
  );
  const second = say(
    ['Found one!', 'Side 1', 'Alpha - One', 'Foxtrot - Six', 'Bravo - Two', '10:18 ??', 'Charlie - Three', '', 'Side 2', 'Golf - Seven', '0:23 ??', 'Delta - Four', 'Echo - Five'].join('\n'),
    'Keeper',
    '2026-03-01',
  );

  it('lets the newest version stand for the earlier ones', () => {
    const lines = shown([first, second], AB);
    // 7:48 was a question mark in February; in March it has a name, so the question mark is gone.
    expect(lines).not.toContain('side 0 0:07:48 ?? [Keeper]');
    expect(lines).toContain('side 0 0:10:18 ?? [Keeper]');
  });

  it('gives a name the time of the question mark it replaced', () => {
    const lines = shown([first, second], AB);
    expect(lines).toContain('side 0 0:07:48 Foxtrot — Six [Keeper]');
    expect(lines).toContain('side 1 0:00:00 Golf — Seven [Keeper]');
  });

  it('takes the first name on a side to start the side', () => {
    expect(shown([first, second], AB)).toContain('side 0 0:00:00 Alpha — One [Keeper]');
  });

  it('gives the side’s order from the newest version, counting the unknowns', () => {
    const lines = shown([first, second], AB);
    expect(lines).toContain('order side 0 no.1 Alpha — One [Keeper]');
    expect(lines).toContain('order side 0 no.2 Foxtrot — Six [Keeper]');
    expect(lines).toContain('order side 0 no.5 Charlie — Three [Keeper]');
    expect(lines).toContain('order side 1 no.3 Delta — Four [Keeper]');
  });

  it('assumes nothing where the keeper added or dropped a line', () => {
    const third = say(['Side 1', 'Alpha - One', 'Foxtrot - Six', 'Bravo - Two', 'Hotel - Eight', 'India - Nine', 'Charlie - Three'].join('\n'), 'Keeper', '2026-04-01');
    const lines = shown([first, second, third], ['']);
    // One line ("10:18 ??") became two, so neither new name is given 10:18.
    expect(lines.filter((l) => l.includes('0:10:18'))).toEqual([]);
    expect(lines).toContain('order side 0 no.4 Hotel — Eight [Keeper]');
  });

  it('believes a time someone stated over one it worked out', () => {
    const reply = say('Side 1 7:55 is Foxtrot - Six', 'Someone', '2026-02-15');
    const lines = shown([first, reply, second], AB);
    expect(lines).toContain('side 0 0:07:55 Foxtrot — Six [Someone]');
    expect(lines.filter((l) => l.includes('Foxtrot') && l.startsWith('side'))).toHaveLength(1);
  });

  it('keeps every playing of a record that is played more than once', () => {
    const before = say(['Side 1', '0:00 ?? (ambient)', '3:00 ??', 'Alpha - One', '7:10 ?? (ambient)', '12:00 ??', 'Bravo - Two', '30:15 ?? (ambient)'].join('\n'), 'Keeper', '2026-02-01');
    const after = say(['Side 1', 'Kilo - Theme', '3:00 ??', 'Alpha - One', 'Kilo - Theme', '12:00 ??', 'Bravo - Two', 'Kilo - Theme'].join('\n'), 'Keeper', '2026-03-01');
    const lines = shown([before, after], ['']);
    expect(lines.filter((l) => l.startsWith('side') && l.includes('Kilo'))).toEqual(['side 0 0:00:00 Kilo — Theme [Keeper]', 'side 0 0:07:10 Kilo — Theme [Keeper]', 'side 0 0:30:15 Kilo — Theme [Keeper]']);
  });

  it('drops a worked-out time for a record somebody timed elsewhere on the side', () => {
    // The keeper's list missed a track, so its lines sit one slot off; a reply had already timed Lima.
    const before = say(['Side 1', 'Alpha - One', '3:14 ??', '5:30 ??', 'Bravo - Two', 'Charlie - Three'].join('\n'), 'Keeper', '2026-02-01');
    const reply = say(['Side 1', '3:14 Lima - Eleven', '5:30 Mike - Twelve'].join('\n'), 'Someone', '2026-02-10');
    const after = say(['Side 1', 'Alpha - One', 'November - Thirteen', 'Lima - Eleven', 'Bravo - Two', 'Charlie - Three'].join('\n'), 'Keeper', '2026-03-01');
    const lines = shown([before, reply, after], ['']);
    // By the list's slots Lima would be at 5:30. The reply put it at 3:14, so the slot is not believed, and
    // what the reply put at 5:30 stays there.
    expect(lines.filter((l) => l.startsWith('side') && l.includes('0:05:30'))).toEqual(['side 0 0:05:30 Mike — Twelve [Someone]']);
  });

  it('puts a reply that gives no side on the side where the keeper’s list has that time', () => {
    const reply = say('0:23 is Juliet - Ten', 'Someone', '2026-02-15');
    expect(shown([first, reply], AB)).toContain('side 1 0:00:23 Juliet — Ten [Someone]');
  });

  it('is not used when its sides can’t be told', () => {
    const headless = say(['Alpha - One', 'Bravo - Two', 'Charlie - Three', 'Delta - Four', 'Echo - Five'].join('\n'));
    expect(shown([headless], AB)).toEqual([]);
    expect(shown([headless], [''])).toContain('order side 0 no.1 Alpha — One [Keeper]');
  });
});

describe('side headings', () => {
  const list = (a: string, b: string) => say([a, 'Alpha - One', 'Bravo - Two', 'Charlie - Three', b, 'Delta - Four', 'Echo - Five', 'Foxtrot - Six'].join('\n'));
  const sideOf = (lines: string[], name: string) => lines.find((l) => l.startsWith('order') && l.includes(name))?.match(/side (\d)/)?.[1];

  it.each([
    ['Side A', 'Side B'],
    ['A', 'B'],
    ['side uno', 'side dos'],
    ['Side 1', 'Side 2'],
    ['Side X', 'Side E'], // labels the page doesn't know, on a two-sided tape: taken in the order the tape runs
  ])('reads “%s” and “%s” as the first and second side', (a, b) => {
    const lines = shown([list(a, b)], AB);
    expect(sideOf(lines, 'Alpha')).toBe('0');
    expect(sideOf(lines, 'Delta')).toBe('1');
  });

  it('knows “side dos” without a “side uno” before it', () => {
    const lines = shown([say(['side dos:', '1. Alpha - One', '2. Bravo - Two', '3. Charlie - Three', '4. Delta - Four', '5. Echo - Five'].join('\n'))], AB);
    expect(sideOf(lines, 'Alpha')).toBe('1');
  });

  it('reads a side named by its own title, and lets the title beat a number', () => {
    const titles = ['Planet Earth', 'Technology Has Its Subliminal Side'];
    const lines = shown([say(['Side 1 - Technology Has Its Subliminal', '0:00 Alpha - One', '3:10 Bravo - Two', '6:00 Charlie - Three', 'Side 2 - Planet Earth', '0:00 Delta - Four', '4:00 Echo - Five', '8:00 Foxtrot - Six'].join('\n'))], titles);
    expect(lines).toContain('side 1 0:00:00 Alpha — One [Keeper]');
    expect(lines).toContain('side 0 0:00:00 Delta — Four [Keeper]');
  });

  it('does not take a record with “Part 1” in its name for the start of a side', () => {
    const lines = shown([say(['Side 2', '4:00 Acid Junkies Part 1 - Sector 9', '8:00 Bravo - Two', '12:00 Charlie - Three'].join('\n'))], AB);
    expect(lines).toContain('side 1 0:08:00 Bravo — Two [Keeper]');
  });

  // DX2: one side is DJ Dan's "Funky In The Place", the other Ron D Core's "Only For The Hardcore".
  describe('on a tape whose sides each have a DJ and a title', () => {
    const DX2 = sideNames([
      { title: 'Funky In The Place', djs: [{ name: 'DJ Dan' }] },
      { title: 'Only For The Hardcore', djs: [{ name: 'Ron D Core' }] },
    ]);
    const timed = (a: string, b: string) => say([a, '0:01 Alpha - One', '1:18 Bravo - Two', '3:12 Charlie - Three', '', b, '', '0:01 Delta - Four', '0:30 Echo - Five', '4:14 Foxtrot - Six'].join('\n'));

    it.each([
      ['DJ Dan - Funky In The Place', 'Ron D Core - Only For The Hardcore'],
      ['Funky In The Place (DJ Dan)', 'Only For The Hardcore (Ron D Core)'],
      ['Funky In The Place by DJ Dan', 'Tracklist for Ron D Core - Only For The Hardcore'],
    ])('reads “%s” and “%s”, the DJ and the title together, as the headings of those sides', (a, b) => {
      expect(shown([timed(a, b)], DX2)).toEqual([
        'side 0 0:00:01 Alpha — One [Keeper]',
        'side 0 0:01:18 Bravo — Two [Keeper]',
        'side 0 0:03:12 Charlie — Three [Keeper]',
        'side 1 0:00:01 Delta — Four [Keeper]',
        'side 1 0:00:30 Echo — Five [Keeper]',
        'side 1 0:04:14 Foxtrot — Six [Keeper]',
      ]);
    });

    it('still takes a record credited to one of its DJs for a record', () => {
      const lines = shown([list('Ron D Core - Only For The Hardcore', 'Ron D Core - Needle Damage')], DX2);
      expect(sideOf(lines, 'Needle Damage')).toBe('1');
      expect(sideOf(lines, 'Delta')).toBe('1');
    });
  });
});

// Circa ’92: five tapes, each one DJ’s set and named after them. What follows is how its commenters write.
describe('a set of several DJs’ tapes, where a side is known by who played it', () => {
  const CIRCA = sideNames(['Scott Hardkiss', 'Jon Williams', 'Barry Weaver', 'Doc Martin', 'Mark Lewis'].map((name) => ({ title: name, djs: [{ name }] })));
  const tracks = ['0:21 S’Xpress - Hey Music Lover (The Glass Cut)', '2:12 Messiah - There Is No Law', '3:54 Friends of Alex - What Is..? Fick Dich', '6:42 XTRO And Q Brik - Dikke Vette Pannekoeke'];
  const sidesOf = (lines: string[]) => [...new Set(lines.map((l) => l.match(/^side (\d)/)?.[1]))];

  it.each([
    ['Tracklist for Barry Weaver', '2'],
    ['Mark Lewis Tracklist', '4'],
    ['Current Tracklist for Scott Hardkiss:', '0'],
    ['Doc Martin tracklist:', '3'],
    ['Doc Martin’s set', '3'],
    ['Barry Weaver IDs', '2'],
    ['Jon Williams', '1'],
  ])('reads “%s” as the heading of that DJ’s side', (heading, side) => {
    expect(sidesOf(shown([say([heading, '', ...tracks].join('\n'))], CIRCA))).toEqual([side]);
  });

  it('knows a side with no title by the name of its DJ', () => {
    const untitled = sideNames([{ djs: [{ name: 'DJ Trance' }] }, { djs: [{ name: 'Fester' }] }]);
    expect(sidesOf(shown([say(['Fester', ...tracks].join('\n'))], untitled))).toEqual(['1']);
    expect(shown([say(['Fester’s side:', 'Alpha - One @ 12:00'].join('\n'))], untitled)).toEqual(['side 1 0:12:00 Alpha — One [Keeper]']);
  });

  it('does not take a DJ’s name in a sentence or in a record’s credit for a heading', () => {
    const lines = shown([say(['Tracklist for Barry Weaver', ...tracks, 'Doc Martin set the place on fire after this.', 'Mark Lewis - Tracklist Of Dreams', '9:34 Program 2 - Twister'].join('\n'))], CIRCA);
    expect(lines).toContain('side 2 0:09:34 Program 2 — Twister [Keeper]');
    expect(sidesOf(lines)).toEqual(['2']);
  });

  it('does not use a list that never says whose set it is', () => {
    // Cooper’s recap of Doc Martin’s set, posted on that set’s own page before the five pages became one.
    const recap = say(['here’s a recap with an addition', '', '00:45 Sil – Windows', '3:45 Coco Steele & Lovebomb – Feel It', '7:40 Bobby Konder’s – Nervous Acid'].join('\n'), 'Cooper', '2010-11-20');
    expect(shown([recap], CIRCA)).toEqual([]);
    // On a tape with two sides it is taken to open on the first, as it always was.
    expect(sidesOf(shown([recap], AB))).toEqual(['0']);
  });

  it('keeps a line that says its side with a letter', () => {
    expect(shown([say('(B) @21:35 is Alpha - One')], CIRCA)).toEqual(['side 1 0:21:35 Alpha — One [Keeper]']);
  });

  describe('a list posted again without its heading', () => {
    const first = say(['Tracklist for Barry Weaver', '', ...tracks, '14:03 ??'].join('\n'), 'Softboiled', '2026-11-01T03:25:47.164Z');
    const tidied = say(['Nice work Softboiled!! Thank you!! I added one ID and cleaned it up.', '', 'Intro (Frogs)', ...tracks, '14:03 D-Mob Featuring Gary Haisman – We Call It Acieeed (The Matey Beats)'].join('\n'), 'Josh McClintock', '2026-11-01T08:45:37.689Z');
    const again = say(['Wow! I thought that was it for sure.', '', 'Intro (Frogs)', ...tracks, '14:03 ??? unknown mix of D-Mob Featuring Gary Haisman – We Call It Acieeed (The Matey Beats)', '15:15 ??'].join('\n'), 'Josh McClintock', '2026-11-01T18:56:15.583Z');

    it('goes on the side of the list it repeats', () => {
      const lines = shown([first, tidied], CIRCA);
      expect(lines).toContain('side 2 0:14:03 D-Mob Featuring Gary Haisman — We Call It Acieeed (The Matey Beats) [Josh McClintock]');
      expect(sidesOf(lines)).toEqual(['2']);
    });

    it('is followed in turn by the next copy', () => {
      const lines = shown([first, tidied, again], CIRCA);
      expect(lines).toContain('side 2 0:15:15 ?? [Josh McClintock]');
      expect(sidesOf(lines)).toEqual(['2']);
    });

    it('is not taken for a copy of a list it shares nothing with', () => {
      const other = say(['Mark Lewis Tracklist', '', '0:01 DJ’s Unite Vol. 1 - A', '2:09 Modular Expansion - Cubes', '3:07 Awesome 3 - Don’t Go (Original Mix)'].join('\n'), 'Softboiled', '2026-11-01T02:00:00.000Z');
      const lines = shown([other, tidied], CIRCA);
      expect(sidesOf(lines)).toEqual(['4']);
    });

    it('is not placed when two sides have as much of it', () => {
      const twin = say(['Jon Williams Tracklist', '', ...tracks, '14:03 ??'].join('\n'), 'Someone', '2026-11-01T04:00:00.000Z');
      expect(sidesOf(shown([first, twin, tidied], CIRCA)).sort()).toEqual(['1', '2']);
      expect(shown([first, twin, tidied], CIRCA).filter((l) => l.includes('[Josh McClintock]'))).toEqual([]);
    });
  });
});

// DX2 again. Softboiled's list of DJ Dan's side has "23:25 ?? (Acapella)" over "23:40 Adam X & Frankie Bones -
// Getting High", and leaves out the "43:28 ??" of the list they posted in March.
describe('a list of a side with its times', () => {
  const march = say(['Alpha - One', 'Bravo - Two', '43:28 ??', 'Charlie - Three', '46:47 ??'].join('\n'), 'Keeper', '2026-03-30');
  const timed = ['0:01 Alpha - One', '23:25 ?? (Acapella)', '23:40 Bravo - Two', '43:04 Delta - Four', '44:26 Charlie - Three'];
  const november = (...more: string[]) => say([...timed, ...more].join('\n'), 'Keeper', '2026-11-20');
  const sideA = (said: Said[]) => shown(said, ['']).filter((l) => l.startsWith('side'));

  it('has two tracks where two of its lines are seconds apart', () => {
    expect(sideA([november()])).toEqual(['side 0 0:00:01 Alpha — One [Keeper]', 'side 0 0:23:25 ?? Acapella [Keeper]', 'side 0 0:23:40 Bravo — Two [Keeper]', 'side 0 0:43:04 Delta — Four [Keeper]', 'side 0 0:44:26 Charlie — Three [Keeper]']);
  });

  it('still takes someone else’s time that close for the same track', () => {
    const lines = sideA([november(), say('23:28 is Echo - Five', 'Other', '2026-11-21')]);
    expect(lines).toContain('side 0 0:23:25 Echo — Five [Other]');
    expect(lines).toContain('side 0 0:23:40 Bravo — Two [Keeper]');
  });

  it('answers a question mark its writer left there before and has not written again', () => {
    const lines = sideA([march, november('46:47 ??')]);
    expect(lines).not.toContain('side 0 0:43:28 ?? [Keeper]');
    expect(lines).toContain('side 0 0:46:47 ?? [Keeper]');
  });

  it('leaves the question mark where the list is someone else’s, or is past the list’s last time', () => {
    expect(sideA([march, say([...timed].join('\n'), 'Other', '2026-11-20')])).toContain('side 0 0:43:28 ?? [Keeper]');
    expect(sideA([march, november()])).toContain('side 0 0:46:47 ?? [Keeper]');
  });

  it('leaves it where the list has no question mark of its own, and so may only be what its writer knows', () => {
    const known = say(['0:01 Alpha - One', '23:40 Bravo - Two', '30:00 Echo - Five', '43:04 Delta - Four', '44:26 Charlie - Three'].join('\n'), 'Keeper', '2026-11-20');
    expect(sideA([march, known])).toContain('side 0 0:43:28 ?? [Keeper]');
  });
});

describe('single comments', () => {
  const one = (content: string, titles = AB) => parseComment(content, 'Someone', '2026-01-01', titles).map((s) => `side ${s.side} ${clock(s.start)} ${s.known ? `${s.artist} — ${s.title}` : `?? ${s.title}`.trim()}`);

  it('reads “the first track on Side A is…” as the start of that side', () => {
    expect(one('The first track on Side A is "The Camonist" by 3 Phase featuring Dr. Motte (Tresor).')).toEqual(['side 0 0:00:00 3 Phase featuring Dr. Motte (Tresor) — The Camonist']);
    expect(one('The first track after the intro on side A is Alpha - One')).toEqual([]);
  });

  it('reads two timed statements on one line as two', () => {
    expect(one('I remembered what the B side at 21:15 is! It’s Signs of Chaos - Funky Frequencies. And 15:28 on Side B is Funky Junky - Rushin')).toEqual([
      'side 1 0:21:15 Signs of Chaos — Funky Frequencies',
      'side 1 0:15:28 Funky Junky — Rushin',
    ]);
  });

  it('keeps a name’s own words', () => {
    expect(one(['Side A', '1:00 Rhythm Section - Is This Real', '2:00 Henry - Ease The Pain (7" Mellow Mix)', '3:00 Alpha - One'].join('\n'))).toEqual([
      'side 0 0:01:00 Rhythm Section — Is This Real',
      'side 0 0:02:00 Henry — Ease The Pain (7" Mellow Mix)',
      'side 0 0:03:00 Alpha — One',
    ]);
  });

  it('takes a bracketed remark with a time for a clue, not a title', () => {
    expect(one(['Side A', '17:06 (ambient)', '18:00 Alpha - One', '19:00 Bravo - Two'].join('\n'))[0]).toBe('side 0 0:17:06 ?? ambient');
  });

  it('does not read a hyphenated artist as a track number and a minute', () => {
    const lines = shown([say(['Side 1', 'Alpha - One', 'Bravo - Two', '9-10-Boy - Revenge of the Gatorade', 'Charlie - Three', 'Delta - Four'].join('\n'))], AB);
    expect(lines).toContain('order side 0 no.3 9-10-Boy — Revenge of the Gatorade [Keeper]');
  });

  it('leaves a track number written after the time out of the name', () => {
    expect(one(['Side A', '[0:00] 01 Pizzaman - Trippin on Sunshine', '[5:29] 02 Deee-Lite - Bring Me Your Love', '[12:31] 03 is that it - no name drum-a-pella'].join('\n'))).toEqual([
      'side 0 0:00:00 Pizzaman — Trippin on Sunshine',
      'side 0 0:05:29 Deee-Lite — Bring Me Your Love',
      'side 0 0:12:31 is that it — no name drum-a-pella',
    ]);
  });

  it('knows a track number past nine by the one before it, counting a line that has none', () => {
    expect(one(['Side A', '[24:46] 08 Rebirth - Migration', '[28:02] ???', '[31:49] 10 Da Juice - Come On', '[35:21] 11 DJ Edge - Acid'].join('\n'))).toEqual([
      'side 0 0:24:46 Rebirth — Migration',
      'side 0 0:28:02 ??',
      'side 0 0:31:49 Da Juice — Come On',
      'side 0 0:35:21 DJ Edge — Acid',
    ]);
  });

  it('keeps a number that is the artist’s own', () => {
    // Second, third and fourth in a list that isn't numbered.
    expect(one(['Side A', '[0:00] Alpha - One', '[3:00] 2 Bad Mice - Bombscare', '[6:00] 3 Phase - Der Klang Der Familie', '[9:00] 4 Hero - Cookin Up Yah Brain', '[12:00] 808 State - Cubik'].join('\n'))).toEqual([
      'side 0 0:00:00 Alpha — One',
      'side 0 0:03:00 2 Bad Mice — Bombscare',
      'side 0 0:06:00 3 Phase — Der Klang Der Familie',
      'side 0 0:09:00 4 Hero — Cookin Up Yah Brain',
      'side 0 0:12:00 808 State — Cubik',
    ]);
    // After its track number in one that is, and alone in a sentence.
    expect(one(['Side A', '[0:00] 01 Alpha - One', '[3:00] 02 2 Bad Mice - Bombscare', '[6:00] 03 Charlie - Three'].join('\n'))).toContain('side 0 0:03:00 2 Bad Mice — Bombscare');
    expect(one('Side A 16:09 is 1 Giant Leap - My Culture')).toEqual(['side 0 0:16:09 1 Giant Leap — My Culture']);
  });

  describe('where a track starts and where it ends', () => {
    const spans = (content: string) => parseComment(content, 'Someone', '2026-01-01', AB).map((s) => `side ${s.side} ${clock(s.start)}–${clock(s.end ?? NaN)} ${s.artist} — ${s.title}`);

    it('are read from a line of their own under the name', () => {
      expect(spans(['DJ Jesse - Lovecity (Side B)', '', '[0:00] 01 Aphrohead - In The Dark We Live', 'Anaconda - Speedway 69', '1:19 - 4:07', 'DJ Who - Shitty Samples On Acid', '6:20 - 10:12', '3. Convert - Nightbird', '20:17 - 22:24'].join('\n'))).toEqual([
        'side 1 0:00:00–NaN:NaN:NaN Aphrohead — In The Dark We Live',
        'side 1 0:01:19–0:04:07 Anaconda — Speedway 69',
        'side 1 0:06:20–0:10:12 DJ Who — Shitty Samples On Acid',
        'side 1 0:20:17–0:22:24 Convert — Nightbird',
      ]);
    });

    it('are read from in front of the name on its line', () => {
      expect(spans(['Side A', '28:00 - 30:50 Alpha - One'].join('\n'))).toEqual(['side 0 0:28:00–0:30:50 Alpha — One']);
    });

    it('leave a time alone under a name for what it was: a spot nobody has named', () => {
      const lines = shown([say(['Side 1', 'Alpha - One', '7:48', 'Bravo - Two', '10:18', 'Charlie - Three'].join('\n'))], ['']);
      expect(lines).toContain('side 0 0:07:48 ?? [Keeper]');
      expect(lines).toContain('side 0 0:10:18 ?? [Keeper]');
    });
  });
});

describe('a list that times a two-sided tape as one recording', () => {
  const A = 47 * 60 + 46; // our side A
  const B = 47 * 60 + 7;
  const at = (side: number, start: number, title: string, rest: Partial<Sighting> = {}): Sighting => ({ side, start, artist: 'Someone', title, known: true, author: 'Rents', date: '2026-01-21', ...rest });
  const where = (list: Sighting[]) => splitWholeTape(list, [A, B]).map((s) => `${'AB'[s.side]} ${clock(s.start)} ${s.title}`);

  it('is split where its own clock says side B starts: the entry nearest the end of our side A', () => {
    // No side headings; the clock runs on. 47:19 is 27 seconds before our side A ends: the opener of side B.
    const list = [at(0, 0, 'First'), at(0, 2340, 'Late on A'), at(0, 47 * 60 + 19, 'Opens B'), at(0, 53 * 60 + 35, 'Second on B'), at(0, 3600 + 30 * 60 + 20, 'Last')];
    expect(where(list)).toEqual(['A 0:00:00 First', 'A 0:39:00 Late on A', 'B 0:00:00 Opens B', 'B 0:06:16 Second on B', 'B 0:43:01 Last']);
  });

  it('does the same under a "Side B" heading, where only the times past the end of side B looked wrong', () => {
    const list = [at(0, 0, 'First'), at(0, 42 * 60 + 25, 'Last on A'), at(1, 47 * 60 + 4, 'Opens B'), at(1, 51 * 60 + 8, 'Second on B'), at(1, 3600 + 8 * 60 + 20, 'Last')];
    expect(where(list)).toEqual(['A 0:00:00 First', 'A 0:42:25 Last on A', 'B 0:00:00 Opens B', 'B 0:04:04 Second on B', 'B 0:21:16 Last']);
  });

  it('falls back on our side A’s length when no entry is near the turn', () => {
    const list = [at(0, 768, 'On A'), at(1, 3600 + 17 * 60 + 58, 'On B'), at(1, 3600 + 30 * 60 + 18, 'Later on B')];
    expect(where(list)).toEqual(['A 0:12:48 On A', 'B 0:30:12 On B', 'B 0:42:32 Later on B']);
  });

  it('gives side A back its tracks when the whole list was read onto side B', () => {
    const list = [at(1, 0, 'First'), at(1, 43 * 60 + 37, 'Last on A'), at(1, 46 * 60 + 44, 'Opens B'), at(1, 55 * 60 + 38, 'Second on B'), at(1, 3600 + 27 * 60 + 43, 'Last')];
    expect(where(list)).toEqual(['A 0:00:00 First', 'A 0:43:37 Last on A', 'B 0:00:00 Opens B', 'B 0:08:54 Second on B', 'B 0:40:59 Last']);
  });

  it('is not thrown by a list of names the same person posted that day', () => {
    // Its first row under each heading is only taken to open that side; it was never timed.
    const names = [at(0, 0, 'First', { weak: true }), at(1, 0, 'Opens B', { weak: true })];
    const list = [at(1, 0, 'First'), at(1, 43 * 60 + 37, 'Last on A'), at(1, 46 * 60 + 44, 'Opens B'), at(1, 55 * 60 + 38, 'Second on B'), at(1, 3600 + 27 * 60 + 43, 'Last')];
    expect(where([...names, ...list])).toEqual(['A 0:00:00 First', 'B 0:00:00 Opens B', 'A 0:00:00 First', 'A 0:43:37 Last on A', 'B 0:00:00 Opens B', 'B 0:08:54 Second on B', 'B 0:40:59 Last']);
  });

  it('leaves one time past the end alone, and two that are only just past it: those are slips', () => {
    const one = [at(0, 0, 'First'), at(0, 49 * 60, 'Slip')];
    expect(where(one)).toEqual(['A 0:00:00 First', 'A 0:49:00 Slip']);
    const two = [at(1, 0, 'First on B'), at(1, 1200, 'Mid B'), at(1, 49 * 60, 'Slip'), at(1, 52 * 60, 'Slip too')];
    expect(where(two)).toEqual(['B 0:00:00 First on B', 'B 0:20:00 Mid B', 'B 0:49:00 Slip', 'B 0:52:00 Slip too']);
  });

  it('touches nothing until both sides’ lengths are known, or on a set of more than two', () => {
    const list = [at(0, 0, 'First'), at(0, 53 * 60, 'x'), at(0, 80 * 60, 'y')];
    expect(splitWholeTape(list, [A, Infinity])).toBe(list);
    expect(splitWholeTape(list, [A, B, B])).toBe(list);
  });

  it('keeps each commenter’s list to itself', () => {
    const theirs = [at(0, 53 * 60, 'x'), at(0, 80 * 60, 'y')];
    const other = at(1, 600, 'Someone else on B', { author: 'Omar', date: '2024-05-01' });
    expect(where([...theirs, other])).toContain('B 0:10:00 Someone else on B');
  });
});

describe('IDs made with the site’s own form, which places them to the second', () => {
  const at = (start: number, artist: string, title: string, date: string, more: Partial<Sighting> = {}): Sighting => ({ side: 0, start, artist, title, known: Boolean(artist || title), author: 'Rents', date, exact: true, ...more });
  /** A time typed into a sentence in an old comment, where the form's are to the second. */
  const typed = (start: number, artist: string, title: string, date: string, more: Partial<Sighting> = {}) => at(start, artist, title, date, { exact: false, ...more });
  const tracks = (read: Sighting[]) => tracksOf(read, [3600]).map((p) => `${p.start} ${p.known ? `${p.artist} — ${p.title}` : '??'}`);
  const spans = (read: Sighting[]) => tracksOf(read, [3600]).map((p) => `${p.start}-${p.end} ${p.title}`);

  it('are two tracks a second apart, where two rough times that close would be one', () => {
    expect(tracks([at(523, 'Globe & The Hardcore Massive', 'Anthem', '1'), at(524, 'Wax Doctor', 'A New Direction', '2')])).toEqual(['523 Globe & The Hardcore Massive — Anthem', '524 Wax Doctor — A New Direction']);
    expect(tracks([at(0, 'The Prodigy', 'Hyperspeed', '1', { exact: false }), at(12, 'Butsch', 'The Count', '2', { exact: false })])).toEqual(['0 Butsch — The Count']);
  });

  it('are one moment on the same second: the later is the earlier put right', () => {
    expect(tracks([at(100, 'Orbital', 'Chime', '1'), at(100, 'Joey Beltram', 'Energy Flash', '2')])).toEqual(['100 Joey Beltram — Energy Flash']);
  });

  it('are each a track on a second of its own, in order of time, in whatever order they were said', () => {
    expect(tracks([at(102, 'Orbital', 'Chime', '1'), at(101, 'Joey Beltram', 'Energy Flash', '2'), at(100, 'LFO', 'LFO', '3')])).toEqual(['100 LFO — LFO', '101 Joey Beltram — Energy Flash', '102 Orbital — Chime']);
  });

  it('carry the line of the list an ID says it is for as long as that ID is the moment’s last word', () => {
    const line = { artist: 'Orbital', title: 'Chime' };
    const moments = (read: Sighting[]) => reconcile(read, [3600])[0].map((m) => `${m.start} ${m.title}${m.line ? ` (was ${m.line.title})` : ''}`);
    expect(moments([at(100, 'Orbital', 'Chime', '1'), at(100, 'Orbital', 'Chime (JZJ Remix)', '2', { line })])).toEqual(['100 Chime (JZJ Remix) (was Chime)']);
    // A later name that doesn't say so is not that line.
    expect(moments([at(100, 'Orbital', 'Chime (JZJ Remix)', '2', { line }), at(100, 'LFO', 'LFO', '3')])).toEqual(['100 LFO']);
  });

  it('are said of a track someone timed in a sentence only on the second it starts, like any other', () => {
    // Two seconds into a track from an old comment, an ID made with the form is the next track. Two
    // times typed into sentences that close would be one moment, and the later would replace the earlier.
    expect(tracks([typed(100, 'Orbital', 'Chime', '1'), at(102, 'Joey Beltram', 'Energy Flash', '2')])).toEqual(['100 Orbital — Chime', '102 Joey Beltram — Energy Flash']);
    expect(tracks([typed(100, 'Orbital', 'Chime', '1'), typed(102, 'Joey Beltram', 'Energy Flash', '2')])).toEqual(['100 Joey Beltram — Energy Flash']);
    // The same of a spot someone asked about: it is named from where it starts, not from two seconds in.
    expect(tracks([typed(100, '', '', '1'), at(102, 'Orbital', 'Chime', '2')])).toEqual(['100 ??', '102 Orbital — Chime']);
    expect(tracks([typed(100, '', '', '1'), at(100, 'Orbital', 'Chime', '2')])).toEqual(['100 Orbital — Chime']);
    // A second before it, the form's ID is the track before.
    expect(tracks([typed(100, 'Orbital', 'Chime', '1'), at(99, 'Orbital', 'Belfast', '2')])).toEqual(['99 Orbital — Belfast', '100 Orbital — Chime']);
    // And what is typed into a sentence afterwards, of a form's very second, is still said of that moment.
    expect(tracks([at(100, 'Orbital', 'Chime', '1'), typed(100, 'Joey Beltram', 'Energy Flash', '2')])).toEqual(['100 Joey Beltram — Energy Flash']);
  });

  it('leave the track before them where it is, however rough the times it was made from', () => {
    // Two people asked about a spot, fifteen seconds apart: one moment, from the earlier time. A point marked
    // six seconds into it is the next track, and the spot is still there, six seconds long.
    expect(tracks([typed(2800, '', '', '1'), typed(2815, '', '', '2'), at(2806, '', '', '3')])).toEqual(['2800 ??', '2806 ??']);
  });

  it('put a name right without moving where the track ends, or lifting a record off the one it was brought in over', () => {
    // "0:58–3:40" in an old comment, and the name put right with the form since.
    expect(spans([typed(58, 'Orbital', 'Chime', '1', { end: 220 }), typed(900, 'LFO', 'LFO', '1'), at(58, 'Orbital', 'Belfast', '2')])).toEqual(['58-220 Belfast', '900-1500 LFO']);
    // "+ [5:00]": a record brought in over the one playing, which plays on under it to the next that isn't one.
    const layered = [typed(0, 'Orbital', 'Chime', '1'), typed(300, 'Tangerine Dream', 'Love On A Real Train', '1', { layer: true }), typed(400, 'LFO', 'LFO', '1')];
    expect(spans(layered)).toEqual(['0-400 Chime', '300-400 Love On A Real Train', '400-1000 LFO']);
    expect(spans([...layered, at(300, 'Tangerine Dream', 'Love On A Real Train (Edit)', '2')])).toEqual(['0-400 Chime', '300-400 Love On A Real Train (Edit)', '400-1000 LFO']);
  });

  it('move a track that is only taken to open the side as they move any other: taken away there, and said where it starts', () => {
    expect(tracks([typed(0, 'Orbital', 'Chime', '1', { weak: true }), at(0, '', '', '2', { gone: true }), at(4, 'Orbital', 'Chime', '2')])).toEqual(['4 Orbital — Chime']);
    // Named again a little on and not taken away, it is the one play said twice, and the earlier start stands.
    expect(tracks([typed(0, 'Orbital', 'Chime', '1', { weak: true }), at(4, 'Orbital', 'Chime', '2')])).toEqual(['0 Orbital — Chime']);
  });

  describe('a mark taken away', () => {
    const gone = (start: number, date: string): Sighting => at(start, '', '', date, { gone: true });

    it('takes with it everything said of that moment before', () => {
      expect(tracks([at(0, 'Orbital', 'Chime', '1'), at(240, 'Wrong', 'Thing Entirely', '2'), at(240, '', '', '2a', { exact: false }), gone(240, '3')])).toEqual(['0 Orbital — Chime']);
    });

    it('leaves what is said of it afterwards: the track can be ID’d again', () => {
      expect(tracks([at(240, 'Wrong', 'Thing Entirely', '1'), gone(240, '2'), at(240, 'Joey Beltram', 'Energy Flash', '3')])).toEqual(['240 Joey Beltram — Energy Flash']);
    });

    it('moves a track marked too early when the same post IDs it at the right moment, even a second later', () => {
      expect(tracks([at(240, 'Orbital', 'Chime', '1'), gone(240, '2'), at(300, 'Orbital', 'Chime', '2')])).toEqual(['300 Orbital — Chime']);
      expect(tracks([at(240, 'Orbital', 'Chime', '1'), gone(240, '2'), at(241, 'Orbital', 'Chime', '2')])).toEqual(['241 Orbital — Chime']);
    });

    it('takes nothing from a moment that starts somewhere else', () => {
      expect(tracks([at(240, 'Orbital', 'Chime', '1'), gone(300, '2')])).toEqual(['240 Orbital — Chime']);
    });

    it('is undone by deleting it: the reader has only what is still there to read', () => {
      expect(tracks([at(240, 'Orbital', 'Chime', '1')])).toEqual(['240 Orbital — Chime']);
    });
  });
});
