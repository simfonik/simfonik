// What is on a side of a tape, as the tape page has it everywhere it shows it: the rows of the tracklist, the
// line under the player, the tray on a phone, the marks on the waveform. One function makes it, `sideRows`,
// from three things:
//
//   the side's list          its tracks in order, from the tape's own tracklist or one kept in the comments
//   the IDs                  what the comments say is on the side, as the reader has it (read.ts)
//   the visitor's changes    what this visitor has said since, which the comments as last read don't have
//
// Everything else here is a question asked of those rows: what is playing, whether a track could start at a
// moment, which lines could be the one that does. Every part of the page asks the same rows, so no two of
// them can disagree about what is on the tape.
//
// The rules the rows keep:
//
// 1. One moment, one track. Two starts are never within ONE_MOMENT of each other. Something said of a moment
//    that is already marked is said of that mark: a name puts it right, and nothing new starts.
// 2. Down a side, times only rise. A line of the list takes an ID's time only where that keeps the list's
//    lines in the list's order; an ID that names a line but would break the order is shown by its time, as a
//    track of its own.
// 3. The visitor's changes are IDs like any other. They go through the same working out as the comments'
//    IDs, so what a change does on the page before it is posted is what it does once it is a comment. (The
//    reader's rules for a time made with the site's form are mirrored in `withChanges`; see `reconcile` in
//    parse.ts.) Where the comments turn out to say otherwise, the next read of them puts the page right.
//
// Pure functions, used in the browser.
import { ONE_MOMENT, type RunningOrder, type TrackId } from './compose';
import { isSameRecord } from './parse';

/** How long a track with no known end is taken to play, as the reader takes it (`reconcile`). */
export const UNENDED = 240;

/** A time in a list and a time in an ID this close are the same moment, as the reader has it. */
const ROUGHLY = 20;

/**
 * When the visitor's own change was said, as a date: after any the comments have, and after the changes the
 * visitor made before it. It is the newest word.
 */
const newest = (nth: number) => `~${String(nth).padStart(6, '0')}`;

/**
 * Something the visitor has said about a side that the comments, as the page last read them, don't have. It
 * is an ID at a moment (a line of the list given its time, a point marked with no name, names typed into the
 * blanks), or with `gone` the taking away of whatever is marked there. It is the data of what will be a
 * line of a comment (compose.ts).
 *
 * Without `sent` it is the visitor's own, kept on this device, waiting to be posted with the rest. With it,
 * it has been posted under that name and stands in for its comment until the page has read the comments
 * again: the read numbered `read` is the first that will have it.
 */
export type Change = {
  side: number;
  /** The moment it is about, in seconds. */
  time: number;
  /** The names, either or both empty. Both empty says only that a track starts here. */
  artist: string;
  title: string;
  gone?: boolean;
  sent?: { by: string; read: number };
};

/** An ID with the visitor's change that made it or last touched it, where one did. */
export type Timed = TrackId & { mine?: Change };

/** A timed track as the waveform marks it: one of a side's rows that has its time. */
export type Mark = Omit<Timed, 'date'>;

/** One row of a side: a line of its list, or a track that is on the side only by an ID. */
export type Row = {
  /** Its number in the list it comes from. Null for a track that is on the side only by an ID. */
  n: number | null;
  artist: string;
  title: string;
  /** False for a spot marked without a name, and for a line its list has down as unknown. */
  known: boolean;
  /** Where it starts and ends, in seconds, where it has a time. Both null for a line still waiting for one. */
  start: number | null;
  end: number | null;
  /** Who gave it its time, by the comments. Null without a time, and for the visitor's own unposted one. */
  by: string | null;
  /** The visitor's change that gave the row its time or its name. */
  mine?: Change;
  /**
   * The row is a line with no name of its own, and its time is that of an ID nothing else claimed, standing
   * in for it (`sideRows`, rule 3). Which such line an ID stands in for can change as other lines are timed.
   */
  filled?: boolean;
  /** The record's page on Discogs and its length as printed, where the tape's own tracklist gives them. */
  link?: string;
  duration?: string;
};

