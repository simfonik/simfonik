// What a tape's comments say is on it: the whole of the reading, with nothing fetched. `read.ts` gathers the
// comments and calls this; the tests call it with the comments they make up, or the archive alone. Pure.
import sideLengths from '../../data/side-lengths.json';
import type { ArchivedComment, Tape } from '../../types/tape';
import { readComposed, type RunningOrder } from './compose';
import type { Moment } from './moments';
import { digest, pageSide, reconcile, runningOrders, sideNames, trusted, type Said, type Sighting } from './parse';

/**
 * A tape's archived comments as the reader takes them. On a set of several DJs' tapes each tape had a page of its
 * own on the old site, and what was said there never names the set it is about: the page did. So a comment that
 * was on one side's page is read under that side's name, as a comment headed with it is. What it says of that
 * side stands until someone lists the side with its times (`digest`).
 */
export function archivedSaid(tape: Pick<Tape, 'sides'>, comments: ArchivedComment[]): Said[] {
  const names = sideNames(tape.sides);
  return comments.map((comment) => {
    const side = comment.source_title ? pageSide(comment.source_title, names) : null;
    const heading = side === null ? undefined : [names[side]].flat().find(Boolean);
    return heading ? { author: comment.author, date: comment.date, content: `${heading}\n\n${comment.content}`, page: side as number } : { author: comment.author, date: comment.date, content: comment.content };
  });
}

/**
 * What the comments say of each side of a tape, moment by moment (see moments.ts, whose `settle` makes each
 * side's tracks of them), and each side's list. The comments are given oldest first.
 *
 * Everything anyone has said about the tape is read: the 2008–2023 archive, then the comments posted through
 * the site since, because a later comment corrects an earlier one. A comment in the site's own form
 * (`[B 12:34] Moby - Go`, one line or several, see compose.ts) is taken exactly as written, a line that takes
 * a mark away included. The rest are read as prose, and what they don't place on a side is used only where
 * the tape leaves no doubt (see `trusted`).
 *
 * `orders` is, for each side, its tracks in the order they play where a list gives them with few or no
 * times: the tape's own tracklist, or failing that the fullest list kept in the comments. On a set of several
 * DJs' tapes "Side 1" in a comment is the first side of whichever cassette its writer had, and there is no
 * telling which that was. So on a tape with more than two sides a list in the comments is only used where it
 * is under one of a side's own names ("Scott Hardkiss"), which leaves no doubt.
 */
export function readSaid(tape: Pick<Tape, 'id' | 'sides'>, said: Said[]): { sides: Moment[][]; orders: (RunningOrder | null)[] } {
  const positions = tape.sides.map((s) => s.position);
  const exact: Sighting[] = [];
  const prose: Said[] = [];
  for (const c of said) {
    const post = readComposed(c.content, positions);
    if (post) for (const id of post) exact.push({ ...id, known: Boolean(id.artist || id.title), exact: true, author: c.author, date: c.date });
    else prose.push(c);
  }
  const { sightings, listed } = digest(prose, sideNames(tape.sides));
  const read = trusted(sightings, tape.sides.length);
  const kept = runningOrders(tape.sides.length <= 2 ? listed : listed.filter((line) => line.named), tape.sides.length);

  // A side whose length was never measured has no end to hold its IDs to.
  const measured = (sideLengths as Record<string, (number | null)[]>)[tape.id];
  const lengths = tape.sides.map((_, side) => measured?.[side] ?? Infinity);

  return {
    sides: reconcile([...read, ...exact], lengths),
    orders: tape.sides.map((side, i): RunningOrder | null => {
      if (side.tracks?.length) return { by: null, tracks: side.tracks.map((t, k) => ({ n: k + 1, artist: t.artist, title: t.title, known: true })) };
      const list = kept[i] ?? [];
      return list.length ? { by: list[0].author, tracks: list.map(({ n, artist, title, known, at }) => ({ n, artist, title, known, at })) } : null;
    }),
  };
}
