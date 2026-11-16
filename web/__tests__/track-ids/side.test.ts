// The one working-out of what is on a side (lib/track-ids/side.ts). First its rules, one at a time, on small
// made-up sides. Then the same rules held against every side in the archive, where what could go wrong is
// whatever real lists and real comments happen to contain.
import { describe, expect, it } from 'vitest';
import lengths from '@/data/side-lengths.json';
import comments from '@/data/tape-comments.json';
import tapes from '@/data/tapes.json';
import { composeId, composeRemoval, readComposed, type RunningOrder } from '@/lib/track-ids/compose';
import { settle, type Moment, type TrackId } from '@/lib/track-ids/moments';
import { digest, reconcile, sideNames, trusted, type Sighting } from '@/lib/track-ids/parse';
import { readSaid } from '@/lib/track-ids/said';
import { asListed, canMoveTo, canStartAt, contributors, couldStartAt, playingAt, saidBy, sideRows, standing, startingAt, suggest, timeline, withChanges, type Change, type Row } from '@/lib/track-ids/side';
import type { Tape } from '@/types/tape';

/** What the comments say starts at a time: an ID, or with no names a spot someone marked. */
const id = (start: number, artist: string, title: string, by = 'Rents', date = '2020-01-01'): Moment => ({ start, artist, title, known: Boolean(artist || title), by, date });
const said = (time: number, artist = '', title = '', more: Partial<Change> = {}): Change => ({ side: 0, time, artist, title, ...more });
const sent = { sent: { by: 'Dana', read: 1 } };
const list = (by: string | null, ...names: (string | null)[]): RunningOrder => ({
  by,
  tracks: names.map((name, k) => (name === null ? { n: k + 1, artist: '', title: '', known: false } : { n: k + 1, artist: name.split(' - ')[0], title: name.split(' - ')[1], known: true })),
});
const order = list(null, 'The Prodigy - Hyperspeed (G-Force Part 2)', 'Butsch - The Count', 'Rhythm For Reasons - Grand National');
const shown = (rows: Row[]) => rows.map((r) => `${r.n ?? '-'} ${r.start ?? '-'} ${r.known ? `${r.artist} / ${r.title}` : '??'}`);
const times = (ids: TrackId[]) => ids.map((x) => `${x.start}-${x.end} ${x.known ? `${x.artist} / ${x.title}` : '??'}`);

