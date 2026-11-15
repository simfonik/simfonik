// What a visitor's browser keeps for a tape, and how it follows the comments on a return visit
// (app/proto/trainspotter/saved.ts).
import { describe, expect, it } from 'vitest';
import type { Proposal } from '@/app/proto/trainspotter/parse';
import { followComments, readSaved, toCue, type Kept } from '@/app/proto/trainspotter/saved';

const SIDES = ['A', 'B'];
const said = (side: number, start: number, end: number, artist: string, title = 'Song', rest: Partial<Proposal> = {}): Proposal => ({
  side,
  start,
  end,
  artist,
  title,
  known: Boolean(artist),
  author: 'Someone',
  date: '2026-01-01',
  voices: 1,
  also: [],
  ...rest,
});
const kept = (proposals: Proposal[], rest: Partial<Kept> = {}): Kept => ({ cues: proposals.map((p) => toCue(p, SIDES)), removed: [], moved: new Set(), ...rest });
const line = (c: { track: string; start: number; end: number; artist: string }) => `${c.track} ${c.start}-${c.end} ${c.artist || '??'}`;

describe('a return visit', () => {
  const comments = [said(0, 0, 200, 'Alpha'), said(0, 200, 400, ''), said(1, 0, 300, 'Bravo')];

  it('changes nothing when the comments say what they said', () => {
    expect(followComments(kept(comments), comments, SIDES)).toBeNull();
  });

  it('adds a track the comments have gained, and ends the one before it where the new one starts', () => {
    const now = [said(0, 0, 120, 'Alpha'), said(0, 120, 200, 'Charlie'), comments[1], comments[2]];
    const next = followComments(kept(comments), now, SIDES)!;
    expect(next.added).toBe(1);
    expect(next.cues.map(line)).toContain('A 0-120 Alpha');
    expect(next.cues.map(line)).toContain('A 120-200 Charlie');
  });

  it('takes the comments’ new name for a track', () => {
    const now = [comments[0], said(0, 200, 400, 'Delta'), comments[2]];
    const next = followComments(kept(comments), now, SIDES)!;
    expect(next.corrected).toBe(1);
    expect(next.cues.map(line)).toContain('A 200-400 Delta');
  });

  it('removes a track the comments no longer have', () => {
    const next = followComments(kept(comments), [comments[0], comments[2]], SIDES)!;
    expect(next.removed).toBe(1);
    expect(next.cues.map(line)).toEqual(['A 0-200 Alpha', 'B 0-300 Bravo']);
  });

  it('never touches a track the visitor ID’d themselves', () => {
    const mine = kept(comments);
    mine.cues[1] = { ...mine.cues[1], artist: 'My Own ID', known: true, by: undefined };
    const next = followComments(mine, [comments[0], said(0, 200, 400, 'Delta'), comments[2]], SIDES);
    expect((next?.cues ?? mine.cues).map(line)).toContain('A 200-400 My Own ID');
  });

  it('keeps times the visitor set, and follows the comments’ times otherwise', () => {
    const dragged = kept(comments);
    dragged.cues[0] = { ...dragged.cues[0], end: 180 };
    dragged.moved = new Set([dragged.cues[0].id]);
    const now = [said(0, 0, 150, 'Alpha'), said(0, 150, 200, 'Charlie'), comments[1], comments[2]];
    expect(followComments(dragged, now, SIDES)!.cues.map(line)).toContain('A 0-180 Alpha');
    expect(followComments(kept(comments), now, SIDES)!.cues.map(line)).toContain('A 0-150 Alpha');
  });

  it('does not put back a track the visitor removed', () => {
    const without = kept([comments[0], comments[2]], { removed: [{ side: 0, start: 200 }] });
    expect(followComments(without, comments, SIDES)).toBeNull();
  });

  it('puts back a track that is missing for any other reason', () => {
    const without = kept([comments[0], comments[2]]);
    expect(followComments(without, comments, SIDES)!.added).toBe(1);
  });

  it('leaves the last track on a side with the end the page gave it', () => {
    // The comments only guess where the last track ends; the page has since cut it to the side's real length.
    const cut = kept(comments);
    cut.cues[2] = { ...cut.cues[2], end: 250 };
    expect(followComments(cut, comments, SIDES)).toBeNull();
  });

  it('repairs a copy saved while the reader had the sides the wrong way round', () => {
    // Saved: the Technology tracks on A. The comments, read rightly: Planet Earth on A, Technology on B.
    const wrong = [said(0, 0, 190, 'Technology One'), said(0, 190, 400, 'Technology Two')];
    const right = [said(0, 0, 130, 'Earth One'), said(0, 130, 400, 'Earth Two'), said(1, 0, 190, 'Technology One'), said(1, 190, 400, 'Technology Two')];
    const next = followComments(kept(wrong, { moved: null }), right, SIDES)!;
    expect(next.cues.map(line).sort()).toEqual(['A 0-130 Earth One', 'A 130-400 Earth Two', 'B 0-190 Technology One', 'B 190-400 Technology Two']);
  });
});

describe('reading what was stored', () => {
  it('reads today’s shape', () => {
    const found = readSaved(JSON.stringify({ v: 2, cues: [], removed: [{ side: 0, start: 5 }], moved: ['x'] }), false)!;
    expect(found.removed).toEqual([{ side: 0, start: 5 }]);
    expect(found.moved).toEqual(new Set(['x']));
  });

  it('reads the bare list earlier versions saved, and knows it never recorded whose times were whose', () => {
    expect(readSaved(JSON.stringify([{ id: 'a' }]), false)!.moved).toBeNull();
  });

  it('takes a bare empty list for a first visit that was cut short, unless the page had finished opening', () => {
    expect(readSaved('[]', false)).toBeNull();
    expect(readSaved('[]', true)).toEqual({ cues: [], removed: [], moved: null });
  });

  it('leaves out anything stored that is not a track', () => {
    const good = { id: 'a', track: 'A', start: 0, end: 60, artist: '', title: '', known: false };
    const found = readSaved(JSON.stringify({ v: 2, cues: [null, good, { id: 'b', track: 'A', start: 5 }, 'x'], removed: [null, { side: 0, start: 5 }, {}], moved: ['a', 3] }), false)!;
    expect(found.cues).toEqual([good]);
    expect(found.removed).toEqual([{ side: 0, start: 5 }]);
    expect(found.moved).toEqual(new Set(['a']));
    expect(readSaved(JSON.stringify([null, good]), false)!.cues).toEqual([good]);
  });

  it('takes nothing, or nonsense, for a first visit', () => {
    expect(readSaved(null, false)).toBeNull();
    expect(readSaved('{not json', false)).toBeNull();
    expect(readSaved('{"v":2}', false)).toBeNull();
  });
});
