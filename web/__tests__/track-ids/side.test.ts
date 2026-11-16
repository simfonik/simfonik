// The one working-out of what is on a side (lib/track-ids/side.ts). First its rules, one at a time, on small
// made-up sides. Then the same rules held against every side in the archive, where what could go wrong is
// whatever real lists and real comments happen to contain.
import { describe, expect, it } from 'vitest';
import lengths from '@/data/side-lengths.json';
import comments from '@/data/tape-comments.json';
import tapes from '@/data/tapes.json';
import { composeId, composeRemoval, type RunningOrder, type TrackId } from '@/lib/track-ids/compose';
import { readSaid } from '@/lib/track-ids/said';
import { contributors, couldStartAt, playingAt, saidBy, sideRows, standing, startingAt, suggest, timeline, withChanges, type Change, type Row } from '@/lib/track-ids/side';
import type { Tape } from '@/types/tape';

const id = (start: number, artist: string, title: string, by = 'Rents', date = '2020-01-01'): TrackId => ({ start, end: start + 240, artist, title, known: Boolean(artist || title), by, date });
const said = (time: number, artist = '', title = '', more: Partial<Change> = {}): Change => ({ side: 0, time, artist, title, ...more });
const sent = { sent: { by: 'Dana', read: 1 } };
const list = (by: string | null, ...names: (string | null)[]): RunningOrder => ({
  by,
  tracks: names.map((name, k) => (name === null ? { n: k + 1, artist: '', title: '', known: false } : { n: k + 1, artist: name.split(' - ')[0], title: name.split(' - ')[1], known: true })),
});
const order = list(null, 'The Prodigy - Hyperspeed (G-Force Part 2)', 'Butsch - The Count', 'Rhythm For Reasons - Grand National');
const shown = (rows: Row[]) => rows.map((r) => `${r.n ?? '-'} ${r.start ?? '-'} ${r.known ? `${r.artist} / ${r.title}` : '??'}`);
const times = (ids: TrackId[]) => ids.map((x) => `${x.start}-${x.end} ${x.known ? `${x.artist} / ${x.title}` : '??'}`);

