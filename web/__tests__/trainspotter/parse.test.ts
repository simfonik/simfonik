// The Trainspotter prototype's comment reader (app/proto/trainspotter/parse.ts).
//
// Two kinds of check. The first reads every archived comment on every tape and compares what comes out with a
// saved copy, so a change to the reader shows exactly which tracks on which tapes it moved; review the diff,
// and if it is what you meant, run `pnpm test -u` to accept it. The second states the reader's rules one at a
// time, on small made-up comments, so each rule has a test that fails when it breaks.
import { describe, expect, it } from 'vitest';
import comments from '@/data/tape-comments.json';
import tapes from '@/data/tapes.json';
import { digest, parseComment, reconcile, runningOrders, type Said } from '@/app/proto/trainspotter/parse';

const clock = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** What the page would show for a tape: its timeline, then its running order, one line each. */
function shown(said: Said[], titles: string[]): string[] {
  const { sightings, listed } = digest(said, titles);
  const timed = sightings.filter((s) => !s.unsure || titles.length === 1);
  return [
    ...reconcile(timed, titles.map(() => Infinity)).map((p) => `side ${p.side} ${clock(p.start)} ${p.known ? `${p.artist} — ${p.title}` : `?? ${p.title}`.trim()} [${p.author}]`),
    ...runningOrders(listed, titles.length).flatMap((order, side) => order.map((l) => `order side ${side} no.${l.n} ${l.known ? `${l.artist} — ${l.title}` : `?? ${l.title}`.trim()} [${l.author}]`)),
  ];
}

const say = (content: string, author = 'Keeper', date = '2026-01-01'): Said => ({ author, date, content });
const AB = ['', ''];

describe('every archived comment', () => {
  it('reads as it did when this copy was saved', async () => {
    const all = comments as Record<string, { author: string; date: string; content: string }[]>;
    const lines = (tapes as { id: string; sides: { title?: string }[] }[]).flatMap((tape) => {
      const said = (all[tape.id] ?? []).map((c) => ({ author: c.author, date: c.date.slice(0, 10), content: c.content }));
      return shown(said, tape.sides.map((s) => s.title ?? '')).map((line) => `${tape.id} | ${line}`);
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
});
