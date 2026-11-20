// A tape's comments and what they say is on it, gathered for the tape page. Server only.
import { unstable_cache } from 'next/cache';
import type { Tape } from '../../types/tape';
import { COMMENTS_CACHE_TAG, getTapeComments, type TapeComment } from '../comments';
import { getCommentsForTape, getTapeById } from '../data';
import type { RunningOrder } from './compose';
import type { Moment } from './moments';
import type { Said } from './parse';
import { archivedSaid, readSaid } from './said';

/**
 * What the tape page is sent, in one piece so that none of it can be older than the rest: the comments
 * posted through the site, oldest first, and what those and the archive say of each side (said.ts).
 *
 * `complete` is false when the newer comments couldn't be fetched. The archive still reads, so what is
 * given is real, but nobody should conclude from it that there is nothing else.
 */
export type TapeReading = { comments: TapeComment[]; sides: Moment[][]; orders: (RunningOrder | null)[]; complete: boolean };

const archived = (tapeId: string): Said[] => archivedSaid(getTapeById(tapeId) as Tape, getCommentsForTape(tapeId));

/** Everything said about a tape, the 2008–2023 archive and then the comments since, and its reading. It throws where the newer comments can't be had. */
async function readAll(tapeId: string) {
  const comments = await getTapeComments(tapeId);
  const said = [...archived(tapeId), ...comments.map((c) => ({ author: c.author_name, date: new Date(c.created_at).toISOString(), content: c.content }))];
  return { comments, ...readSaid(getTapeById(tapeId) as Tape, said) };
}

// Reading a tape's comments is work, and they change only when someone writes one. So the reading is kept
// as the comments themselves are (lib/comments.ts): until a comment is written or taken down, or a day has
// gone by. It is kept per deploy, because a new one may read differently, and not at all in development,
// where the reader is what is being worked on. A reading that couldn't have every comment is never kept.
const readKept =
  process.env.NODE_ENV === 'production'
    ? unstable_cache(readAll, ['track-ids', process.env.VERCEL_GIT_COMMIT_SHA ?? ''], { tags: [COMMENTS_CACHE_TAG], revalidate: 60 * 60 * 24 })
    : readAll;

export async function readTrackIds(tape: Tape): Promise<TapeReading> {
  try {
    return { complete: true, ...(await readKept(tape.id)) };
  } catch (error) {
    console.error('Track IDs: the newer comments could not be read:', error);
    return { complete: false, comments: [], ...readSaid(tape, archived(tape.id)) };
  }
}