describe('a side’s IDs with the visitor’s changes among them', () => {
  const posted = [id(0, 'Orbital', 'Chime'), id(240, '', '', 'Josh'), id(600, 'Joey Beltram', 'Energy Flash')];
  posted[0].end = 240;
  posted[1].end = 480;

  it('are the comments’ IDs where the visitor has said nothing', () => {
    expect(withChanges(posted, [])).toEqual(posted);
  });

  it('have a change at a moment of its own as a new track from there, until the next one starts', () => {
    const change = said(500);
    const ids = withChanges(posted, [change]);
    expect(times(ids)).toEqual(['0-240 Orbital / Chime', '240-480 ??', '500-600 ??', '600-840 Joey Beltram / Energy Flash']);
    expect(ids[2].mine).toBe(change);
    // What was playing there is cut off where the new track starts.
    expect(times(withChanges(posted, [said(100)]))[0]).toBe('0-100 Orbital / Chime');
  });

  it('take a change within a moment of a mark as said of that mark: one moment, one track', () => {
    // A name for the spot someone marked without one, from where it was marked.
    expect(times(withChanges(posted, [said(243, 'LFO', 'LFO')]))[1]).toBe('240-480 LFO / LFO');
    expect(withChanges(posted, [said(243, 'LFO', 'LFO')])).toHaveLength(3);
  });

  it('never let the visitor’s unposted change replace a name, and let a posted one put a name right', () => {
    // Unposted, it was made when the moment had no name; one has turned up since.
    const unposted = said(0, 'Altern 8', 'Infiltrate 202');
    expect(times(withChanges(posted, [unposted]))[0]).toBe('0-240 Orbital / Chime');
    expect(withChanges(posted, [unposted]).some((x) => x.mine === unposted)).toBe(false);
    const ids = withChanges(posted, [said(0, 'Altern 8', 'Infiltrate 202', sent)]);
    expect(times(ids)[0]).toBe('0-240 Altern 8 / Infiltrate 202');
    expect(ids[0].by).toBe('Dana');
  });

  it('never let a mark without a name replace a name', () => {
    expect(times(withChanges(posted, [said(600, '', '', sent)]))[2]).toBe('600-840 Joey Beltram / Energy Flash');
  });

  it('drop a mark taken away, and let what played before it play on', () => {
    expect(times(withChanges(posted, [said(240, '', '', { gone: true, ...sent })]))).toEqual(['0-240 Orbital / Chime', '600-840 Joey Beltram / Energy Flash']);
    // Its end was only ever where the mark began.
    expect(times(withChanges([posted[0], { ...posted[1], end: 600 }, posted[2]].map((x, k) => (k === 0 ? { ...x, end: 240 } : x)), [said(240, '', '', { gone: true, ...sent })]))[0]).toBe('0-240 Orbital / Chime');
    expect(times(withChanges([{ ...posted[0], end: 240 }, { ...posted[1], end: 600 }], [said(240, '', '', { gone: true, ...sent })]))).toEqual(['0-240 Orbital / Chime']);
    // Taking away what isn't there changes nothing.
    expect(withChanges(posted, [said(400, '', '', { gone: true, ...sent })])).toEqual(posted);
  });

  it('take a record named again, with nothing else between, as the same play: the earlier start stands', () => {
    const one = [id(300, 'Altern 8', 'Infiltrate 202')];
    expect(times(withChanges(one, [said(400, 'Altern 8', 'Infiltrate 202', sent)]))).toEqual(['300-640 Altern 8 / Infiltrate 202']);
    expect(times(withChanges(one, [said(200, 'Altern 8', 'Infiltrate 202', sent)]))).toEqual(['200-540 Altern 8 / Infiltrate 202']);
    // With another track between them, they are two plays.
    expect(withChanges([...one, id(350, '', '')], [said(400, 'Altern 8', 'Infiltrate 202', sent)])).toHaveLength(3);
  });

  it('take a change at the nearer of two marks it is within a moment of', () => {
    const close = [id(100, '', ''), id(108, '', '')];
    expect(times(withChanges(close, [said(105, 'LFO', 'LFO')])).map((t) => t.split(' ').slice(1).join(' '))).toEqual(['??', 'LFO / LFO']);
  });
});

