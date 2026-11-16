// The track IDs the comments give for a tape, gathered for the tape page. Server only.
import type { Tape } from '../../types/tape';
import { getTapeComments } from '../comments';
import { getCommentsForTape } from '../data';
import type { RunningOrder, TrackId } from './compose';
import type { Said } from './parse';
import { readSaid } from './said';

/**
 * Everything anyone has said about the tape, read for what is on it (said.ts): the 2008–2023 archive, then
 * the comments posted through the site since.
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
  return { complete, ...readSaid(tape, said) };
}