// The reader's test for two names being one record wants two words of some length in common, so that "Go" in
// one comment and "Go" in another prove nothing. A list line and an ID that read the same letter for letter
// are the same record however short: "Moby - Go" is on the tape once "Moby — Go" is.
type Named = { artist: string; title: string };
const spelt = (x: Named) => `${x.artist} ${x.title}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const same = (a: Named, b: Named) => isSameRecord(a, b) || spelt(a) === spelt(b);

const near = (a: number, b: number) => Math.abs(a - b) <= ONE_MOMENT;

/**
 * The side's IDs as they will be once the visitor's changes are comments too, in order of time. The rules
 * are the reader's for a time made with the site's form:
 *
 * · A change at a moment the side has marked is about that mark. A name replaces what was there, and a
 *   name always beats a mark without one. The visitor's own unposted change never replaces a name: it was
 *   made when there was none to replace, and one has turned up since.
 * · A change at a moment of its own is a new track from there.
 * · A mark taken away is gone, and what played before it plays on.
 * · A record named again, with nothing else between, is the same play said twice: the earlier start stands.
 *
 * Each ID runs until the next one starts.
 */
export function withChanges(posted: TrackId[], changes: Change[]): Timed[] {
  const ids: Timed[] = posted.map((id) => ({ ...id }));
  changes.forEach((change, nth) => {
    const at = ids.reduce((best, id, k) => (near(id.start, change.time) && (best < 0 || Math.abs(id.start - change.time) < Math.abs(ids[best].start - change.time)) ? k : best), -1);
    if (change.gone) {
      if (at < 0) return;
      // What played up to the mark now plays on: its end was only ever where the mark began.
      const [gone] = ids.splice(at, 1);
      const before = ids.findLast((id) => id.start < gone.start);
      if (before && before.end === gone.start) before.end = before.start + UNENDED;
      return;
    }
    const known = Boolean(change.artist || change.title);
    const said = { artist: change.artist, title: change.title, known, by: change.sent?.by ?? '', date: newest(nth), mine: change };
    if (at < 0) ids.push({ start: change.time, end: change.time + UNENDED, ...said });
    else if (change.sent ? known || !ids[at].known : known && !ids[at].known) ids[at] = { ...ids[at], start: Math.min(ids[at].start, change.time), ...said };
  });
  ids.sort((a, b) => a.start - b.start);

  const out: Timed[] = [];
  ids.forEach((id, k) => {
    const next = ids[k + 1];
    const one = next && next.start < id.end ? { ...id, end: next.start } : id;
    const before = out[out.length - 1];
    if (before && one.known && isSameRecord(before, one)) before.end = Math.max(before.end, one.end);
    else out.push(one);
  });
  return out;
}

/**
 * Which ID gives each line of the list its time, by the line's place in the list, and whether by the line's
 * name.
 *
 * A line takes an ID that names the same record, or, where the list itself times the line, the ID at that
 * time. Where that leaves a choice, or would put the list's lines out of order, the lines keep as many of
 * those times as can stand together in the list's order. Of two ways to keep as many, the one that keeps what
 * was said earlier: a new ID that can't fit the order never unseats one that was there before it. So one
 * mistimed ID can't unseat the rest, a record on the list twice has its two plays in order, and an ID that
 * names a line it can't belong to is left for `sideRows` to show by its time.
 */
function placed(lines: RunningOrder['tracks'], ids: Timed[]): Map<number, { id: Timed; byName: boolean }> {
  const points = lines.flatMap((line, i) => {
    const named = line.known ? ids.filter((id) => id.known && same(id, line)) : [];
    const said = line.at;
    // Of a line's own, the ID that names it comes before the one at its time, and the nearer to that time first.
    const timed = said === undefined ? [] : ids.filter((id) => !named.includes(id) && Math.abs(id.start - said) <= ROUGHLY).sort((a, b) => Math.abs(a.start - said) - Math.abs(b.start - said));
    return [...named.map((id) => ({ i, id, byName: true })), ...timed.map((id) => ({ i, id, byName: false }))];
  });
  // The run of them that rises in both the list and time and is worth the most, where each point is worth
  // one and a little more the earlier it was said: all of that little together is less than one, so it only
  // ever chooses between runs of the same length. `worth[p]` is that of the best run ending at point p, and
  // `from[p]` the point before p in it. Points come in list order; of two runs worth the same, the first.
  const dates = [...new Set(points.map((p) => p.id.date))].sort();
  const little = (date: string) => (dates.length - dates.indexOf(date)) / ((dates.length + 1) * (points.length + 1));
  const worth: number[] = [];
  const from: number[] = [];
  points.forEach((p, k) => {
    let best = 0;
    from[k] = -1;
    for (let q = 0; q < k; q++) {
      if (points[q].i < p.i && points[q].id.start < p.id.start && worth[q] > best) {
        best = worth[q];
        from[k] = q;
      }
    }
    worth[k] = best + 1 + little(p.id.date);
  });
  const at = new Map<number, { id: Timed; byName: boolean }>();
  for (let k = worth.indexOf(Math.max(...worth)); k >= 0; k = from[k]) at.set(points[k].i, points[k]);
  return at;
}

/**
 * The rows of a side, in the order they play. Without a list the IDs are the rows. With one, its lines are,
 * and the IDs give them their times:
 *
 * 1. A line takes the ID that names the same record. On the tape's own tracklist the row keeps the line's
 *    words, which are the tape's. On a list from the comments it reads as the ID does: that is the comments'
 *    latest word for the track, and often the fuller one.
 * 2. A line the list itself times takes the ID at that time, whatever it says. The reader has already weighed
 *    everything said of that moment, and a "??" in the list that someone has since named reads as the name.
 *    A time in a list that the reader made no ID of is not shown: it was past the end of the side, or was
 *    counted from the start of the tape and belongs to another side.
 *
 *    Both are held to the list's order (`placed`).
 * 3. A line with no name and no time says only that a track is there. An ID nothing has claimed, between the
 *    same two timed lines, is that track or one like it and stands in for it, the earliest such line first.
 *    Not an ID that names another line of the list: that is a track the list has, said at a time the list's
 *    order can't take.
 * 4. Any ID still unclaimed (a record the list doesn't have, or has under a name too different to tell, or
 *    out of its order) is not left out. It is a row of its own, after the last row to start before it.
 *
 * Down the rows, times only rise.
 */
export function sideRows(order: RunningOrder | null, ids: Timed[]): Row[] {
  const loose = (id: Timed): Row => ({ n: null, artist: id.artist, title: id.title, known: id.known, start: id.start, end: id.end, by: id.by || null, ...(id.mine ? { mine: id.mine } : {}) });
  if (!order) return ids.map(loose);

  const lines = order.tracks;
  const firm = placed(lines, ids);
  const taken = new Set([...firm.values()].map((point) => point.id));
  const listed = (id: Timed) => id.known && lines.some((line) => line.known && same(id, line));
  // Between one timed line and the next, the IDs left over there stand in, in order of time, for the lines
  // with neither a name nor a time.
  const filled = new Map<number, Timed>();
  let after = -Infinity;
  let blanks: number[] = [];
  const fill = (until: number) => {
    const spare = ids.filter((id) => !taken.has(id) && !listed(id) && id.start > after && id.start < until);
    blanks.slice(0, spare.length).forEach((i, k) => {
      filled.set(i, spare[k]);
      taken.add(spare[k]);
    });
    blanks = [];
  };
  lines.forEach((line, i) => {
    const id = firm.get(i)?.id;
    if (id) {
      fill(id.start);
      after = id.start;
    } else if (!line.known) blanks.push(i);
  });
  fill(Infinity);

  const rows = lines.map((line, i): Row => {
    const id = firm.get(i)?.id ?? filled.get(i);
    const said = id?.known && !(order.by === null && firm.get(i)?.byName) ? id : line;
    return {
      n: line.n,
      artist: said.artist,
      title: said.title,
      known: said.known,
      start: id?.start ?? null,
      end: id?.end ?? null,
      by: id?.by || null,
      ...(id?.mine ? { mine: id.mine } : {}),
      ...(filled.has(i) ? { filled: true } : {}),
      ...(line.link ? { link: line.link } : {}),
      ...(line.duration ? { duration: line.duration } : {}),
    };
  });
  for (const id of ids) {
    if (taken.has(id)) continue;
    rows.splice(rows.findLastIndex((row) => row.start !== null && row.start <= id.start) + 1, 0, loose(id));
  }
  return rows;
}

/**
 * Of a visitor's changes to a side, those that still change something: the posted ones, which stand until
 * the comments have been read again, and the unposted ones that some row shows. An unposted change that
 * shows nowhere has been overtaken: since it was made, the comments have come to say the same of that
 * moment, or something else.
 */
export function standing(order: RunningOrder | null, posted: TrackId[], changes: Change[]): Change[] {
  const shown = new Set(sideRows(order, withChanges(posted, changes)).map((row) => row.mine));
  return changes.filter((change) => change.sent || shown.has(change));
}

/** The row playing at a moment, by its place in `rows`, or -1: the last to start, if it hasn't ended. */
export function playingAt(rows: Row[], time: number): number {
  const k = rows.findLastIndex((row) => row.start !== null && row.start <= time);
  return k >= 0 && time < (rows[k].end as number) ? k : -1;
}

/** The row that starts within a moment of a time, by its place in `rows`, or -1. Nothing else can start there. */
export const startingAt = (rows: Row[], time: number) => rows.findIndex((row) => row.start !== null && near(row.start, time));

// The answer changes only when the moment passes a row's start or comes within a moment of one, and it is
// asked for every time the tape moves on, so it is kept for as long as the rows are the same rows.
const could = new WeakMap<Row[], Map<string, number[]>>();

/**
 * Which lines of the list could be given a moment as their start, by their places in `rows`: the lines for
 * which giving them that moment is what would happen (`sideRows`). It is why a + on a row never does
 * anything but give that row its time.
 *
 * None, if something starts within a moment of it already. Otherwise the lines with no time that the moment
 * falls among, between the last line timed before it and the first timed after (a line whose time is only
 * standing in for it, `filled`, is no such bound: it gives way to a line that is timed in its own right),
 * less these:
 *
 * · A line with no name, unless it is the first of them there and the moment is later than every time
 *   standing in for one. One such line is as good as another, and unnamed tracks go to them in order.
 * · A line naming the same record as an earlier line among them, which would take the time in its stead.
 * · A line naming the record that is playing just before the moment, or the one that starts next: said
 *   there, it would be that same play said again.
 */
export function couldStartAt(rows: Row[], time: number): number[] {
  const last = rows.findLastIndex((row) => row.start !== null && row.start < time);
  const free = startingAt(rows, time) < 0;
  const key = `${last}|${free}`;
  const known = could.get(rows)?.get(key);
  if (known) return known;

  const out: number[] = [];
  if (free) {
    const lines = rows.map((row, k) => ({ row, k })).filter(({ row }) => row.n !== null);
    const bound = (row: Row) => row.start !== null && !row.filled;
    const from = lines.findLastIndex(({ row }) => bound(row) && (row.start as number) < time) + 1;
    const until = lines.findIndex(({ row }, i) => i >= from && bound(row));
    const among = lines.slice(from, until < 0 ? lines.length : until);
    const before = rows[last];
    const next = rows.find((row) => row.start !== null && row.start > time);
    let unnamed = among.some(({ row }) => row.filled && (row.start as number) > time);
    among.forEach(({ row, k }, i) => {
      if (row.start !== null) return;
      if (!row.known) {
        if (!unnamed) out.push(k);
        unnamed = true;
      } else if (!(before && isSameRecord(before, row)) && !(next?.known && isSameRecord(row, next)) && !among.slice(0, i).some((earlier) => earlier.row.start === null && earlier.row.known && same(earlier.row, row))) out.push(k);
    });
  }
  could.set(rows, (could.get(rows) ?? new Map()).set(key, out));
  return out;
}

/**
 * For a moment of a side, the lines of its list that could be the track there, for offering in place of
 * typing: `most` of them at the most, in list order. They are the named lines that could start there
 * (`couldStartAt`, with whatever is marked at the moment set aside: it is what is being named), nearest
 * first to where the moment falls in the list. That is worked out from the timed lines either side of it,
 * or the side's two ends, taking the tracks between to be of even length; where the side's length isn't
 * known, each track timed before the moment is one gone by.
 *
 * None where the moment is a line the list itself times and has down as unknown: its keeper has every other
 * line as some other track. None of a line with half a name ("1) intro"): that is no ID to offer.
 */
export function suggest(rows: Row[], start: number, length: number | null, most = 2): Row[] {
  const marked = rows[startingAt(rows, start)];
  if (marked && marked.n !== null && !marked.known && !marked.filled) return [];
  const open = rows.flatMap((row): Row[] => (row !== marked ? [row] : row.n === null ? [] : [{ ...row, start: null, end: null, filled: false }]));
  const lines = open.filter((row) => row.n !== null);

  const marks = lines.flatMap((row, i) => (row.start === null ? [] : [{ time: row.start, i }]));
  const before = [{ time: 0, i: 0 }, ...marks].findLast((m) => m.time <= start) as { time: number; i: number };
  const after = [...marks, ...(length ? [{ time: length, i: lines.length }] : [])].find((m) => m.time > start);
  const expected = after ? before.i + ((start - before.time) / (after.time - before.time)) * (after.i - before.i) : open.filter((row) => row.start !== null && row.start < start).length;

  return couldStartAt(open, start)
    .map((k) => open[k])
    .filter((row) => row.known && row.artist && row.title)
    .map((row) => ({ row, far: Math.abs(lines.indexOf(row) - expected) }))
    .sort((a, b) => a.far - b.far)
    .slice(0, most)
    .map(({ row }) => row)
    .sort((a, b) => (a.n as number) - (b.n as number));
}

/** The visitor's own, waiting to be posted. */
export const isUnposted = (x: { mine?: Change }) => Boolean(x.mine && !x.mine.sent);

/** Whose word a mark is, said the same way wherever it is said: "ID by Rents", or that it is the visitor's own. */
export const saidBy = (x: { known: boolean; by: string | null; mine?: Change }) => (isUnposted(x) ? 'Yours, not posted yet' : `${x.known ? 'ID' : 'Marked'} by ${x.by}`);

/** The side's timed rows as IDs in order of time, for the marks on the waveform. */
export const timeline = (rows: Row[]): Mark[] =>
  rows.flatMap((row) => (row.start === null ? [] : [{ start: row.start, end: row.end as number, artist: row.artist, title: row.title, known: row.known, by: row.by ?? '', ...(row.mine ? { mine: row.mine } : {}) }]));

/**
 * Everyone the tape's tracklist is owed to, whoever gave the most first: a line's time counts for whoever
 * gave it, and a line's name for whoever kept the list it is from.
 */
export function contributors(sides: { rows: Row[]; keeper: string | null }[]): string[] {
  const count = new Map<string, number>();
  const credit = (name: string) => count.set(name, (count.get(name) ?? 0) + 1);
  for (const { rows, keeper } of sides) {
    for (const row of rows) {
      if (row.by) credit(row.by);
      if (keeper && keeper !== row.by && row.n !== null && row.known) credit(keeper);
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
}