describe('a side’s tracks with the visitor’s changes among them', () => {
  // Chime runs to the spot Josh marked at 4:00, which a comment says ends at 8:00. Energy Flash is the last anyone timed.
  const posted = [id(0, 'Orbital', 'Chime'), { ...id(240, '', '', 'Josh'), until: 480 }, id(600, 'Joey Beltram', 'Energy Flash')];
  const gone = (time: number) => said(time, '', '', { gone: true, ...sent });

  it('are the tracks the comments’ moments make where the visitor has said nothing', () => {
    expect(withChanges(posted, [])).toEqual(settle(posted));
    expect(times(withChanges(posted, []))).toEqual(['0-240 Orbital / Chime', '240-480 ??', '600-1200 Joey Beltram / Energy Flash']);
  });

  it('have a track moved a few seconds as moved, whichever of the post’s two lines comes first', () => {
    // The ID at its new time is within a moment of the old one: taken first, it is said of the track being
    // taken away, and must not go with it.
    const moved = (to: number) => [gone(600), said(to, 'Joey Beltram', 'Energy Flash', sent)];
    for (const to of [595, 597, 603, 605]) {
      const tracks = ['0-240 Orbital / Chime', '240-480 ??', `${to}-${to + 600} Joey Beltram / Energy Flash`];
      expect(times(withChanges(posted, moved(to))), `to ${to}`).toEqual(tracks);
      expect(times(withChanges(posted, moved(to).reverse())), `to ${to}, the ID first`).toEqual(tracks);
    }
  });

  it('have a change at a moment of its own as a new track from there, until the next one starts', () => {
    const change = said(500);
    const ids = withChanges(posted, [change]);
    expect(times(ids)).toEqual(['0-240 Orbital / Chime', '240-480 ??', '500-600 ??', '600-1200 Joey Beltram / Energy Flash']);
    expect(ids[2].mine).toBe(change);
    // What was playing there is cut off where the new track starts.
    expect(times(withChanges(posted, [said(100)]))[0]).toBe('0-100 Orbital / Chime');
    // And the last track anyone had timed now runs to it, however far on it is.
    expect(times(withChanges(posted, [said(1500)]))[2]).toBe('600-1500 Joey Beltram / Energy Flash');
  });

  it('read a change as its line of a comment will read back: its time to the second, its names as written there', () => {
    const [track] = withChanges([], [said(100.9, ' Jean - Michel   Jarre ', ' Oxygene (Part  IV) ')]);
    expect(track).toMatchObject({ start: 100, artist: 'Jean-Michel Jarre', title: 'Oxygene (Part IV)', known: true });
    // A name that is only a question mark, or only spaces, is no name.
    expect(withChanges([], [said(10, '?', ' ')])[0]).toMatchObject({ artist: '', title: '', known: false });
  });

  it('take a change within a moment of a mark as said of that mark: one moment, one track', () => {
    // A name for the spot someone marked without one, from where it was marked. Where it ends is still where the comments say.
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
    expect(times(withChanges(posted, [said(600, '', '', sent)]))[2]).toBe('600-1200 Joey Beltram / Energy Flash');
  });

  it('start a moment at the earliest time anyone gave for it', () => {
    // Said three seconds before the mark, a posted change is still said of it, and it starts from there:
    // named by it, or, where the mark keeps its own name, only moved by it.
    expect(times(withChanges(posted, [said(237, 'LFO', 'LFO', sent)]))[1]).toBe('237-480 LFO / LFO');
    const moved = withChanges(posted, [said(597, '', '', sent)])[2];
    expect([moved.start, moved.artist, moved.mine]).toEqual([597, 'Joey Beltram', undefined]);
    // A start nobody gave as a time (the track heads a list, and is taken to open the side) gives way to one somebody did.
    const opener = [{ ...id(0, 'Orbital', 'Chime'), guessed: true }];
    expect(times(withChanges(opener, [said(4, 'Orbital', 'Chime (Edit)', sent)]))).toEqual(['4-604 Orbital / Chime (Edit)']);
  });

  it('drop a mark taken away, and let what played before it play on', () => {
    expect(times(withChanges(posted, [gone(240)]))).toEqual(['0-600 Orbital / Chime', '600-1200 Joey Beltram / Energy Flash']);
    expect(times(withChanges([posted[0], posted[1], id(400, 'Joey Beltram', 'Energy Flash')], [gone(240)]))[0]).toBe('0-400 Orbital / Chime');
    // Taking away what isn't there changes nothing.
    expect(withChanges(posted, [gone(400)])).toEqual(settle(posted));
  });

  it('take a record named again, with nothing else between, as the same play: the earlier start stands', () => {
    const one = [id(300, 'Altern 8', 'Infiltrate 202')];
    expect(times(withChanges(one, [said(400, 'Altern 8', 'Infiltrate 202', sent)]))).toEqual(['300-1000 Altern 8 / Infiltrate 202']);
    expect(times(withChanges(one, [said(200, 'Altern 8', 'Infiltrate 202', sent)]))).toEqual(['200-900 Altern 8 / Infiltrate 202']);
    // With another track between them, they are two plays: marked there, or there once the comments' own second saying is parted from the first.
    expect(withChanges([...one, id(350, '', '')], [said(400, 'Altern 8', 'Infiltrate 202', sent)])).toHaveLength(3);
    const twice = [...one, id(700, 'Altern 8', 'Infiltrate 202', 'Josh')];
    expect(times(withChanges(twice, []))).toEqual(['300-1300 Altern 8 / Infiltrate 202']);
    expect(times(withChanges(twice, [said(500)]))).toEqual(['300-500 Altern 8 / Infiltrate 202', '500-700 ??', '700-1300 Altern 8 / Infiltrate 202']);
    expect(times(withChanges(twice, [gone(300)]))).toEqual(['700-1300 Altern 8 / Infiltrate 202']);
  });

  it('take a change at the nearer of two marks it is within a moment of', () => {
    const close = [id(100, '', ''), id(108, '', '')];
    expect(times(withChanges(close, [said(105, 'LFO', 'LFO')]))).toEqual(['100-105 ??', '105-705 LFO / LFO']);
  });

  it('have nothing start in a side’s last moments: there is no room left for a track', () => {
    expect(times(withChanges(posted, [said(895)], 900))[3]).toBe('895-900 ??');
    expect(withChanges(posted, [said(896)], 900)).toHaveLength(3);
    // And the last track runs to the side's end, where that is sooner than it is taken to play.
    expect(times(withChanges(posted, [], 700))[2]).toBe('600-700 Joey Beltram / Energy Flash');
  });
});

