// Hearts on a tape's comments. Server only.
//
// The site has no accounts, so a heart is a browser's: the browser makes itself an id the first time it gives
// one (components/TapeStats.tsx) and sends it with each. One heart for each browser on each comment, which the
// table's key sees to:
//
//   CREATE TABLE hearts (
//     tape_id    varchar(255) NOT NULL,
//     target     varchar(16)  NOT NULL,
//     visitor    char(64)     NOT NULL,
//     created_at timestamptz  NOT NULL DEFAULT now(),
//     PRIMARY KEY (tape_id, target, visitor)
//   );
import { createHash } from 'crypto';
import { unstable_cache } from 'next/cache';
import { getTapeComments } from './comments';
import { getCommentsForTape } from './data';
import { sql } from './db';
import { archivedTarget, postedTarget } from './heart-targets';

/** The comments' cache is one tag for the site; a heart only changes its own tape's counts. */
export const heartsTag = (tapeId: string) => `hearts:${tapeId}`;

/** A browser's id as it is kept: hashed, so the id the browser holds is never stored. */
export const visitorKey = (visitor: string) => createHash('sha256').update(visitor).digest('hex');

/**
 * Whether `target` is a comment on the tape: one posted through the site, or one kept from the old site
 * (lib/heart-targets.ts has the two forms).
 */
export async function isComment(tapeId: string, target: string): Promise<boolean> {
  if (/^a[0-9a-f]{10}$/.test(target)) return getCommentsForTape(tapeId).some((comment) => archivedTarget(comment) === target);
  if (!/^c\d{1,9}$/.test(target)) return false;
  return (await getTapeComments(tapeId)).some((comment) => postedTarget(comment.id) === target);
}

/**
 * How many hearts each of a tape's comments has, by target; a comment with none is not in it. Kept until a
 * heart is given or taken back on that tape, or a day has gone by, as the comments are (lib/comments.ts).
 */
export const heartCounts = (tapeId: string): Promise<Record<string, number>> =>
  unstable_cache(
    async () => {
      const { rows } = await sql`SELECT target, COUNT(*)::int AS n FROM hearts WHERE tape_id = ${tapeId} GROUP BY target`;
      return Object.fromEntries((rows as { target: string; n: number }[]).map((row) => [row.target, row.n]));
    },
    ['hearts', tapeId],
    { tags: [heartsTag(tapeId)], revalidate: 60 * 60 * 24 },
  )();

/** Gives a browser's heart to a comment, or takes it back, and says how many the comment then has. */
export async function setHeart(tapeId: string, target: string, visitor: string, on: boolean): Promise<number> {
  const key = visitorKey(visitor);
  if (on) await sql`INSERT INTO hearts (tape_id, target, visitor) VALUES (${tapeId}, ${target}, ${key}) ON CONFLICT DO NOTHING`;
  else await sql`DELETE FROM hearts WHERE tape_id = ${tapeId} AND target = ${target} AND visitor = ${key}`;
  const { rows } = await sql`SELECT COUNT(*)::int AS n FROM hearts WHERE tape_id = ${tapeId} AND target = ${target}`;
  return (rows[0] as { n: number }).n;
}
