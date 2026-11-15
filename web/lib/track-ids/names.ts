// Names in order without times: the tape's own tracklist, or a list someone kept in the comments. This works
// out which of those names could belong to a moment of the tape that nobody has ID'd, so the tape page can
// offer them and save the typing. Pure functions.
import type { ListedTrack, TrackId } from './compose';
import { isSameRecord } from './parse';

// The parser's test for two names being one record wants two words of some length in common, so that "Go" in
// one comment and "Go" in another prove nothing. A list line and an ID that read the same letter for letter
// are the same record however short: "Moby - Go" is on the tape once "Moby — Go" is.
const spelt = (x: { artist: string; title: string }) => `${x.artist} ${x.title}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const same = (id: TrackId, line: ListedTrack) => isSameRecord(id, line) || spelt(id) === spelt(line);

/**
 * Which timed ID on the side carries each listed line. A record played twice is listed twice, and the first
 * listing is the earlier track: each ID answers for one line of the list.
 */
export function placed(order: ListedTrack[], ids: TrackId[]): Map<ListedTrack, TrackId> {
  const named = ids.filter((id) => id.known).sort((a, b) => a.start - b.start);
  const taken = new Set<TrackId>();
  const at = new Map<ListedTrack, TrackId>();
  for (const line of order) {
    const id = line.known ? named.find((x) => !taken.has(x) && same(x, line)) : undefined;
    if (!id) continue;
    taken.add(id);
    at.set(line, id);
  }
  return at;
}

/**
 * For a moment of a side that nobody has ID'd, the listed names that could be the track playing there: `most`
 * of them at the most, in list order.
 *
 * A line with no time still has a place: after the last line before it whose time is known, and before the
 * next one. A line whose place takes in this moment is likelier than one whose place does not. Among those,
 * the likeliest are the lines nearest to where the moment falls in the list, taking the tracks between two
 * known times (or the side's two ends) to be of even length. Where the side's length isn't known, the count
 * of IDs before the moment stands in: each is one track gone by.
 *
 * A moment the list itself has down as unknown gets none: its keeper has every other line as some other track.
 */
export function suggest(start: number, order: ListedTrack[], ids: TrackId[], length: number | null, most = 2): ListedTrack[] {
  if (order.some((line) => !line.known && line.at !== undefined && Math.abs(line.at - start) <= 20)) return [];
  const at = placed(order, ids);
  const when = (line: ListedTrack) => at.get(line)?.start ?? line.at;

  // Where in the list the moment falls: between the lines whose times are known, by time.
  const marks = order.flatMap((line, i) => (when(line) === undefined ? [] : [{ time: when(line) as number, i }]));
  const before = [{ time: 0, i: 0 }, ...marks].filter((m) => m.time <= start).sort((a, b) => b.time - a.time || b.i - a.i)[0];
  const after = [...marks, ...(length ? [{ time: length, i: order.length }] : [])].filter((m) => m.time > start).sort((a, b) => a.time - b.time || a.i - b.i)[0];
  const expected = after ? before.i + ((start - before.time) / (after.time - before.time)) * (after.i - before.i) : ids.filter((id) => id.start < start).length;

  const ranked = order
    .map((line, i) => ({ line, i }))
    // A line with half a name ("1) intro") is no ID to offer.
    .filter(({ line }) => line.known && line.artist && line.title && !at.has(line))
    .map(({ line, i }) => {
      const lo = order.slice(0, i).map(when).findLast((t) => t !== undefined) ?? -Infinity;
      const hi = order.slice(i + 1).map(when).find((t) => t !== undefined) ?? Infinity;
      return { line, out: start < lo ? lo - start : start > hi ? start - hi : 0, far: Math.abs(i - expected) };
    })
    .sort((a, b) => a.out - b.out || a.far - b.far);
  return ranked
    .slice(0, most)
    .map((x) => x.line)
    .sort((a, b) => a.n - b.n);
}