describe('what a visitor has waiting to be posted', () => {
  it('is said together, as the one comment it will be, in whatever order it was made', () => {
    // One record in two mixes, one after the other, and then another record. The visitor times the first mix,
    // then the last line, and then, later on the tape than that, the second mix: three times that can't all
    // stand in the list's order. The page settles it as the reader will when they arrive in one comment.
    const tape = { id: 'made-up', sides: [{ position: 'A', tracks: [{ artist: 'Bizarre Inc', title: 'Playing With Knives (Quadrant Mix)' }, { artist: 'Bizarre Inc', title: 'Playing With Knives (Climax Mix)' }, { artist: 'Altern 8', title: 'Infiltrate 202' }] }] } as never;
    const made = [said(6, 'Bizarre Inc', 'Playing With Knives (Quadrant Mix)'), said(20, 'Altern 8', 'Infiltrate 202'), said(150, 'Bizarre Inc', 'Playing With Knives (Climax Mix)')];
    const comment = [...made].sort((a, b) => a.time - b.time).map((c) => composeId({ position: null, time: c.time, artist: c.artist, title: c.title })).join('\n');
    const read = readSaid(tape, [{ author: 'Dana', date: '2026-11-15T12:00:00.000Z', content: comment }]);
    const theirs = shown(sideRows(read.orders[0], withChanges(read.sides[0], [])));
    expect(shown(sideRows(read.orders[0], withChanges([], made)))).toEqual(theirs);
    // And still, between the post and the reading that has it.
    expect(shown(sideRows(read.orders[0], withChanges([], made.map((change) => ({ ...change, ...sent })))))).toEqual(theirs);
  });
});

