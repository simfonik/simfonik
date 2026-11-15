// Who made each change in the undo history, and how it reads (app/proto/trainspotter/changes.ts).
import { describe as group, expect, it } from 'vitest';
import type { HistoryEntry } from '@ui-sdk/react/history';
import { describe, madeBy } from '@/app/proto/trainspotter/changes';
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
