import { describe, expect, it } from 'vitest';
import type { RunningOrder, TrackId } from '@/lib/track-ids/compose';
import { contributors, couldStartAt, isDone, placeByTime, tracklistRows } from '@/lib/track-ids/tracklist';

const id = (start: number, artist: string, title: string, by = 'Rents'): TrackId => ({ start, end: start + 240, artist, title, known: Boolean(artist || title), by });
const order: RunningOrder = {
  by: null,
  tracks: [
    { n: 1, artist: 'The Prodigy', title: 'Hyperspeed (G-Force Part 2)', known: true },
    { n: 2, artist: 'Butsch', title: 'The Count', known: true },
    { n: 3, artist: 'Rhythm For Reasons', title: 'Grand National', known: true },
  ],
};
const shown = (rows: ReturnType<typeof tracklistRows>) => rows.map((r) => `${r.n ?? '-'} ${r.start ?? '-'} ${r.known ? `${r.artist} / ${r.title}` : '??'}`);

describe('a side’s tracklist', () => {
  it('is the IDs in order of time where there is no list', () => {
    const rows = tracklistRows(null, [id(300, 'Orbital', 'Chime'), id(0, 'Joey Beltram', 'Energy Flash'), id(600, '', '')]);
    expect(shown(rows)).toEqual(['- 0 Joey Beltram / Energy Flash', '- 300 Orbital / Chime', '- 600 ??']);
  });

  it('is the list where there is one, each line with the time of the ID that names the same record', () => {
    const rows = tracklistRows(order, [id(221, 'Butsch', 'The Count', 'Dana'), id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)')]);
    expect(shown(rows)).toEqual(['1 0 The Prodigy / Hyperspeed (G-Force Part 2)', '2 221 Butsch / The Count', '3 - Rhythm For Reasons / Grand National']);
    expect(rows.map((r) => r.by)).toEqual(['Rents', 'Dana', null]);
    expect(rows.map(isDone)).toEqual([true, true, false]);
  });

  it('keeps an ID that matches no line, by its time, after the last line known to start before it', () => {
    const rows = tracklistRows(order, [id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)'), id(221, '', ''), id(900, 'Altern 8', 'Infiltrate 202')]);
    expect(shown(rows)).toEqual(['1 0 The Prodigy / Hyperspeed (G-Force Part 2)', '- 221 ??', '- 900 Altern 8 / Infiltrate 202', '2 - Butsch / The Count', '3 - Rhythm For Reasons / Grand National']);
  });

  it('puts an ID from before any timed line at the top', () => {
    const rows = tracklistRows(order, [id(30, '', '')]);
    expect(shown(rows)[0]).toBe('- 30 ??');
  });

  it('gives a line the list itself times the ID at that time, and the name with it where the list had none', () => {
    const kept: RunningOrder = { by: 'Josh', tracks: [{ n: 1, artist: 'Orbital', title: 'Chime', known: true }, { n: 2, artist: '', title: '', known: false, at: 468 }, { n: 3, artist: '', title: '', known: false, at: 618 }] };
    const rows = tracklistRows(kept, [id(470, 'THC', 'Nice Up the Land', 'Dana'), id(618, '', '', 'Josh')]);
    expect(shown(rows)).toEqual(['1 - Orbital / Chime', '2 470 THC / Nice Up the Land', '3 618 ??']);
    expect(rows.map((r) => r.by)).toEqual([null, 'Dana', 'Josh']);
  });

  it('does not show a time in the list that the reader made no ID of', () => {
    // 62:38 on a 47-minute side: the keeper counted from the start of the tape.
    const kept: RunningOrder = { by: 'Josh', tracks: [{ n: 1, artist: 'Orbital', title: 'Chime', known: true }, { n: 2, artist: '', title: 'ambient track', known: false, at: 3758 }] };
    expect(shown(tracklistRows(kept, []))).toEqual(['1 - Orbital / Chime', '2 - ??']);
  });

  it('lets an unclaimed ID stand in for a line with no name and no time, between the same two timed lines', () => {
    const blank = (n: number) => ({ n, artist: '', title: '', known: false });
    const kept: RunningOrder = {
      by: 'Josh',
      tracks: [{ n: 4, artist: 'Beautiful People', title: 'I Got the Rhythm', known: true }, blank(5), blank(6), blank(7), { n: 8, artist: 'Corina', title: 'Loving You Like Crazy', known: true }, blank(9)],
    };
    const ids = [id(273, 'Beautiful People', 'I Got the Rhythm'), id(427, 'Dark Knights', 'Piece Of Mind'), id(550, 'Downtown', 'Space Love'), id(743, 'Corina', 'Loving You Like Crazy'), id(805, 'Sound Set', 'So In Love With You'), id(900, 'Oval Emotion', 'Do It')];
    expect(shown(tracklistRows(kept, ids))).toEqual([
      '4 273 Beautiful People / I Got the Rhythm',
      '5 427 Dark Knights / Piece Of Mind',
      '6 550 Downtown / Space Love',
      '7 - ??',
      '8 743 Corina / Loving You Like Crazy',
      '9 805 Sound Set / So In Love With You',
      '- 900 Oval Emotion / Do It',
    ]);
  });
});

describe('the order of a side’s rows', () => {
  const line = (n: number, start: number | null) => ({ n, start });
  const other = (start: number) => ({ n: null, start });

  it('is the list’s for its lines, and by time for whatever is not a line of it', () => {
    expect(placeByTime([line(1, 0), line(2, null), line(3, 400)], [other(450), other(100)])).toEqual([line(1, 0), other(100), line(2, null), line(3, 400), other(450)]);
  });

  it('keeps a row that is not a line in its place by time when a line beside it is given one', () => {
    // An ID with no line in the list, at 9:52, after the last line timed before it.
    expect(placeByTime([line(12, 496), line(13, null), line(14, null)], [other(592)])).toEqual([line(12, 496), other(592), line(13, null), line(14, null)]);
    // Line 13 is then timed at 8:42: the ID at 9:52 is after it, not before.
    expect(placeByTime([line(12, 496), line(13, 522), line(14, null)], [other(592)])).toEqual([line(12, 496), line(13, 522), other(592), line(14, null)]);
  });
});

describe('the lines that could start at a moment', () => {
  const rows = [
    { n: 1, start: 0 },
    { n: 2, start: null },
    { n: null, start: 150 },
    { n: 3, start: 400 },
    { n: 4, start: null },
    { n: 5, start: null },
  ];

  it('are those with no time, between the timed lines the moment falls between', () => {
    expect(couldStartAt(rows, 200)).toEqual([1]);
    expect(couldStartAt(rows, 450)).toEqual([4, 5]);
  });

  it('are never a line the list has above one timed earlier, or below one timed later', () => {
    // Line 2 is above line 3, which starts at 400: it cannot start at 450.
    expect(couldStartAt(rows, 450)).not.toContain(1);
    // Lines 4 and 5 are below it: they cannot start at 200.
    expect(couldStartAt(rows, 200)).not.toContain(4);
  });

  it('are never a row that is not a line of the list, or one that has its time', () => {
    expect(couldStartAt(rows, 160)).toEqual([1]);
    expect(couldStartAt([{ n: null, start: 0 }], 100)).toEqual([]);
  });
});

describe('who a tape’s tracklist is owed to', () => {
  it('is everyone who gave a line its time and whoever kept a list its names are from, whoever gave the most first', () => {
    const a = tracklistRows(null, [id(0, 'Orbital', 'Chime', 'Josh'), id(300, 'Joey Beltram', 'Energy Flash', 'Rents'), id(600, 'Altern 8', 'Infiltrate 202', 'Rents')]);
    const b = tracklistRows({ ...order, by: 'Softboiled' }, [id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)', 'Dana')]);
    expect(contributors([{ rows: a, keeper: null }, { rows: b, keeper: 'Softboiled' }])).toEqual(['Softboiled', 'Rents', 'Dana', 'Josh']);
  });

  it('is nobody on a tape that has only its own tracklist', () => {
    expect(contributors([{ rows: tracklistRows(order, []), keeper: null }])).toEqual([]);
  });
});
