// What is on a side of a tape, as the tape page has it everywhere it shows it: the rows of the tracklist, the
// line under the player, the tray on a phone, the marks on the waveform. One function makes it, `sideRows`,
// from three things:
//
//   the side's list          its tracks in order, from the tape's own tracklist or one kept in the comments
//   the side's moments       what the comments say starts where on the side, as the reader has it (said.ts)
//   the visitor's changes    what this visitor has said since, which the comments as last read don't have
//
// Everything else here is a question asked of those rows: what is playing, whether a track could start at a
// moment, which lines could be the one that does. Every part of the page asks the same rows, so no two of
// them can disagree about what is on the tape.
//
// The rules the rows keep:
//
// 1. One moment, one track. Something said within ONE_MOMENT of where a track starts is said of that track:
//    a name puts it right, and nothing new starts. The page offers a new track only further off than that.
// 2. Down a side, times only rise. A line of the list takes an ID's time only where that keeps the list's
//    lines in the list's order; an ID that names a line but would break the order is shown by its time,
//    out of the list's order, and is that line all the same: the line is not shown again without a time.
// 3. The visitor's changes are IDs like any other. `withChanges` takes each as the reader takes a comment in
//    the site's form, and the side's tracks are then made by the function the reader's are (`settle` in
//    moments.ts). So what a change does on the page before it is posted is what it does once it is a
//    comment. Where the comments turn out to say otherwise, the next read of them puts the page right.
//
// Pure functions, used in the browser.
import { composeId, composeRemoval, splitComposed, type Composed, type ListedTrack, type Named, type RunningOrder } from './compose';
import { LONGEST, ROUGHLY, SHORTEST, momentOf, sameRecord, settle, type Moment, type TrackId } from './moments';

/**
 * When the visitor's own change was said, as a date: after any the comments have. What was posted together
 * was said together, as the lines of one comment are, each post after the one before; what waits to be
 * posted is the newest word of all.
 */
