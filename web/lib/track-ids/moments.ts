// What a side's comments come to, moment by moment, and the tracks that makes.
//
// The reader works a side's moments out from everything the comments say (`reconcile` in parse.ts). The tape
// page adds what a visitor has said since (`withChanges` in side.ts). Both then lay the moments out as tracks
// with the one function here, `settle`, so what the page shows for a change before it is posted is what the
// reader says once it is a comment. Pure, and all the browser needs of the reader.

/**
 * Two times that are one moment of a side: the same second of it. An ID in the site's form is placed to the
 * second, and what is said on the very second a track starts is said of that track: it is that track put
 * right. A second on, it is a track of its own. A tape cut fast has tracks that start a second or two apart,
 * and its tracklist is there to say which came first.
 */
export const sameSecond = (a: number, b: number) => Math.floor(a) === Math.floor(b);

/** Two times typed into sentences are rougher: this many seconds apart or closer, they are said of one moment. */
export const ROUGHLY = 20;

/**
 * How long a track is taken to play, in seconds, where nothing says what came after it: the last anyone timed
 * on a side, or one the side's list shows to have untimed tracks after it (`sideRows` in side.ts). It is very
 * rare for a record in a mix to play ten minutes.
 */
export const LONGEST = 600;

/** The shortest stretch of a side that is a track, in seconds. Nothing starts closer than this to a side's end. */
export const SHORTEST = 1;

/** Of some starts, the one a time is a moment of: the one on that second. Its place among them, or -1. (A null is a line with no time yet.) */
export const momentOf = (starts: (number | null)[], time: number) => starts.findIndex((start) => start !== null && sameSecond(start, time));

/** What the comments say starts at one moment of a side. Times in seconds. */
export type Moment = {
  start: number;
  artist: string;
  title: string;
  /** False where someone marked the spot or asked about it and nobody has named the track. */
  known: boolean;
  /** Who said so. */
  by: string;
  /** When, as the comments date it: of two, the later said sorts after the earlier. */
  date: string;
  /**
   * The line of the tape's tracklist this is, by the list's own words, where the comment that named it says
   * so: the track has another name here than the list gives it (compose.ts).
   */
  line?: { artist: string; title: string };
  /** Where the track ends, where a comment says. */
  until?: number;
  /** A record brought in over the one already playing, which plays on under it. */
  layer?: boolean;
};

/** One identified stretch of a side: a moment, and where the track that starts at it ends. */
export type TrackId = Moment & { end: number };

type Named = { artist: string; title: string };
const words = (s: Named) => new Set(`${s.artist} ${s.title}`.toLowerCase().replace(/\([^)]*\)/g, '').match(/[a-z0-9]{3,}/g) ?? []);

/**
 * Whether two names are one record, as people write them: most of the words of the shorter are in the longer.
 * It wants two words of some length in common, so that "Go" in one comment and "Go" in another prove nothing.
 */
export function sameRecord(a: Named, b: Named) {
  const wa = words(a);
  const wb = words(b);
  const small = wa.size <= wb.size ? wa : wb;
  const big = small === wa ? wb : wa;
  if (small.size < 2) return false;
  // "Brazllia" and "Brazillia" are the same word to a person.
  const close = (w: string) => big.has(w) || (w.length >= 5 && [...big].some((o) => Math.abs(o.length - w.length) <= 1 && o.slice(0, 3) === w.slice(0, 3) && o.slice(-2) === w.slice(-2)));
  let hit = 0;
  small.forEach((w) => close(w) && hit++);
  return hit / small.size >= 0.7;
}

/**
 * The tracks a side's moments make, in order of time. `length` is the side's, in seconds, where it has been
 * measured.
 *
 * · A track runs to where a comment says it ends, and otherwise until the next one starts, however far on
 *   that is: where it is too far, anyone can say so by marking the track that came between. The last on a
 *   side, with nothing after it to say, is taken to play LONGEST, or to the side's end.
 * · A layered record runs to whatever starts next; the record under it plays on to the next that isn't a layer.
 * · A record named again, with nothing else between, is the same play said twice: the earlier start stands.
 *   ("Reach Up To Mars at 30:24", a minute into a track already named that, is no new track.)
 * · Nothing shorter than SHORTEST is a track.
 */
export function settle<M extends Moment>(moments: M[], length = Infinity): (M & { end: number })[] {
  const inOrder = [...moments].sort((a, b) => a.start - b.start);
  const tracks: (M & { end: number })[] = [];
  inOrder.forEach((moment, i) => {
    let next = i + 1;
    if (!moment.layer) while (inOrder[next]?.layer) next++;
    const said = moment.until !== undefined && moment.until > moment.start;
    const end = Math.min(said ? (moment.until as number) : (inOrder[next]?.start ?? moment.start + LONGEST), length);
    const before = tracks[tracks.length - 1];
    if (before && moment.known && sameRecord(before, moment)) before.end = Math.max(before.end, end);
    else if (end - moment.start >= SHORTEST) tracks.push({ ...moment, end });
  });
  return tracks;
}
