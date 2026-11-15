// What the comments say, gathered for the pages: one tape's tracks, and the list of every tape.
import { unstable_cache } from "next/cache";
import { COMMENTS_CACHE_TAG, getPaginatedComments } from "../../../lib/comments";
import { getAllTapes, getCommentsForTape } from "../../../lib/data";
import { digest, reconcile, runningOrders, type Listed, type Said, type Sighting } from "./parse";
import type { TapeEntry } from "./tape-switcher";

type Tape = ReturnType<typeof getAllTapes>[number];

/**
 * Everything anyone has said about a tape: the 2008–2023 archive, then the comments posted through the site
 * since. Oldest first, because a later comment corrects an earlier one and two on the same day are told apart
 * only by the order they arrive in. The newer ones are one cached query; if the database can't be reached the
 * archive still reads.
 */
async function everyone(): Promise<(tapeId: string) => Said[]> {
  const live = [...(await getPaginatedComments(1, 5000)).comments].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return (tapeId) => [
    ...getCommentsForTape(tapeId).map((c) => ({ author: c.author, date: c.date, content: c.content })),
    ...live.filter((c) => c.tape_id === tapeId).map((c) => ({ author: c.author_name, date: new Date(c.created_at).toISOString().slice(0, 10), content: c.content })),
  ];
}

/**
 * The timed tracks and the names in order that the comments give for a tape. The reader is handed each side's
 * own title, so "the Planet Earth side" lands on the side the site calls that. A track read from a sentence
 * that didn't say which side is only used where there is one side.
 */
function read(tape: Tape, said: Said[]): { sightings: Sighting[]; listed: Listed[] } {
  const { sightings, listed } = digest(said, tape.sides.map((s) => s.title ?? ""));
  return { sightings: sightings.filter((s) => !s.unsure || tape.sides.length === 1), listed };
}

export async function readTape(tape: Tape) {
  return read(tape, (await everyone())(tape.id));
}

const GROUPS = ["Tracks marked unknown", "Tracklist known, times needed", "Started in the comments", "Nothing marked yet"];
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/**
 * Every tape, in the order the switcher lists them: the ones with tracks marked unknown first, then the ones
 * whose tracklist is known but not timed, then the ones with some IDs, then the untouched ones.
 *
 * Building it means reading every comment on every tape, about a fifth of a second, and it is the same for
 * every page. So it is kept, and made again when a comment is posted (the tag) or the archive itself changes
 * (the key).
 */
export function tapeIndex(): Promise<TapeEntry[]> {
  const tapes = getAllTapes();
  const archive = `${tapes.length}:${tapes.reduce((n, t) => n + t.sides.reduce((m, s) => m + 1 + (s.tracks?.length ?? 0), 0), 0)}`;
  return unstable_cache(buildIndex, ["trainspotter-tape-index", archive], { tags: [COMMENTS_CACHE_TAG], revalidate: 60 * 60 * 24 })();
}

async function buildIndex(): Promise<TapeEntry[]> {
  const said = await everyone();
  return getAllTapes()
    .map((t) => {
      const all = read(t, said(t.id));
      const marked = reconcile(all.sightings, t.sides.map(() => Infinity));
      const known = marked.filter((m) => m.known).length;
      const unknown = marked.length - known;
      // Two different things, and only one of them is a tracklist. The site's own list is the tape's full
      // running order. A list in a comment is whatever one person remembered, often a handful of tracks with
      // gaps in the numbering, so it never earns "tracklist known".
      const official = t.sides.reduce((n, side) => n + (side.tracks?.length ?? 0), 0);
      const namedInComments = official
        ? 0
        : runningOrders(all.listed, t.sides.length)
            .flat()
            .filter((l) => l.known).length;
      // A compilation's eight names would fill the row; its title says more.
      const label = t.djs.length > 3 ? `${t.title} — ${t.djs.length} DJs` : `${t.djs.map((d) => d.name).join(", ")} — ${t.title}`;
      // Counts say only what is so: how many tracks have a name, and how many spots someone has marked or
      // asked about. Neither is a total. Nobody knows how many tracks an unmarked tape holds, so there is no
      // "x of y" and no progress bar.
      const idd = known ? `${known} ID’d` : "";
      const open = unknown ? `${unknown} marked unknown` : "";
      const untimed = namedInComments > known ? `${namedInComments} named, no times` : "";
      if (unknown) return { id: t.id, label, group: GROUPS[0], meta: [idd, open].filter(Boolean).join(" · "), rank: unknown };
      if (official > known) return { id: t.id, label, group: GROUPS[1], meta: `${plural(official, "track")} to place`, rank: official };
      if (known || untimed) return { id: t.id, label, group: GROUPS[2], meta: [idd, untimed].filter(Boolean).join(" · "), rank: known + namedInComments };
      // Every tape is here, including the ones nobody has said anything about: those are the blank ones.
      return { id: t.id, label, group: GROUPS[3], meta: "", rank: 0 };
    })
    .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || b.rank - a.rank || a.label.localeCompare(b.label))
    .map(({ id, label, group, meta }) => ({ id, label, group, meta }));
}