describe('a side’s rows', () => {
  const rows = (o: RunningOrder | null, ids: TrackId[], changes: Change[] = []) => sideRows(o, withChanges(ids, changes));

  it('are the IDs in order of time where there is no list', () => {
    expect(shown(rows(null, [id(300, 'Orbital', 'Chime'), id(0, 'Joey Beltram', 'Energy Flash'), id(600, '', '')]))).toEqual(['- 0 Joey Beltram / Energy Flash', '- 300 Orbital / Chime', '- 600 ??']);
  });

  it('are the list where there is one, each line with the time of the ID that names the same record', () => {
    const all = rows(order, [id(221, 'Butsch', 'The Count', 'Dana'), id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)')]);
    expect(shown(all)).toEqual(['1 0 The Prodigy / Hyperspeed (G-Force Part 2)', '2 221 Butsch / The Count', '3 - Rhythm For Reasons / Grand National']);
    expect(all.map((r) => r.by)).toEqual(['Rents', 'Dana', null]);
  });

  it('keep the tape’s own words for a line of its own tracklist, and read as the ID does on a list from the comments', () => {
    const own: RunningOrder = { by: null, tracks: [{ n: 1, artist: 'Orbital', title: 'Halcyon (Partyunicorn Mix)', known: true, link: 'https://www.discogs.com/release/1', duration: '5:02' }] };
    expect(rows(own, [id(271, 'orbital', 'halcyon')])[0]).toMatchObject({ artist: 'Orbital', title: 'Halcyon (Partyunicorn Mix)', start: 271, link: 'https://www.discogs.com/release/1', duration: '5:02' });
    // The comments' latest word for the track is often the fuller one.
    const kept = list('Josh', 'Oval Emotion - Do It');
    expect(rows(kept, [id(911, 'Oval Emotion', 'Do It (Nasty Organ Dub)')])[0]).toMatchObject({ n: 1, artist: 'Oval Emotion', title: 'Do It (Nasty Organ Dub)', start: 911 });
  });

  it('never let an ID that names another line of the list stand in for a line with no name', () => {
    // The last line's record, said to start the side: it can't be the unnamed line in the middle.
    const kept = list('Josh', 'Orbital - Chime', null, 'Joey Beltram - Energy Flash', 'Altern 8 - Infiltrate 202');
    const ids = [id(0, 'Altern 8', 'Infiltrate 202'), id(300, 'Orbital', 'Chime'), id(900, 'Joey Beltram', 'Energy Flash')];
    expect(shown(rows(kept, ids))).toEqual(['- 0 Altern 8 / Infiltrate 202', '1 300 Orbital / Chime', '2 - ??', '3 900 Joey Beltram / Energy Flash', '4 - Altern 8 / Infiltrate 202']);
  });

  it('give a line the list itself times the ID at that time, and the name with it where the list had none', () => {
    const kept: RunningOrder = { by: 'Josh', tracks: [{ n: 1, artist: 'Orbital', title: 'Chime', known: true }, { n: 2, artist: '', title: '', known: false, at: 468 }, { n: 3, artist: '', title: '', known: false, at: 618 }] };
    const all = rows(kept, [id(470, 'THC', 'Nice Up the Land', 'Dana'), id(618, '', '', 'Josh')]);
    expect(shown(all)).toEqual(['1 - Orbital / Chime', '2 470 THC / Nice Up the Land', '3 618 ??']);
    expect(all.map((r) => r.by)).toEqual([null, 'Dana', 'Josh']);
  });

  it('do not show a time in the list that the reader made no ID of', () => {
    // 62:38 on a 47-minute side: the keeper counted from the start of the tape.
    const kept: RunningOrder = { by: 'Josh', tracks: [{ n: 1, artist: 'Orbital', title: 'Chime', known: true }, { n: 2, artist: '', title: 'ambient track', known: false, at: 3758 }] };
    expect(shown(rows(kept, []))).toEqual(['1 - Orbital / Chime', '2 - ??']);
  });

  it('let an unclaimed ID stand in for a line with no name and no time, between the same two timed lines, the earliest such line first', () => {
    const kept = list('Josh', 'Beautiful People - I Got the Rhythm', null, null, null, 'Corina - Loving You Like Crazy', null);
    const ids = [id(273, 'Beautiful People', 'I Got the Rhythm'), id(427, 'Dark Knights', 'Piece Of Mind'), id(550, '', ''), id(743, 'Corina', 'Loving You Like Crazy'), id(805, 'Sound Set', 'So In Love With You'), id(900, 'Oval Emotion', 'Do It')];
    expect(shown(rows(kept, ids))).toEqual([
      '1 273 Beautiful People / I Got the Rhythm',
      '2 427 Dark Knights / Piece Of Mind',
      '3 550 ??',
      '4 - ??',
      '5 743 Corina / Loving You Like Crazy',
      '6 805 Sound Set / So In Love With You',
      '- 900 Oval Emotion / Do It',
    ]);
  });

  it('keep an ID that answers to no line, as a row of its own after the last row to start before it', () => {
    expect(shown(rows(order, [id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)'), id(221, '', ''), id(900, 'Altern 8', 'Infiltrate 202')]))).toEqual([
      '1 0 The Prodigy / Hyperspeed (G-Force Part 2)',
      '- 221 ??',
      '- 900 Altern 8 / Infiltrate 202',
      '2 - Butsch / The Count',
      '3 - Rhythm For Reasons / Grand National',
    ]);
    expect(shown(rows(order, [id(30, '', '')]))[0]).toBe('- 30 ??');
  });

  describe('in the list’s order: down a side, times only rise', () => {
    const four = list(null, 'Orbital - Chime', 'Joey Beltram - Energy Flash', 'Altern 8 - Infiltrate 202', 'LFO - LFO');

    it('show an ID that names a line it can’t belong to by its time, as a track of its own, and leave the line waiting', () => {
      // The fourth line, said to start before the second.
      const ids = [id(0, 'Orbital', 'Chime'), id(200, 'Joey Beltram', 'Energy Flash'), id(400, 'Altern 8', 'Infiltrate 202'), id(100, 'LFO', 'LFO')];
      expect(shown(rows(four, ids))).toEqual(['1 0 Orbital / Chime', '- 100 LFO / LFO', '2 200 Joey Beltram / Energy Flash', '3 400 Altern 8 / Infiltrate 202', '4 - LFO / LFO']);
    });

    it('don’t let one mistimed ID unseat the rest', () => {
      // The first line, said to start an hour in: every other line would have to come after it.
      const ids = [id(3600, 'Orbital', 'Chime'), id(200, 'Joey Beltram', 'Energy Flash'), id(400, 'Altern 8', 'Infiltrate 202'), id(600, 'LFO', 'LFO')];
      expect(shown(rows(four, ids))).toEqual(['1 - Orbital / Chime', '2 200 Joey Beltram / Energy Flash', '3 400 Altern 8 / Infiltrate 202', '4 600 LFO / LFO', '- 3600 Orbital / Chime']);
    });

    it('keep what was said earlier where two times can’t both stand: a new ID that can’t fit never unseats an older one', () => {
      // The keeper times their own seventh line; someone then says the second line starts after it.
      const kept: RunningOrder = { by: 'Josh', tracks: [...four.tracks.slice(0, 2), { n: 3, artist: '', title: '', known: false, at: 805 }] };
      const older = [id(805, '', '', 'Josh', '2013-01-01'), id(1075, 'Joey Beltram', 'Energy Flash', 'Rents', '2026-01-01')];
      expect(shown(rows(kept, older))).toEqual(['1 - Orbital / Chime', '2 - Joey Beltram / Energy Flash', '3 805 ??', '- 1075 Joey Beltram / Energy Flash']);
      // Said the other way round, it is the keeper's time that can't fit.
      const newer = [id(805, '', '', 'Josh', '2026-01-01'), id(1075, 'Joey Beltram', 'Energy Flash', 'Rents', '2013-01-01')];
      expect(shown(rows(kept, newer))).toEqual(['- 805 ??', '1 - Orbital / Chime', '2 1075 Joey Beltram / Energy Flash', '3 - ??']);
      // The visitor's own change is the newest word of all.
      expect(shown(rows(kept, [older[0]], [said(1075, 'Joey Beltram', 'Energy Flash')]))).toEqual(['1 - Orbital / Chime', '2 - Joey Beltram / Energy Flash', '3 805 ??', '- 1075 Joey Beltram / Energy Flash']);
    });

    it('have the two plays of a record that is on the list twice in the list’s order', () => {
      const twice = list(null, 'Captain Scarlet - The Mysterons Message', 'Orbital - Chime', 'Captain Scarlet - The Mysterons Message');
      // One play, timed after the track between them: it is the second.
      expect(shown(rows(twice, [id(300, 'Orbital', 'Chime'), id(500, 'Captain Scarlet', 'The Mysterons Message')]))).toEqual(['1 - Captain Scarlet / The Mysterons Message', '2 300 Orbital / Chime', '3 500 Captain Scarlet / The Mysterons Message']);
      // Both.
      expect(shown(rows(twice, [id(0, 'Captain Scarlet', 'The Mysterons Message'), id(300, 'Orbital', 'Chime'), id(500, 'Captain Scarlet', 'The Mysterons Message')])).map((r) => r.split(' ')[1])).toEqual(['0', '300', '500']);
    });

    it('keep an ID with no line in its place by time when a line beside it is given a time', () => {
      const ids = [id(496, 'The Prodigy', 'Hyperspeed (G-Force Part 2)'), id(592, 'Stakker', 'Humanoid')];
      expect(shown(rows(order, ids)).map((r) => r.split(' ').slice(0, 2).join(' '))).toEqual(['1 496', '- 592', '2 -', '3 -']);
      expect(shown(rows(order, ids, [said(522, 'Butsch', 'The Count')])).map((r) => r.split(' ').slice(0, 2).join(' '))).toEqual(['1 496', '2 522', '- 592', '3 -']);
    });
  });

  it('carry the visitor’s change on the row it gave its time to', () => {
    const change = said(221, 'Butsch', 'The Count');
    const all = rows(order, [id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)')], [change]);
    expect(all[1]).toMatchObject({ n: 2, start: 221, by: null });
    expect(all[1].mine).toBe(change);
    expect(saidBy(all[1])).toBe('Yours, not posted yet');
    expect(saidBy(all[0])).toBe('ID by Rents');
    expect(saidBy(rows(null, [id(5, '', '', 'Josh')])[0])).toBe('Marked by Josh');
  });
});

describe('what is asked of a side’s rows', () => {
  const rows = sideRows(order, withChanges([id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)'), { ...id(400, 'Altern 8', 'Infiltrate 202'), end: 500 }], []));

  it('what is playing: the last row to start, if it hasn’t ended', () => {
    expect(playingAt(rows, 0)).toBe(0);
    expect(playingAt(rows, 239)).toBe(0);
    // Four minutes on with nothing known to follow, it is taken to have ended.
    expect(playingAt(rows, 240)).toBe(-1);
    expect(playingAt(rows, 400)).toBe(1);
    expect(playingAt(rows, 500)).toBe(-1);
    expect(playingAt([], 10)).toBe(-1);
  });

  it('what starts within a moment of a time, either side of it', () => {
    expect(startingAt(rows, 5)).toBe(0);
    expect(startingAt(rows, 6)).toBe(-1);
    expect(startingAt(rows, 395)).toBe(1);
    expect(startingAt(rows, 394)).toBe(-1);
  });

  it('the timed rows as marks for the waveform', () => {
    expect(timeline(rows).map((x) => `${x.start}-${x.end} ${x.artist}`)).toEqual(['0-240 The Prodigy', '400-500 Altern 8']);
  });
});

describe('the lines that could be given a moment as their start', () => {
  const at = (o: RunningOrder, ids: TrackId[], time: number) => {
    const rows = sideRows(o, withChanges(ids, []));
    return couldStartAt(rows, time).map((k) => rows[k].n);
  };
  const five = list(null, 'Orbital - Chime', 'Joey Beltram - Energy Flash', 'Altern 8 - Infiltrate 202', 'LFO - LFO', 'SL2 - DJs Take Control');
  const timed = [id(0, 'Orbital', 'Chime'), id(400, 'Altern 8', 'Infiltrate 202')];

  it('are those with no time, between the timed lines the moment falls between', () => {
    expect(at(five, timed, 200)).toEqual([2]);
    expect(at(five, timed, 450)).toEqual([4, 5]);
    expect(at(five, [], 100)).toEqual([1, 2, 3, 4, 5]);
  });

  it('are none within a moment of a track’s start: one moment, one track', () => {
    expect(at(five, timed, 3)).toEqual([]);
    expect(at(five, timed, 396)).toEqual([]);
    expect(at(five, timed, 406)).toEqual([4, 5]);
  });

  it('are never a row that is not a line of the list', () => {
    expect(at(five, [...timed, id(150, 'Stakker', 'Humanoid')], 200)).toEqual([2]);
    expect(couldStartAt(sideRows(null, [id(0, 'Orbital', 'Chime')]), 100)).toEqual([]);
  });

  it('are only the first of the lines with no name: one is as good as another, and an unnamed track goes to the first', () => {
    const kept = list('Josh', 'Orbital - Chime', null, 'LFO - LFO', null, null);
    expect(at(kept, [id(0, 'Orbital', 'Chime')], 300)).toEqual([2, 3]);
  });

  it('are only the first of two lines that name the same record', () => {
    const twice = list(null, 'Johnny Dangerous - Father In Heaven', 'Johnny Dangerous - Father In Heaven', 'LFO - LFO');
    expect(at(twice, [], 300)).toEqual([1, 3]);
  });

  it('are never a line naming the record that plays just before the moment or starts just after: said there, it is that play said again', () => {
    const twice = list(null, 'Johnny Dangerous - Father In Heaven', 'Johnny Dangerous - Father In Heaven', 'LFO - LFO');
    expect(at(twice, [id(0, 'Johnny Dangerous', 'Father In Heaven')], 300)).toEqual([3]);
    const after = list(null, 'LFO - LFO', 'Johnny Dangerous - Father In Heaven', 'Johnny Dangerous - Father In Heaven');
    expect(at(after, [id(500, 'Johnny Dangerous', 'Father In Heaven')], 100)).toEqual([1]);
  });
});

describe('names a list offers for a moment being ID’d', () => {
  // Ten tracks on a side of 40 minutes: four minutes each, if they were all the same length.
  const ten = list(null, 'Orbital - Chime', 'Moby - Go', 'Joey Beltram - Energy Flash', 'LFO - LFO', 'Altern 8 - Infiltrate 202', 'The Prodigy - Charly', 'SL2 - DJs Take Control', 'Bizarre Inc - Playing With Knives', 'Rhythm Section - Feel The Rhythm', 'Shut Up And Dance - Raving I’m Raving');
  const offered = (ids: TrackId[], start: number, length: number | null = 2400, most?: number, o = ten) => suggest(sideRows(o, withChanges(ids, [])), start, length, most).map((row) => row.n);

  it('are the two lines nearest to where the moment falls on the side, in list order', () => {
    expect(offered([], 0)).toEqual([1, 2]);
    // Half way through the side is where the sixth track would start.
    expect(offered([], 1200)).toEqual([5, 6]);
    expect(offered([], 2300)).toEqual([9, 10]);
    expect(offered([], 1200, 2400, 1)).toHaveLength(1);
  });

  it('are never a line that already has its time, and are counted from the lines that do', () => {
    // The fourth and the eighth are ID’d, at 20:00 and 30:00: later than an even side would have them.
    const ids = [id(1200, 'LFO', 'LFO'), id(1800, 'Bizarre Inc', 'Playing With Knives')];
    // Between them are the fifth, sixth and seventh. A little past half way is the sixth, then the seventh.
    expect(offered(ids, 1560)).toEqual([6, 7]);
    // Before the fourth are the first three. A third of the way there is the second.
    expect(offered(ids, 400)).toEqual([1, 2]);
  });

  it('are only lines the list’s order allows to start there', () => {
    // The second is known to start at 30:00, so only the first plays before that.
    expect(offered([id(1800, 'Moby', 'Go')], 600)).toEqual([1]);
  });

  it('go by the tracks gone by where the side’s length is not known', () => {
    expect(offered([id(0, 'Orbital', 'Chime'), id(300, 'Moby', 'Go')], 700, null)).toEqual([3, 4]);
  });

  it('are for the mark being named, which is set aside: a spot marked without a name can be any line that could start there', () => {
    expect(offered([id(0, 'Orbital', 'Chime'), id(300, '', '')], 300)).toEqual([2, 3]);
  });

  it('are none where the moment is a line the list itself has down as unknown, a line with half a name, or no line is left', () => {
    const kept: RunningOrder = { by: 'Josh', tracks: [...ten.tracks.slice(0, 2), { n: 3, artist: '', title: '', known: false, at: 480 }, ...ten.tracks.slice(3)] };
    expect(offered([id(480, '', '')], 480, 2400, 2, kept)).toEqual([]);
    expect(offered([], 100, 2400, 2, { by: 'Josh', tracks: [{ n: 1, artist: '', title: 'intro', known: true }] })).toEqual([]);
    expect(offered([id(0, 'Orbital', 'Chime')], 100, 2400, 2, list(null, 'Orbital - Chime'))).toEqual([]);
  });
});

describe('the visitor’s changes that still change something', () => {
  it('are the posted ones, and the unposted ones some row shows', () => {
    const posted = [id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)'), id(221, 'Butsch', 'The Count')];
    const overtaken = said(223, 'Butsch', 'The Count');
    const mine = said(600, 'Rhythm For Reasons', 'Grand National');
    const justSent = said(0, 'The Prodigy', 'Hyperspeed', sent);
    expect(standing(order, posted, [overtaken, mine, justSent])).toEqual([mine, justSent]);
  });
});

describe('who a tape’s tracklist is owed to', () => {
  it('is everyone who gave a line its time and whoever kept a list its names are from, whoever gave the most first', () => {
    const a = sideRows(null, [id(0, 'Orbital', 'Chime', 'Josh'), id(300, 'Joey Beltram', 'Energy Flash', 'Rents'), id(600, 'Altern 8', 'Infiltrate 202', 'Rents')]);
    const b = sideRows({ ...order, by: 'Softboiled' }, [id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)', 'Dana')]);
    expect(contributors([{ rows: a, keeper: null }, { rows: b, keeper: 'Softboiled' }])).toEqual(['Softboiled', 'Rents', 'Dana', 'Josh']);
  });

  it('is nobody on a tape that has only its own tracklist, and never the visitor for a time they haven’t posted', () => {
    expect(contributors([{ rows: sideRows(order, []), keeper: null }])).toEqual([]);
    expect(contributors([{ rows: sideRows(order, withChanges([], [said(221, 'Butsch', 'The Count')])), keeper: null }])).toEqual([]);
    expect(contributors([{ rows: sideRows(order, withChanges([], [said(221, 'Butsch', 'The Count', sent)])), keeper: null }])).toEqual(['Dana']);
  });
});

describe('every side in the archive', () => {
  const all = comments as Record<string, { author: string; date: string; content: string }[]>;
  const sides = (tapes as unknown as Tape[]).flatMap((tape) => {
    const read = readSaid(tape, (all[tape.id] ?? []).map((c) => ({ author: c.author, date: c.date, content: c.content })));
    return tape.sides.map((side, i) => ({ name: `${tape.id} [${side.position}]`, order: read.orders[i], ids: read.sides[i] }));
  });

  it('has its rows in order of time, each ID on one row and each line of its list on one row', () => {
    for (const { name, order: o, ids } of sides) {
      const rows = sideRows(o, withChanges(ids, []));
      const starts = rows.flatMap((row) => (row.start === null ? [] : [row.start]));
      expect(starts, name).toEqual([...starts].sort((a, b) => a - b));
      expect(starts, name).toHaveLength(ids.length);
      expect(rows.filter((row) => row.n !== null), name).toHaveLength(o?.tracks.length ?? 0);
    }
  });

  // What pressing + on each waiting line at a moment would do, worked out the long way: say it, work the side
  // out again, and see whether that line has that moment.
  const pressed = (o: RunningOrder, ids: TrackId[], changes: Change[], rows: Row[], time: number) =>
    rows.flatMap((row, k) => {
      if (row.n === null || row.start !== null) return [];
      const change = said(time, row.known ? row.artist : '', row.known ? row.title : '');
      const then = sideRows(o, withChanges(ids, [...changes, change])).find((r) => r.n === row.n) as Row;
      return then.start === time && then.mine === change ? [k] : [];
    });
  // Moments to try on a side: before anything, hard by each start on both sides of it, and at the quarters
  // of each stretch between two tracks and of the ten minutes after the last.
  const moments = (rows: Row[]) => {
    const starts = rows.flatMap((row) => (row.start === null ? [] : [row.start]));
    return [...new Set([20, ...starts.flatMap((start, k) => [start - 3, start + 3, start + 6, ...[0.25, 0.5, 0.75].map((part) => Math.floor(start + ((starts[k + 1] ?? start + 600) - start) * part))])])].filter((time) => time >= 0);
  };

  it('offers a + on exactly the rows that pressing it would give that moment to', () => {
    let offered = 0;
    for (const { name, order: o, ids } of sides) {
      if (!o) continue;
      const rows = sideRows(o, withChanges(ids, []));
      for (const time of moments(rows)) {
        // Within a moment of a start nothing else can start, so nothing is on offer. Anywhere else, what is
        // on offer is what pressing would do.
        const would = startingAt(rows, time) >= 0 ? [] : pressed(o, ids, [], rows, time);
        expect(couldStartAt(rows, time), `${name} at ${time}`).toEqual(would);
        offered += would.length;
      }
    }
    // The check is of something: the archive's lists have lines waiting for a time.
    expect(offered).toBeGreaterThan(2000);
  });

  it('goes on doing so, and keeps its rows in order of time, as a visitor times a side line by line', () => {
    let timed = 0;
    for (const { name, order: o, ids } of sides) {
      if (!o) continue;
      // A listen through the side: at each moment, the first line on offer is given it, as a visitor would.
      const changes: Change[] = [];
      let rows = sideRows(o, withChanges(ids, changes));
      for (const time of moments(rows).sort((a, b) => a - b)) {
        const could = couldStartAt(rows, time);
        expect(could, `${name} at ${time} with ${changes.length} said`).toEqual(startingAt(rows, time) >= 0 ? [] : pressed(o, ids, changes, rows, time));
        if (could.length === 0) continue;
        const row = rows[could[0]];
        changes.push(said(time, row.known ? row.artist : '', row.known ? row.title : ''));
        rows = sideRows(o, withChanges(ids, changes));
        timed++;
        const starts = rows.flatMap((r) => (r.start === null ? [] : [r.start]));
        expect(starts, `${name} after ${time}`).toEqual([...starts].sort((a, b) => a - b));
        // Every change is still on a row: none was swallowed by another.
        expect(new Set(rows.map((r) => r.mine)).size - 1, `${name} after ${time}`).toBe(changes.length);
      }
    }
    expect(timed).toBeGreaterThan(300);
  });

  it('shows for a change, before it is posted, what the reader says of the side once it is a comment', () => {
    const lines = (rows: Row[]) => rows.map((r) => `${r.n ?? '-'} ${r.start ?? '-'} ${r.known ? `${r.artist} / ${r.title}` : '??'}`);
    const posted = { sent: { by: 'Dana', read: 1 } };
    let tried = 0;
    for (const tape of tapes as unknown as Tape[]) {
      const before = (all[tape.id] ?? []).map((c) => ({ author: c.author, date: c.date, content: c.content }));
      const read = readSaid(tape, before);
      tape.sides.forEach((side, i) => {
        const o = read.orders[i];
        const ids = read.sides[i];
        const rows = sideRows(o, withChanges(ids, []));
        if (rows.length === 0) return;
        const name = `${tape.id} [${side.position}]`;
        const position = tape.sides.length > 1 ? side.position : null;
        // The tape can't be anywhere past the side's end, and the reader holds nothing to be there.
        const end = (lengths as Record<string, (number | null)[]>)[tape.id]?.[i] ?? Infinity;
        const starts = rows.flatMap((row) => (row.start === null ? [] : [row.start]));
        const free = [20, ...starts.map((start, k) => Math.floor((start + (starts[k + 1] ?? start + 600)) / 2)), ...starts.map((start) => start + 12)].filter((time) => time < end && startingAt(rows, time) < 0).slice(0, 3);

        // What a visitor can say of the side, each as the page makes it.
        const cases: Change[][] = [];
        for (const time of free) {
          cases.push([said(time)]);
          cases.push([said(time, 'Zzyzx Road', `Quite Unlike Anything ${time}`)]);
          for (const k of couldStartAt(rows, time).slice(0, 2)) cases.push([said(time, rows[k].known ? rows[k].artist : '', rows[k].known ? rows[k].title : '')]);
        }
        for (const row of rows.filter((r) => r.start !== null).slice(0, 2)) {
          const start = row.start as number;
          const gone = said(start, '', '', { gone: true, ...posted });
          cases.push([gone]);
          cases.push([said(start, 'Zzyzx Road', 'Quite Unlike Anything', posted)]);
          if (start + 9 < end && startingAt(rows.filter((r) => r !== row), start + 9) < 0) cases.push([gone, said(start + 9, row.artist, row.title, posted)]);
        }

        for (const changes of cases) {
          const page = lines(sideRows(o, withChanges(ids, changes.map((change) => ({ ...change, side: i })))));
          const comment = changes.map((c) => (c.gone ? composeRemoval({ position, time: c.time }) : composeId({ position, time: c.time, artist: c.artist, title: c.title }))).join('\n');
          const after = readSaid(tape, [...before, { author: 'Dana', date: '2026-11-15T12:00:00.000Z', content: comment }]);
          const reader = lines(sideRows(after.orders[i], withChanges(after.sides[i], [])));
          expect(page, `${name}: ${comment}`).toEqual(reader);
          tried++;
        }
      });
    }
    expect(tried).toBeGreaterThan(1000);
  });
});
