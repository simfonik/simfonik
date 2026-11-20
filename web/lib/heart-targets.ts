// What a heart is given to (see lib/hearts.ts), in a file of its own so that the tape page can name a comment
// without bringing the database along.
import { createHash } from 'crypto';
import type { ArchivedComment } from '../types/tape';

/** A comment posted through the site, by its id. */
export const postedTarget = (id: number) => `c${id}`;

/**
 * A comment kept from the old site. It has no id, and its place in the archive moves when a comment is
 * recovered ahead of it (SIM-55), so it goes by what it is: who wrote it, on what day, and what they said.
 */
export const archivedTarget = (comment: Pick<ArchivedComment, 'author' | 'date' | 'content'>) =>
  `a${createHash('sha256').update(`${comment.author}\n${comment.date}\n${comment.content}`).digest('hex').slice(0, 10)}`;
