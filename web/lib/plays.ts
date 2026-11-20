// How many times a mix has been played, as the tape page says it. Server only.
import { unstable_cache } from 'next/cache';
import starts from '../data/play-starts.json';
import { sql } from './db';

// Plays have been counted since 15 February 2026 (one for each side started, in the `plays` table). A mix that
// was on the old site had years of listening before that, and its counted plays alone would undersell it. So
// each of those mixes has a start, in data/play-starts.json: 26 plays for every comment it had on the old
// site, and never less than a figure from 133 to 163 that differs by mix. 26 is what the site had in plays
// for each comment between February and November 2026, and the old comments are the only record of how much
// a mix was listened to then. The starts were worked out once, on 20 November 2026, and are fixed: every
// play since counts as one. A mix added since the relaunch has no start, and neither will one added later.
const START: Record<string, number> = starts;

/** A mix with no start says nothing until it has this many plays: a handful would read as nobody listening. */
const SHOWN_FROM = 100;

// Every mix's counted plays in one query, asked for every six hours: four wakes of the database a day at
// most, which is left to sleep in between (see lib/comments.ts). The page adds the listener's own plays to
// the number as they start them (components/TapeStats.tsx), so it never looks as if a play went uncounted.
const countedPlays = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const { rows } = await sql`SELECT tape_id, COUNT(*)::int AS n FROM plays GROUP BY tape_id`;
    return Object.fromEntries((rows as { tape_id: string; n: number }[]).map((row) => [row.tape_id, row.n]));
  },
  ['play-counts'],
  { revalidate: 60 * 60 * 6 },
);

/** The plays to show for a mix, or null where there is nothing to show yet. */
export async function playsShown(tapeId: string): Promise<number | null> {
  const counted = (await countedPlays())[tapeId] ?? 0;
  const start = START[tapeId];
  if (start !== undefined) return start + counted;
  return counted >= SHOWN_FROM ? counted : null;
}
