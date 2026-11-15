// A side's tracklist as the tape page shows it: one list made of two things. The names in order, from the
// tape's own tracklist or a list kept in the comments, and the times, from the IDs. A tape is done when every
// line has both. Pure functions.
import type { ListedTrack, RunningOrder, TrackId } from './compose';
import { placed } from './names';

export type TracklistRow = {
  /** Its number in the list it comes from. Null for a track that is on the tape only by an ID. */
  n: number | null;
  artist: string;
  title: string;
  /** False for a spot someone marked without a name, and for a line its list has down as unknown. */
  known: boolean;
  /** Where it starts, in seconds, where anyone has said. Null for a name still waiting for its time. */
  start: number | null;
  /** Where the reader has it ending, in seconds, where it has a time from an ID. */
  end: number | null;
  /** Who gave it its time. Null without one. */
  by: string | null;
  /** The record's page on Discogs and its length as printed, where the tape's own tracklist gives them. */
  link?: string;
  duration?: string;
};

/** A time in a list and a time in an ID this close are the same moment, as the reader has it (parse.ts). */
const ROUGHLY = 20;

const fromId = (id: TrackId): TracklistRow => ({ n: null, artist: id.artist, title: id.title, known: id.known, start: id.start, end: id.end, by: id.by });

/**
 * The lines of a side's tracklist, in the order they play. Without a list, the IDs are the tracklist. With
 * one, its lines are, and the IDs give them their times:
 *
 * 1. A line takes the ID that names the same record.
 * 2. A line the list itself times takes the ID at that time, whatever it says. The reader has already weighed
 *    everything said about that moment, and a "??" in the list that someone has since named reads as the name.
 *    A time in a list that the reader made no ID of is not shown: it was past the end of the side, or was
 *    counted from the start of the tape and belongs to another side.
 * 3. A line with no name and no time says only that a track is there. An ID nothing has claimed, between the
 *    same two timed lines, is that track or one like it, and takes its place: the list is no longer when the
 *    keeper's "??" and someone else's ID are the same thing.
 * 4. Any ID still unclaimed (a record the list doesn't have, or has under a name too different to tell) is
 *    not left out. It goes in by its time, after the last line known to start before it.
 */
export function tracklistRows(order: RunningOrder | null, ids: TrackId[]): TracklistRow[] {
  const timed = [...ids].sort((a, b) => a.start - b.start);
  if (!order) return timed.map(fromId);

  const at = placed(order.tracks, timed);
  const taken = new Set(at.values());
  const claim = (line: ListedTrack, id: TrackId) => {
    taken.add(id);
    at.set(line, id);
  };
  for (const line of order.tracks) {
    const said = line.at;
    if (at.has(line) || said === undefined) continue;
    const here = timed.filter((id) => !taken.has(id) && Math.abs(id.start - said) <= ROUGHLY).sort((a, b) => Math.abs(a.start - said) - Math.abs(b.start - said))[0];
    if (here) claim(line, here);
  }
  // Between one timed line and the next, in list order: the IDs left over there, in order of time, stand in
  // for the lines that have neither a name nor a time.
  let from = -Infinity;
  let blanks: ListedTrack[] = [];
  const fill = (until: number) => {
    const spare = timed.filter((id) => !taken.has(id) && id.start > from && id.start < until);
    blanks.slice(0, spare.length).forEach((line, i) => claim(line, spare[i]));
    blanks = [];
  };
  for (const line of order.tracks) {
    const id = at.get(line);
    if (id) {
      fill(id.start);
      from = id.start;
    } else if (!line.known) blanks.push(line);
  }
  fill(Infinity);

  const rows: TracklistRow[] = order.tracks.map((line) => {
    const id = at.get(line);
    const said = id?.known ? id : line;
    return { n: line.n, artist: said.artist, title: said.title, known: said.known, start: id?.start ?? null, end: id?.end ?? null, by: id?.by ?? null, ...(line.link ? { link: line.link } : {}), ...(line.duration ? { duration: line.duration } : {}) };
  });
  for (const id of timed) {
    if (taken.has(id)) continue;
    const after = rows.findLastIndex((row) => row.start !== null && row.start <= id.start);
    rows.splice(after + 1, 0, fromId(id));
  }
  return rows;
}

/** A line is done when it has a name and a time. */
export const isDone = (row: TracklistRow) => row.known && row.start !== null;

/**
 * Everyone the tape's tracklist is owed to, whoever gave the most first: a line's time counts for whoever
 * gave it, and a line's name for whoever kept the list it is from.
 */
export function contributors(sides: { rows: TracklistRow[]; keeper: string | null }[]): string[] {
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