describe('a side’s rows', () => {
  const rows = (o: RunningOrder | null, ids: Moment[], changes: Change[] = []) => sideRows(o, withChanges(ids, changes));

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

  it('have a track run to the next, however far on, unless the list has lines with no time between them: then other tracks played there, and it is taken to play ten minutes', () => {
    const spans = (o: RunningOrder | null, ids: Moment[]) => rows(o, ids).flatMap((r) => (r.start === null ? [] : [`${r.start}-${r.end}`]));
    const kept = list('Josh', 'Orbital - Chime', 'Joey Beltram - Energy Flash', 'Altern 8 - Infiltrate 202');
    // The first and second lines, thirteen minutes apart: the list says nothing came between.
    expect(spans(kept, [id(0, 'Orbital', 'Chime'), id(780, 'Joey Beltram', 'Energy Flash')])).toEqual(['0-780', '780-1380']);
    // The first and third, with the second waiting for its time: it played somewhere in there.
    expect(spans(kept, [id(0, 'Orbital', 'Chime'), id(780, 'Altern 8', 'Infiltrate 202')])).toEqual(['0-600', '780-1380']);
    // Sooner than ten minutes on, the next track ends it as ever.
    expect(spans(kept, [id(0, 'Orbital', 'Chime'), id(300, 'Altern 8', 'Infiltrate 202')])).toEqual(['0-300', '300-900']);
    // A comment that says where it ends is believed over the guess.
    expect(spans(kept, [{ ...id(0, 'Orbital', 'Chime'), until: 700 }, id(780, 'Altern 8', 'Infiltrate 202')])).toEqual(['0-700', '780-1380']);
    // A track the list hasn't got is held to the same: the lines after it with no time played before the next.
    expect(spans(kept, [id(0, 'LFO', 'LFO'), id(780, 'Altern 8', 'Infiltrate 202')])).toEqual(['0-600', '780-1380']);
    // With no list there is nothing to say a track is missing.
    expect(spans(null, [id(0, 'Orbital', 'Chime'), id(780, 'Altern 8', 'Infiltrate 202')])).toEqual(['0-780', '780-1380']);
  });

  it('never let an ID that names another line of the list stand in for a line with no name', () => {
    // The last line's record, said to start the side: it can't be the unnamed line in the middle.
    const kept = list('Josh', 'Orbital - Chime', null, 'Joey Beltram - Energy Flash', 'Altern 8 - Infiltrate 202');
    const ids = [id(0, 'Altern 8', 'Infiltrate 202'), id(300, 'Orbital', 'Chime'), id(900, 'Joey Beltram', 'Energy Flash')];
    expect(shown(rows(kept, ids))).toEqual(['4 0 Altern 8 / Infiltrate 202', '1 300 Orbital / Chime', '2 - ??', '3 900 Joey Beltram / Energy Flash']);
  });

  it('have an ID that says it is a line under another name as that line: in its place, reading as the ID does', () => {
    const own: RunningOrder = { by: null, tracks: [{ n: 1, artist: 'Orbital', title: 'Chime', known: true, link: 'https://www.discogs.com/release/1', duration: '4:10' }, { n: 2, artist: 'LFO', title: 'LFO', known: true }] };
    const line = { artist: 'Orbital', title: 'Chime' };
    // With its mix added it is still the list's record, and keeps the list's link to it.
    const fuller = rows(own, [{ ...id(60, 'Orbital', 'Chime (JZJ Remix)'), line }]);
    expect(shown(fuller)).toEqual(['1 60 Orbital / Chime (JZJ Remix)', '2 - LFO / LFO']);
    expect(fuller[0]).toMatchObject({ line, link: 'https://www.discogs.com/release/1', duration: '4:10' });
    // Named as another record altogether it is still the line, and the link to the old record goes.
    const other = rows(own, [{ ...id(60, 'Joey Beltram', 'Energy Flash'), line }]);
    expect(shown(other)).toEqual(['1 60 Joey Beltram / Energy Flash', '2 - LFO / LFO']);
    expect(other[0].link).toBeUndefined();
    expect(other[0].line).toEqual(line);
    // Without saying so, an ID with another name is a track of its own, and the line waits.
    expect(shown(rows(own, [id(60, 'Joey Beltram', 'Energy Flash')]))).toEqual(['- 60 Joey Beltram / Energy Flash', '1 - Orbital / Chime', '2 - LFO / LFO']);
    // A name given the moment afterwards that doesn't say so is no longer that line, on the page as in the reader.
    expect(shown(rows(own, [{ ...id(60, 'Joey Beltram', 'Energy Flash'), line }], [said(60, 'Altern 8', 'Infiltrate 202', sent)]))).toEqual(['- 60 Altern 8 / Infiltrate 202', '1 - Orbital / Chime', '2 - LFO / LFO']);
    // The visitor's own change does the same before it is posted, and out of the list's order too.
    expect(shown(rows(own, [id(60, 'LFO', 'LFO')], [said(30, 'Joey Beltram', 'Energy Flash', { line })]))).toEqual(['1 30 Joey Beltram / Energy Flash', '2 60 LFO / LFO']);
    expect(shown(rows(own, [id(60, 'Orbital', 'Chime')], [said(30, 'LFO', 'LFO (Leeds Warehouse Mix)', { line: { artist: 'LFO', title: 'LFO' } })]))).toEqual(['2 30 LFO / LFO (Leeds Warehouse Mix)', '1 60 Orbital / Chime']);
  });

  it('tell a name that is the list’s own, word for word, from one that is not', () => {
    const line = { artist: 'Orbital', title: 'Chime' };
    expect([asListed({ artist: ' orbital ', title: 'CHIME' }, line), asListed({ artist: 'Orbital', title: 'Chime (JZJ Remix)' }, line), asListed({ artist: 'Orbital', title: '' }, line)]).toEqual([true, false, false]);
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

    it('show an ID that names a line out of the list’s order by its time, as that line, and the line nowhere else', () => {
      // The fourth line, said to start before the second.
      const ids = [id(0, 'Orbital', 'Chime'), id(200, 'Joey Beltram', 'Energy Flash'), id(400, 'Altern 8', 'Infiltrate 202'), id(100, 'LFO', 'LFO')];
      const all = rows(four, ids);
      expect(shown(all)).toEqual(['1 0 Orbital / Chime', '4 100 LFO / LFO', '2 200 Joey Beltram / Energy Flash', '3 400 Altern 8 / Infiltrate 202']);
      expect(all.map((r) => Boolean(r.astray))).toEqual([false, true, false, false]);
      // The lines in the list's order go on as if it were an ID of its own: the + is offered as it was.
      const waiting = rows(four, [ids[0], ids[2], ids[3]]);
      expect(shown(waiting)).toEqual(['1 0 Orbital / Chime', '4 100 LFO / LFO', '2 - Joey Beltram / Energy Flash', '3 400 Altern 8 / Infiltrate 202']);
      expect([couldStartAt(waiting, 50), couldStartAt(waiting, 200)]).toEqual([[2], [2]]);
    });

    it('have a record that is on the list once and said twice as its line once, and the other time as an ID of its own', () => {
      const ids = [id(0, 'Orbital', 'Chime'), id(200, 'Joey Beltram', 'Energy Flash'), id(900, 'Orbital', 'Chime')];
      expect(shown(rows(four, ids))).toEqual(['1 0 Orbital / Chime', '2 200 Joey Beltram / Energy Flash', '- 900 Orbital / Chime', '3 - Altern 8 / Infiltrate 202', '4 - LFO / LFO']);
    });

    it('don’t let one mistimed ID unseat the rest', () => {
      // The first line, said to start an hour in: every other line would have to come after it.
      const ids = [id(3600, 'Orbital', 'Chime'), id(200, 'Joey Beltram', 'Energy Flash'), id(400, 'Altern 8', 'Infiltrate 202'), id(600, 'LFO', 'LFO')];
      expect(shown(rows(four, ids))).toEqual(['2 200 Joey Beltram / Energy Flash', '3 400 Altern 8 / Infiltrate 202', '4 600 LFO / LFO', '1 3600 Orbital / Chime']);
    });

    it('keep what was said earlier where two times can’t both stand: a new ID that can’t fit never unseats an older one', () => {
      // The keeper times their own seventh line; someone then says the second line starts after it.
      const kept: RunningOrder = { by: 'Josh', tracks: [...four.tracks.slice(0, 2), { n: 3, artist: '', title: '', known: false, at: 805 }] };
      const older = [id(805, '', '', 'Josh', '2013-01-01'), id(1075, 'Joey Beltram', 'Energy Flash', 'Rents', '2026-01-01')];
      expect(shown(rows(kept, older))).toEqual(['1 - Orbital / Chime', '3 805 ??', '2 1075 Joey Beltram / Energy Flash']);
      // Said the other way round, it is the keeper's time that can't fit.
      const newer = [id(805, '', '', 'Josh', '2026-01-01'), id(1075, 'Joey Beltram', 'Energy Flash', 'Rents', '2013-01-01')];
      expect(shown(rows(kept, newer))).toEqual(['- 805 ??', '1 - Orbital / Chime', '2 1075 Joey Beltram / Energy Flash', '3 - ??']);
      // The visitor's own change is the newest word of all.
      expect(shown(rows(kept, [older[0]], [said(1075, 'Joey Beltram', 'Energy Flash')]))).toEqual(['1 - Orbital / Chime', '3 805 ??', '2 1075 Joey Beltram / Energy Flash']);
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
  // The opener runs until the unnamed track at 4:00; over that one a record is layered from 5:00 to 5:30; the last is said to end at 8:20.
  const rows = sideRows(order, withChanges([id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)'), id(240, '', ''), { ...id(300, 'LFO', 'LFO'), layer: true, until: 330 }, { ...id(400, 'Altern 8', 'Infiltrate 202'), until: 500 }], []));

  const playing = (time: number) => rows[playingAt(rows, time)]?.start ?? null;

  it('what is playing: the last row to have started that hasn’t ended', () => {
    expect([playing(0), playing(239), playing(240), playing(299)]).toEqual([0, 0, 240, 240]);
    // The layered record while it lasts, and the one under it before and after: that one plays on.
    expect([playing(300), playing(329), playing(330), playing(399)]).toEqual([300, 300, 240, 240]);
    expect([playing(400), playing(499)]).toEqual([400, 400]);
    // Past where the last track is said to end, nothing is known to be playing.
    expect(playing(500)).toBeNull();
    expect(playingAt([], 10)).toBe(-1);
    // The waveform asks the same of the marks it is given, and marks the one that answers.
    const marks = timeline(rows);
    expect([0, 329, 330, 500].map((time) => marks[playingAt(marks, time)]?.start ?? null)).toEqual([0, 300, 240, null]);
  });

  it('what starts within a moment of a time, either side of it', () => {
    const starting = (time: number) => rows[startingAt(rows, time)]?.start ?? null;
    expect([starting(5), starting(6), starting(395), starting(394)]).toEqual([0, null, 400, null]);
    // Within a moment of two starts, the nearer; as near to both, the earlier.
    const close = sideRows(null, withChanges([id(100, '', ''), id(108, '', '')], []));
    expect([103, 104, 105].map((time) => close[startingAt(close, time)].start)).toEqual([100, 100, 108]);
  });

  it('where a row’s time could be moved: to a moment a track could start at without it, with no other start between', () => {
    const plain = sideRows(null, withChanges([id(0, 'Orbital', 'Chime'), id(300, 'LFO', 'LFO'), id(600, 'Altern 8', 'Infiltrate 202')], []));
    const [first, second, third] = plain;
    const to = (row: Row, times: number[]) => times.map((time) => canMoveTo(plain, row, time, 900));
    // Later or earlier, as far as the tracks either side of it, and no nearer to one of them than a moment.
    expect(to(second, [6, 100, 299, 301, 303, 594])).toEqual([true, true, true, true, true, true]);
    expect(to(second, [300, 5, 595, 650])).toEqual([false, false, false, false]);
    expect(to(first, [3, 294])).toEqual([true, true]);
    expect(to(first, [295, 400])).toEqual([false, false]);
    // Not into the side's last moments, where no track has room to start.
    expect(to(third, [700, 895, 896])).toEqual([true, true, false]);
    // A line still waiting for its time has none to move.
    const listed = sideRows(order, withChanges([id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)')], []));
    expect(canMoveTo(listed, listed[1], 100)).toBe(false);
  });

  it('the timed rows as marks for the waveform', () => {
    expect(timeline(rows).map((x) => `${x.start}-${x.end} ${x.artist}`)).toEqual(['0-240 The Prodigy', '240-400 ', '300-330 LFO', '400-500 Altern 8']);
  });
});

describe('the lines that could be given a moment as their start', () => {
  const at = (o: RunningOrder, ids: Moment[], time: number) => {
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
    expect(couldStartAt(sideRows(null, settle([id(0, 'Orbital', 'Chime')])), 100)).toEqual([]);
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
  const offered = (ids: Moment[], start: number, length: number | null = 2400, most?: number, o = ten) => suggest(sideRows(o, withChanges(ids, [])), start, length, most).map((row) => row.n);

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
    const a = sideRows(null, settle([id(0, 'Orbital', 'Chime', 'Josh'), id(300, 'Joey Beltram', 'Energy Flash', 'Rents'), id(600, 'Altern 8', 'Infiltrate 202', 'Rents')]));
    const b = sideRows({ ...order, by: 'Softboiled' }, settle([id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)', 'Dana')]));
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
  const archive = (tapes as unknown as Tape[]).map((tape) => {
    const before = (all[tape.id] ?? []).map((c) => ({ author: c.author, date: c.date, content: c.content }));
    return { tape, before, read: readSaid(tape, before) };
  });
  const sides = archive.flatMap(({ tape, read }) =>
    tape.sides.map((side, i) => ({
      tape,
      i,
      name: `${tape.id} [${side.position}]`,
      position: tape.sides.length > 1 ? side.position : null,
      order: read.orders[i],
      ids: read.sides[i],
      // The tape can't be anywhere past the side's end, and the reader holds nothing to be there.
      end: (lengths as Record<string, (number | null)[]>)[tape.id]?.[i] ?? Infinity,
    })),
  );
  const startsOf = (rows: Row[]) => rows.flatMap((row) => (row.start === null ? [] : [row.start]));

  it('has its rows in order of time, each track on one row and each line of its list on one row', () => {
    for (const { name, order: o, ids, end } of sides) {
      const tracks = withChanges(ids, [], end);
      const rows = sideRows(o, tracks);
      expect(startsOf(rows), name).toEqual([...startsOf(rows)].sort((a, b) => a - b));
      expect(startsOf(rows), name).toHaveLength(tracks.length);
      expect(rows.filter((row) => row.n !== null), name).toHaveLength(o?.tracks.length ?? 0);
    }
  });

  // What pressing + on each waiting line at a moment would do, worked out the long way: say it, work the side
  // out again, and see whether that line has that moment in the list's order and every other line the time it had. (A line with
  // no name, whose time only stands in for it, is no such line: which unnamed track it has may change.)
  const pressed = (o: RunningOrder, ids: Moment[], changes: Change[], rows: Row[], time: number, end: number) =>
    rows.flatMap((row, k) => {
      if (row.n === null || row.start !== null) return [];
      const change = said(time, row.known ? row.artist : '', row.known ? row.title : '');
      const then = sideRows(o, withChanges(ids, [...changes, change], end));
      const line = (n: number | null) => then.find((r) => r.n === n) as Row;
      const kept = rows.every((was) => was.n === null || was.start === null || was.filled || (line(was.n).start === was.start && Boolean(line(was.n).astray) === Boolean(was.astray)));
      // In the list's order: a line given a time out of it has the time too, but that is no + (rule 2).
      return line(row.n).start === time && line(row.n).mine === change && !line(row.n).astray && kept ? [k] : [];
    });
  // Moments to try on a side: before anything, hard by each start on both sides of it, and at the quarters
  // of each stretch between two tracks and of the ten minutes after the last.
  const moments = (rows: Row[], end: number) => {
    const starts = startsOf(rows);
    return [...new Set([20, ...starts.flatMap((start, k) => [start - 3, start + 3, start + 6, ...[0.25, 0.5, 0.75].map((part) => Math.floor(start + ((starts[k + 1] ?? start + 600) - start) * part))])])].filter((time) => time >= 0 && time < end);
  };

  it('offers a + on exactly the rows that pressing it would give that moment to, and nothing else a new time', () => {
    let offered = 0;
    for (const { name, order: o, ids, end } of sides) {
      if (!o) continue;
      const rows = sideRows(o, withChanges(ids, [], end));
      for (const time of moments(rows, end)) {
        // Within a moment of a start, or in the side's last moments, nothing can start, so nothing is on
        // offer. Anywhere else, what is on offer is what pressing would do.
        const would = canStartAt(rows, time, end) ? pressed(o, ids, [], rows, time, end) : [];
        expect(couldStartAt(rows, time, end), `${name} at ${time}`).toEqual(would);
        offered += would.length;
      }
    }
    // The check is of something: the archive's lists have lines waiting for a time.
    expect(offered).toBeGreaterThan(2000);
  });

  // The reader, for a tape whose comments so far have been read: what it says of a side once one more comment,
  // in the site's own form, is posted. `readSaid` does this from the start each time, and reading a tape's
  // prose is most of that work; here the prose is read once for the tape, which is what lets every side be
  // tried at every moment that matters. Each tape's first answer is checked against `readSaid` itself.
  const NOW = '2026-11-15T12:00:00.000Z';
  const readers = new Map<Tape, (comment: string, side: number) => Moment[]>();
  const readerOf = (tape: Tape) => {
    const made = readers.get(tape);
    if (made) return made;
    const { before } = archive.find((one) => one.tape === tape) as (typeof archive)[number];
    const prose = trusted(digest(before, sideNames(tape.sides)).sightings, tape.sides.length);
    const measured = tape.sides.map((_, side) => (lengths as Record<string, (number | null)[]>)[tape.id]?.[side] ?? Infinity);
    let checked = false;
    const reader = (comment: string, side: number) => {
      const posted = readComposed(comment, tape.sides.map((s) => s.position)) as NonNullable<ReturnType<typeof readComposed>>;
      const exact = posted.map((id): Sighting => ({ ...id, known: Boolean(id.artist || id.title), exact: true, author: 'Dana', date: NOW }));
      const moments = reconcile([...prose, ...exact], measured)[side];
      if (!checked) expect(moments, `${tape.id}: ${comment}`).toEqual(readSaid(tape, [...before, { author: 'Dana', date: NOW, content: comment }]).sides[side]);
      checked = true;
      return moments;
    };
    readers.set(tape, reader);
    return reader;
  };
  const written = (position: string | null, changes: Change[]) =>
    [...changes].sort((a, b) => a.time - b.time).map((c) => (c.gone ? composeRemoval({ position, time: c.time }) : composeId({ position, time: c.time, artist: c.artist, title: c.title, line: c.line }))).join('\n');
  // A side's rows as the page shows them: each one's place in the list, its time and where it ends, and its words.
  const page = (rows: Row[]) => rows.map((r) => `${r.n ?? '-'} ${r.start ?? '-'}-${r.end ?? '-'} ${r.known ? `${r.artist} / ${r.title}` : '??'}${r.astray ? ' (out of the list’s order)' : ''}${r.link ? ' (linked)' : ''}`);

  it('goes on doing so, and keeps its rows in order of time, as a visitor times a side line by line; and posted together, the times read back as they stood', () => {
    let timed = 0;
    for (const { tape, i, name, position, order: o, ids, end } of sides) {
      if (!o) continue;
      // A listen through the side: at each moment, the first line on offer is given it, as a visitor would.
      const changes: Change[] = [];
      let rows = sideRows(o, withChanges(ids, changes, end));
      for (const time of moments(rows, end).sort((a, b) => a - b)) {
        const could = couldStartAt(rows, time, end);
        expect(could, `${name} at ${time} with ${changes.length} said`).toEqual(canStartAt(rows, time, end) ? pressed(o, ids, changes, rows, time, end) : []);
        if (could.length === 0) continue;
        const row = rows[could[0]];
        changes.push(said(time, row.known ? row.artist : '', row.known ? row.title : ''));
        rows = sideRows(o, withChanges(ids, changes, end));
        timed++;
        expect(startsOf(rows), `${name} after ${time}`).toEqual([...startsOf(rows)].sort((a, b) => a - b));
        // Every change is still on a row: none was swallowed by another.
        expect(new Set(rows.map((r) => r.mine)).size - 1, `${name} after ${time}`).toBe(changes.length);
      }
      if (changes.length === 0) continue;
      // The whole sitting goes up as one comment, and the reader makes of it what the page was showing.
      const read = readerOf(tape)(written(position, changes), i);
      expect(page(rows), `${name}: the sitting, posted`).toEqual(page(sideRows(o, withChanges(read, [], end))));
    }
    expect(timed).toBeGreaterThan(300);
  });

  it('shows for a change what the reader says of the side once it is a comment: the same rows, times, ends and names', () => {
    const posted = { sent: { by: 'Dana', read: 1 } };
    const credit = (rows: Row[]) => rows.map((r) => `${r.start ?? '-'} ${r.by ?? '-'}`);
    const tried: Record<string, number> = {};
    for (const { tape, i, name, position, order: o, ids, end } of sides) {
      const rows = sideRows(o, withChanges(ids, [], end));
      if (rows.length === 0) continue;
      const starts = startsOf(rows);
      const last = Number.isFinite(end) ? Math.floor(end) : (starts[starts.length - 1] ?? 0) + 600;
      // Where the rules turn: a moment either side of each start, the reach of a time typed into a sentence
      // either side of it, and the side's last moments. And every two minutes between.
      const times = new Set<number>([...starts.flatMap((start) => [-21, -20, -11, -6, -5, -4, -1, 0, 1, 4, 5, 6, 11, 20, 21].map((off) => start + off)), ...[8, 6, 5, 4, 1, 0].map((left) => last - left)]);
      for (let time = 0; time <= last; time += 120) times.add(time);

      const cases: { what: string; changes: Change[] }[] = [];
      for (const time of [...times].filter((t) => t >= 0 && t <= last)) {
        if (canStartAt(rows, time, end)) {
          // What the page offers there: a point marked, a track named, a line of the list given the time.
          cases.push({ what: 'marked', changes: [said(time)] });
          // And by hand, from a row: any line still waiting, in the list's order or out of it, under the
          // list's name for it or another.
          for (const row of rows.filter((r) => r.n !== null && r.start === null && r.line).slice(0, 3)) {
            cases.push({ what: 'a line timed by hand', changes: [said(time, row.artist, row.title)] });
            cases.push({ what: 'a line timed by hand', changes: [said(time, 'Zzyzx Road', `Quite Unlike Anything ${time}`, { line: row.line })] });
          }
          cases.push({ what: 'named', changes: [said(time, 'Zzyzx Road', `Quite Unlike Anything ${time}`, posted)] });
          for (const k of couldStartAt(rows, time, end).slice(0, 2)) cases.push({ what: 'a line timed', changes: [said(time, rows[k].known ? rows[k].artist : '', rows[k].known ? rows[k].title : '')] });
        } else {
          // What it doesn't offer, but a comment written by hand in the site's form can say.
          cases.push({ what: 'by hand', changes: [said(time, '', '', posted)] });
          cases.push({ what: 'by hand', changes: [said(time, 'Zzyzx Road', `Quite Unlike Anything ${time}`, posted)] });
          cases.push({ what: 'by hand', changes: [said(time, '', '', { gone: true, ...posted })] });
        }
      }
      for (const row of rows) {
        if (row.start === null) continue;
        const gone = said(row.start, '', '', { gone: true, ...posted });
        cases.push({ what: 'removed', changes: [gone] });
        cases.push({ what: 'renamed', changes: [said(row.start, 'Zzyzx Road', 'Quite Unlike Anything', posted)] });
        if (row.line) cases.push({ what: 'a line renamed', changes: [said(row.start, 'Zzyzx Road', 'Quite Unlike Anything', { line: row.line, ...posted })] });
        const rest = rows.filter((r) => r !== row);
        for (const off of [-30, -9, -5, -3, -1, 1, 3, 5, 9, 30]) {
          const to = row.start + off;
          if (to < 0 || !canStartAt(rest, to, end)) continue;
          // In either order: the page keeps the changes of a post in the order of the comment's lines, which is by time.
          const id = said(to, row.known ? row.artist : '', row.known ? row.title : '', posted);
          cases.push({ what: 'moved', changes: [gone, id] }, { what: 'moved', changes: [id, gone] });
        }
      }

      for (const { what, changes } of cases) {
        const comment = written(position, changes);
        const mine = sideRows(o, withChanges(ids, changes, end));
        const theirs = sideRows(o, withChanges(readerOf(tape)(comment, i), [], end));
        expect(page(mine), `${name}: ${comment}`).toEqual(page(theirs));
        // Posted, it is under the name it was posted under, wherever the reader credits it.
        if (changes.every((change) => change.sent)) expect(credit(mine), `${name}: ${comment}`).toEqual(credit(theirs));
        tried[what] = (tried[what] ?? 0) + 1;
      }
    }
    // The check is of something, of every kind.
    for (const what of ['marked', 'named', 'a line timed', 'by hand', 'moved']) expect(tried[what], what).toBeGreaterThan(2000);
    for (const what of ['removed', 'renamed', 'a line timed by hand']) expect(tried[what], what).toBeGreaterThan(400);
    expect(tried['a line renamed']).toBeGreaterThan(50);
  });
});
