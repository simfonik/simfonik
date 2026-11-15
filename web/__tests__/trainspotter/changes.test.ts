// Who made each change in the undo history, and how it reads (app/proto/trainspotter/changes.ts).
import { describe as group, expect, it } from 'vitest';
import type { HistoryEntry } from '@ui-sdk/react/history';
import { describe, madeBy, stepFrom, steps } from '@/app/proto/trainspotter/changes';
import { REPLACED, type Cue } from '@/app/proto/trainspotter/tracklist-primitive';

const cue = (over: Partial<Cue>): Cue => ({ id: 'a', track: 'A', start: 0, end: 180, artist: '', title: '', known: false, ...over });
const entry = (over: Partial<HistoryEntry>): HistoryEntry => ({ id: 'e', ref: 'c1', label: 'Tracklist timeline', key: 'value', value: [], previous: [], source: 'programmatic', reason: 'imperative', ...over });

group('who made a change', () => {
  it('is the visitor for anything done by hand', () => {
    expect(madeBy(entry({ source: 'mouse', reason: 'drag' }))).toBe('You');
    expect(madeBy(entry({ source: 'programmatic' }))).toBe('You');
  });

  it('is the comments when the bridge put a whole tracklist in place', () => {
    expect(madeBy(entry({ source: 'agent', reason: REPLACED }))).toBe('Comments');
  });

  it('is an assistant for any other change through the bridge', () => {
    expect(madeBy(entry({ source: 'agent', reason: 'imperative' }))).toBe('Assistant');
  });
});

group('a change in words', () => {
  const unknown = cue({ id: 'u', start: 618, end: 800 });

  it('says what an assistant ID’d, not that it came from the comments', () => {
    const named = { ...unknown, artist: 'Alpha', title: 'One', known: true };
    expect(describe(entry({ source: 'agent', previous: [unknown], value: [named] }))).toBe('ID’d the track at 0:10:18: Alpha — One');
  });

  it('says where an assistant marked a track', () => {
    expect(describe(entry({ source: 'agent', previous: [unknown], value: [unknown, cue({ id: 'n', start: 180 })] }))).toBe('Marked a new track at 0:03:00, side A');
  });

  it('counts what the comments added', () => {
    expect(describe(entry({ source: 'agent', reason: REPLACED, previous: [unknown], value: [unknown, cue({ id: 'n' }), cue({ id: 'm' })] }))).toBe('Added 2 tracks from the comments');
  });
});

group('undo steps', () => {
  const a = cue({ id: 'a', start: 0, end: 180, artist: 'Alpha', title: 'One', known: true });
  const b = cue({ id: 'b', start: 180, end: 400 });
  const at = (c: Cue, by: number) => ({ ...c, start: c.start + by, end: c.end + by });
  // The comments' list goes in, then: a nudged three times, b nudged once, a dragged twice, a nudged once.
  const history = [
    entry({ id: 'e1', source: 'agent', reason: REPLACED, previous: [], value: [a, b] }),
    entry({ id: 'e2', previous: [a, b], value: [at(a, 1), b] }),
    entry({ id: 'e3', previous: [at(a, 1), b], value: [at(a, 2), b] }),
    entry({ id: 'e4', previous: [at(a, 2), b], value: [at(a, 3), b] }),
    entry({ id: 'e5', previous: [at(a, 3), b], value: [at(a, 3), at(b, 1)] }),
    entry({ id: 'e6', source: 'mouse', reason: 'drag', previous: [at(a, 3), at(b, 1)], value: [at(a, 9), at(b, 1)] }),
    entry({ id: 'e7', source: 'mouse', reason: 'drag', previous: [at(a, 9), at(b, 1)], value: [at(a, 20), at(b, 1)] }),
    entry({ id: 'e8', previous: [at(a, 20), at(b, 1)], value: [at(a, 21), at(b, 1)] }),
  ];

  it('folds a run of key nudges to one track into one step, and nothing else', () => {
    expect(steps(history).map((s) => s.end)).toEqual([1, 4, 5, 6, 7, 8]);
  });

  it('reads a folded run from where the track started to where it ended', () => {
    const run = steps(history)[1].entry;
    expect(describe(run)).toBe('Moved Alpha — One to 0:00:03–0:03:03');
    expect((run.previous as Cue[])[0].start).toBe(0);
  });

  it('undoes and redoes a run in one go', () => {
    expect(stepFrom(history, 4, -1)).toBe(1);
    expect(stepFrom(history, 1, 1)).toBe(4);
    expect(stepFrom(history, 8, -1)).toBe(7);
    expect(stepFrom(history, 8, 1)).toBe(8);
    expect(stepFrom(history, 0, -1)).toBe(0);
  });

  it('leaves a run from the middle by its nearest edge', () => {
    expect(stepFrom(history, 3, -1)).toBe(1);
    expect(stepFrom(history, 3, 1)).toBe(4);
  });

  it('keeps an ID or a new mark as a step of its own', () => {
    const named = { ...b, artist: 'Beta', title: 'Two', known: true };
    const more = [...history, entry({ id: 'e9', previous: history[7].value, value: [at(a, 21), { ...named, start: 181, end: 401 }] })];
    expect(steps(more).map((s) => s.end)).toEqual([1, 4, 5, 6, 7, 8, 9]);
  });
});