const saidWhen = (change: Change) => (change.sent ? `~${String(change.sent.read).padStart(6, '0')}` : '~~');

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
  /** The line of the side's list it is, by the list's own words, where its names are not the list's (compose.ts). */
  line?: Named;
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
  /** The list's own words for the row, where it is a line the list names: what an ID that renames it says it was. */
  line?: Named;
  /**
   * The row is a line of the list whose ID puts it out of the list's order: it is shown by its time, among
   * the rows as an ID of its own would be, and is not one of the lines the list's order goes by (rule 2).
   */
  astray?: boolean;
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
const spelt = (x: Named) => `${x.artist} ${x.title}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const same = (a: Named, b: Named) => sameRecord(a, b) || spelt(a) === spelt(b);

/** Whether a name is the list's own for a line, word for word: if not, an ID of the line has to say which line it is. */
export const asListed = (name: Named, line: Named) => spelt(name) === spelt(line);

/** Whether an ID is a line of the list: it names the same record, or says it is that line under another name. */
const names = (id: Timed, line: ListedTrack) => line.known && id.known && (same(id, line) || (id.line !== undefined && same(id.line, line)));

/**
 * The side's tracks as they will be once the visitor's changes are comments too, in order of time: what the
 * comments say of the side's moments, then each change in the order it was made, taken as the reader takes
 * a comment in the site's form (`reconcile` in parse.ts), and the whole laid out as tracks (`settle`).
 * `length` is the side's, in seconds, where it has been measured.
 *
 * · A change is read as its line of a comment will be: its time to the second, its names as written there.
 * · A change at a moment the side has marked is about that mark. A name replaces what was there, and a name
 *   always beats a mark without one. The visitor's own unposted change never replaces a name a track is
 *   shown under: it was made when there was none to replace, and one has turned up since.
 * · A change further off is a new track from there.
 * · A mark taken away is gone, with everything said of it before. What is said of it in the same post
 *   stands, as the reader has it: so of changes said together, what they take away is taken away first, and
 *   a track moved by a few seconds isn't taken away with the ID that moved it.
 */
export function withChanges(said: Moment[], changes: Change[], length = Infinity): Timed[] {
  const moments: (Moment & { mine?: Change })[] = [...said];
  const inOrder: Change[] = [];
  for (let from = 0; from < changes.length; ) {
    let to = from + 1;
    while (to < changes.length && saidWhen(changes[to]) === saidWhen(changes[from])) to++;
    const together = changes.slice(from, to);
    inOrder.push(...together.filter((change) => change.gone), ...together.filter((change) => !change.gone));
    from = to;
  }
  for (const change of inOrder) {
    const where = { position: null, time: change.time };
    // A line the site writes always reads back (compose.test.ts holds it to that on every tape).
    const line = splitComposed(change.gone ? composeRemoval(where) : composeId({ ...where, artist: change.artist, title: change.title, line: change.line })) as Composed;
    // Nothing is said of a side past its end.
    if (line.time >= length) continue;
    const at = momentOf(moments.map((moment) => moment.start), line.time);
    if (line.gone) {
      if (at >= 0) moments.splice(at, 1);
      continue;
    }
    const known = Boolean(line.artist || line.title);
    const word = { artist: line.artist, title: line.title, known, by: change.sent?.by ?? '', date: saidWhen(change), mine: change, ...(line.line ? { line: line.line } : {}) };
    if (at < 0) {
      moments.push({ start: line.time, ...word });
      continue;
    }
    // (Which line of the list a moment is goes with its name: a new name without one is no longer that line.)
    const { guessed, line: wasLine, ...was } = moments[at];
    // The visitor's own unposted name gives way to a name the moment already has, unless that name is one no
    // track on the side shows: the same record said again a little on, which is taken as one play with the
    // one before (`settle`). The page offered the moment as free, and posted, the name will be the moment's.
    const wins = change.sent ? known || !was.known : known && (!was.known || !settle(moments, length).some((track) => track.start === was.start));
    // What is posted is said of the moment whether or not it is the moment's last word, and a moment starts
    // at the earliest time anyone gave for it. An unposted change that changes nothing isn't there at all.
    if (wins || change.sent) moments[at] = { ...was, start: guessed ? line.time : Math.min(was.start, line.time), ...(wins ? word : wasLine ? { line: wasLine } : {}) };
  }
  return settle(moments, length);
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
    const named = ids.filter((id) => names(id, line));
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
 * 1. A line takes the ID that names the same record, or that says it is that line under another name. On the
 *    tape's own tracklist the row keeps the line's words, which are the tape's, unless the ID says it is the
 *    line renamed: then it reads as the ID does (and keeps the list's link to the record only if the new
 *    name is still that record's). On a list from the comments it reads as the ID does: that is the
 *    comments' latest word for the track, and often the fuller one.
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
 * 4. Any ID still unclaimed is not left out. It is a row by its time, after the last row to start before
 *    it. If it names a line that nothing else has claimed (it was said out of the list's order), it is that
 *    line, shown there and not again in the line's own place: one track, one row. Otherwise (a record the
 *    list doesn't have, or has under a name too different to tell) it is a row of its own.
 * 5. A track runs until the next one starts (`settle`). But where the list has lines with no time between
 *    it and the next, the list itself says other tracks played there, and nobody has said when: the track
 *    is then taken to play no longer than LONGEST, unless a comment says where it ends.
 *
 * Down the rows, times only rise.
 */
export function sideRows(order: RunningOrder | null, ids: Timed[]): Row[] {
  const loose = (id: Timed): Row => ({ n: null, artist: id.artist, title: id.title, known: id.known, start: id.start, end: id.end, by: id.by || null, ...(id.mine ? { mine: id.mine } : {}) });
  if (!order) return ids.map(loose);

  const lines = order.tracks;
  const firm = placed(lines, ids);
  const taken = new Set([...firm.values()].map((point) => point.id));
  const listed = (id: Timed) => lines.some((line) => names(id, line));
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
  // An ID left over that names a line nothing has claimed is that line, out of the list's order.
  const astray = new Map<Timed, number>();
  for (const id of ids) {
    if (taken.has(id)) continue;
    const claimed = new Set(astray.values());
    const i = lines.findIndex((line, k) => !firm.has(k) && !claimed.has(k) && names(id, line));
    if (i >= 0) astray.set(id, i);
  }

  // A line as a row, with the ID that gives it its time where one does. `byName`: the ID is the line's by
  // naming the same record, not by the time the list gives the line.
  const lineRow = (line: ListedTrack, id: Timed | undefined, byName: boolean): Row => {
    const said = id?.known && (id.line !== undefined || !(order.by === null && byName)) ? id : line;
    const record = !id?.line || same(id, line);
    return {
      n: line.n,
      artist: said.artist,
      title: said.title,
      known: said.known,
      start: id?.start ?? null,
      end: id?.end ?? null,
      by: id?.by || null,
      ...(id?.mine ? { mine: id.mine } : {}),
      ...(line.known ? { line: { artist: line.artist, title: line.title } } : {}),
      ...(line.link && record ? { link: line.link } : {}),
      ...(line.duration && record ? { duration: line.duration } : {}),
    };
  };
  const elsewhere = new Set(astray.values());
  const rows = lines.flatMap((line, i): Row[] => {
    if (elsewhere.has(i)) return [];
    const row = lineRow(line, firm.get(i)?.id ?? filled.get(i), Boolean(firm.get(i)?.byName));
    return [filled.has(i) ? { ...row, filled: true } : row];
  });
  for (const id of ids) {
    if (taken.has(id)) continue;
    const i = astray.get(id);
    rows.splice(rows.findLastIndex((row) => row.start !== null && row.start <= id.start) + 1, 0, i === undefined ? loose(id) : { ...lineRow(lines[i], id, true), astray: true });
  }
  const stated = new Set(ids.filter((id) => id.until !== undefined).map((id) => id.start));
  rows.forEach((row, k) => {
    if (row.start === null || row.end === null || stated.has(row.start)) return;
    const next = rows.findIndex((later, j) => j > k && later.start !== null);
    if (next > k + 1) row.end = Math.min(row.end, row.start + LONGEST);
  });
  return rows;
}

/**
 * Of a visitor's changes to a side, those that still change something: the posted ones, which stand until
 * the comments have been read again, and the unposted ones that some row shows. An unposted change that
 * shows nowhere has been overtaken: since it was made, the comments have come to say the same of that
 * moment, or something else.
 */
export function standing(order: RunningOrder | null, said: Moment[], changes: Change[], length = Infinity): Change[] {
  const shown = new Set(sideRows(order, withChanges(said, changes, length)).map((row) => row.mine));
  return changes.filter((change) => change.sent || shown.has(change));
}

/**
 * What is playing at a time, of a side's rows or of its marks, by its place among them, or -1: the last to
 * have started that hasn't ended. (Under a record layered over it, the one before plays on, and is what is
 * playing again when the layer ends.)
 */
export const playingAt = (tracks: { start: number | null; end: number | null }[], time: number) =>
  tracks.findLastIndex((track) => track.start !== null && track.start <= time && time < (track.end as number));

/** The row a time is a moment of, by its place in `rows`, or -1: its track starts there, and nothing else can. */
export const startingAt = (rows: Row[], time: number) => momentOf(rows.map((row) => row.start), time);

/**
 * Whether a track could start at a moment of a side: nothing starts within a moment of it already, and the
 * side has room left for a track. `length` is the side's, in seconds, where it has been measured.
 */
export const canStartAt = (rows: Row[], time: number, length = Infinity) => startingAt(rows, time) < 0 && time <= length - SHORTEST;

/**
 * Whether a row's time could be moved to another moment of its side: a track could start there with this
 * one set aside, and nothing else starts between the two, so the track keeps its place among the rest.
 */
export function canMoveTo(rows: Row[], row: Row, time: number, length = Infinity): boolean {
  if (row.start === null || row.start === time) return false;
  const [from, to] = time < row.start ? [time, row.start] : [row.start, time];
  const others = rows.filter((other) => other !== row);
  return canStartAt(others, time, length) && !others.some((other) => other.start !== null && other.start > from && other.start < to);
}

// The answer changes only when the moment passes a row's start or comes within a moment of one, and it is
// asked for every time the tape moves on, so it is kept for as long as the rows are the same rows.
const could = new WeakMap<Row[], Map<string, number[]>>();

/**
 * Which lines of the list could be given a moment as their start, by their places in `rows`: the lines for
 * which giving them that moment is what would happen (`sideRows`). It is why a + on a row never does
 * anything but give that row its time.
 *
 * None, if something starts within a moment of it already, or it is in the side's last moments (`length` is
 * the side's, where it has been measured). Otherwise the lines with no time that the moment
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
export function couldStartAt(rows: Row[], time: number, length = Infinity): number[] {
  const last = rows.findLastIndex((row) => row.start !== null && row.start < time);
  const free = canStartAt(rows, time, length);
  const key = `${last}|${free}`;
  const known = could.get(rows)?.get(key);
  if (known) return known;

  const out: number[] = [];
  if (free) {
    const lines = rows.map((row, k) => ({ row, k })).filter(({ row }) => row.n !== null && !row.astray);
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
      } else if (!(before && sameRecord(before, row)) && !(next?.known && sameRecord(row, next)) && !among.slice(0, i).some((earlier) => earlier.row.start === null && earlier.row.known && same(earlier.row, row))) out.push(k);
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
  const lines = open.filter((row) => row.n !== null && !row.astray);

  const marks = lines.flatMap((row, i) => (row.start === null ? [] : [{ time: row.start, i }]));
  const before = [{ time: 0, i: 0 }, ...marks].findLast((m) => m.time <= start) as { time: number; i: number };
  const after = [...marks, ...(length ? [{ time: length, i: lines.length }] : [])].find((m) => m.time > start);
  const expected = after ? before.i + ((start - before.time) / (after.time - before.time)) * (after.i - before.i) : open.filter((row) => row.start !== null && row.start < start).length;

  // (Not held to the side's end: the moment is one something is already being said of.)
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
