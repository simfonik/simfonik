// The track IDs the comments give for a tape, gathered for the tape page's player. Server only.
import sideLengths from '../../data/side-lengths.json';
import type { Tape } from '../../types/tape';
import { getTapeComments } from '../comments';
import { getCommentsForTape } from '../data';
import { readComposed, type RunningOrder, type TrackId } from './compose';
import { digest, reconcile, runningOrders, sideNames, trusted, type Said, type Sighting } from './parse';

/**
 * One list of IDs per side, in the order the tape has its sides, each in order of time.
 *
 * Everything anyone has said about the tape is read: the 2008–2023 archive, then the comments posted through
 * the site since, oldest first, because a later comment corrects an earlier one. A comment in the site's own
 * form (`[B 12:34] Moby - Go`, see compose.ts) is taken exactly as written; the rest are read as prose,
 * and what they don't place on a side is used only where the tape leaves no doubt (see `trusted`).
 *
 * `orders` is, for each side, its tracks in the order they play where a list gives them with few or no
 * times: the tape's own tracklist, or failing that the fullest list kept in the comments. A list in the
 * comments is only used on a tape with one or two sides. On a set of several DJs' tapes "Side 1" in a comment
 * is the first side of whichever cassette its writer had, and there is no telling which that was.
 *
 * `complete` is false when the newer comments couldn't be fetched. The archive still reads, so the IDs given
 * are real, but nobody should conclude from them that there are no others.
 */
export async function readTrackIds(tape: Tape): Promise<{ sides: TrackId[][]; orders: (RunningOrder | null)[]; complete: boolean }> {
  const said: Said[] = getCommentsForTape(tape.id).map((c) => ({ author: c.author, date: c.date, content: c.content }));
  let complete = true;
  try {
    for (const c of await getTapeComments(tape.id)) {
      said.push({ author: c.author_name, date: new Date(c.created_at).toISOString(), content: c.content });
    }
  } catch (error) {
    console.error('Track IDs: the newer comments could not be read:', error);
    complete = false;
  }

  const positions = tape.sides.map((s) => s.position);
  const exact: Sighting[] = [];
  const prose: Said[] = [];
  for (const c of said) {
    const id = readComposed(c.content, positions);
    if (id) exact.push({ ...id, known: Boolean(id.artist || id.title), author: c.author, date: c.date });
    else prose.push(c);
  }
  const { sightings, listed } = digest(prose, sideNames(tape.sides));
  const read = trusted(sightings, tape.sides.length);
  const kept = tape.sides.length <= 2 ? runningOrders(listed, tape.sides.length) : [];

  // A side whose length was never measured has no end to hold its IDs to.
  const measured = (sideLengths as Record<string, (number | null)[]>)[tape.id];
  const lengths = tape.sides.map((_, side) => measured?.[side] ?? Infinity);
  const proposals = reconcile([...read, ...exact], lengths);

  return {
    complete,
    orders: tape.sides.map((side, i): RunningOrder | null => {
      if (side.tracks?.length) return { by: null, tracks: side.tracks.map((t, k) => ({ n: k + 1, artist: t.artist, title: t.title, known: true })) };
      const list = kept[i] ?? [];
      return list.length ? { by: list[0].author, tracks: list.map(({ n, artist, title, known, at }) => ({ n, artist, title, known, at })) } : null;
    }),
    sides: tape.sides.map((_, side) =>
      proposals
        .filter((p) => p.side === side)
        .sort((a, b) => a.start - b.start)
        .map((p) => ({ start: p.start, end: p.end, artist: p.artist, title: p.title, known: p.known, by: p.author })),
    ),
  };
}
