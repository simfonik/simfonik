// The track IDs the comments give for a tape, gathered for the tape page's player. Server only.
import sideLengths from '../../data/side-lengths.json';
import type { Tape } from '../../types/tape';
import { getTapeComments } from '../comments';
import { getCommentsForTape } from '../data';
import { readComposed, type TrackId } from './compose';
import { digest, reconcile, type Said, type Sighting } from './parse';

/**
 * One list of IDs per side, in the order the tape has its sides, each in order of time.
 *
 * Everything anyone has said about the tape is read: the 2008–2023 archive, then the comments posted through
 * the site since, oldest first, because a later comment corrects an earlier one. A comment in the site's own
 * form (`[B 12:34] Moby - Go`, see compose.ts) is taken exactly as written; the rest are read as prose. A
 * track read from a sentence that didn't say which side is only used on a tape with one side.
 *
 * `complete` is false when the newer comments couldn't be fetched. The archive still reads, so the IDs given
 * are real, but nobody should conclude from them that there are no others.
 */
export async function readTrackIds(tape: Tape): Promise<{ sides: TrackId[][]; complete: boolean }> {
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
  const read = digest(prose, tape.sides.map((s) => s.title ?? '')).sightings.filter((s) => !s.unsure || tape.sides.length === 1);

  // A side whose length was never measured has no end to hold its IDs to.
  const measured = (sideLengths as Record<string, (number | null)[]>)[tape.id];
  const lengths = tape.sides.map((_, side) => measured?.[side] ?? Infinity);
  const proposals = reconcile([...read, ...exact], lengths);

  return {
    complete,
    sides: tape.sides.map((_, side) =>
      proposals
        .filter((p) => p.side === side)
        .sort((a, b) => a.start - b.start)
        .map((p) => ({ start: p.start, end: p.end, artist: p.artist, title: p.title, known: p.known, by: p.author })),
    ),
  };
}
