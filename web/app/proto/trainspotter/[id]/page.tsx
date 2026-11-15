// PROTOTYPE (SIM-37) — throwaway exploration surface. Nothing in production imports from here.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllTapes, getCommentsForTape, getTapeById } from "../../../../lib/data";
import { getPaginatedComments } from "../../../../lib/comments";
import { parseComment, parseListing, reconcile, runningOrders } from "../parse";
import { Trainspotter } from "../trainspotter";
import "../trainspotter.css";

export const metadata: Metadata = {
  title: "Prototype: Trainspotter",
  robots: { index: false, follow: false },
};

type Said = { author: string; date: string; content: string };
const GROUPS = ["Unknown tracks to ID", "Tracklist known, times needed", "Started in the comments"];

export default async function TrainspotterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tape = getTapeById(id);
  if (!tape) notFound();

  // Everything anyone has said: the 2008–2023 archive plus the comments posted through the site since.
  // One cached query for the live ones; if the database is unreachable the archive still works.
  const live = (await getPaginatedComments(1, 5000)).comments;
  const said = (tapeId: string): Said[] => [
    ...getCommentsForTape(tapeId).map((c) => ({ author: c.author, date: c.date, content: c.content })),
    ...live
      .filter((c) => c.tape_id === tapeId)
      .map((c) => ({ author: c.author_name, date: new Date(c.created_at).toISOString().slice(0, 10), content: c.content })),
  ];

  // A sighting read from a sentence that didn't say which side is only used where there is one side.
  const timed = (comments: Said[], sideCount: number) => comments.flatMap((c) => parseComment(c.content, c.author, c.date)).filter((s) => !s.unsure || sideCount === 1);
  const mine = said(id);
  const sightings = timed(mine, tape.sides.length);
  const listed = mine.flatMap((c) => parseListing(c.content, c.author, c.date));
  // The tracklist already published on the site: names in order with no times, the most trusted order there is.
  const official = tape.sides.map((side, i) =>
    (side.tracks ?? []).map((t, n) => ({ side: i, n: n + 1, artist: t.artist, title: t.title, known: true, author: "simfonik", date: "" })),
  );

  // Every tape with something to work on, in the order the switcher lists them: the ones with unknown tracks
  // first, then the ones whose tracklist is known but not timed, then the ones listeners have only started.
  const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
  const others = getAllTapes()
    .map((t) => {
      const all = said(t.id);
      const marked = reconcile(timed(all, t.sides.length), t.sides.map(() => Infinity));
      const known = marked.filter((m) => m.known).length;
      const unknown = marked.length - known;
      const names =
        t.sides.reduce((n, side) => n + (side.tracks?.length ?? 0), 0) ||
        runningOrders(all.flatMap((c) => parseListing(c.content, c.author, c.date)), t.sides.length)
          .flat()
          .filter((l) => l.known).length;
      // A compilation's eight names would fill the row; its title says more.
      const label = t.djs.length > 3 ? `${t.title} — ${t.djs.length} DJs` : `${t.djs.map((d) => d.name).join(", ")} — ${t.title}`;
      const done = marked.length ? known / marked.length : null;
      if (unknown) return { id: t.id, label, group: "Unknown tracks to ID", meta: `${unknown} unknown · ${known} ID’d`, done, rank: unknown };
      if (names > known) return { id: t.id, label, group: "Tracklist known, times needed", meta: `${plural(names, "track")} to place`, done: null, rank: names };
      if (known) return { id: t.id, label, group: "Started in the comments", meta: `${known} ID’d`, done, rank: known };
      return null;
    })
    .filter((t) => t !== null)
    .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || b.rank - a.rank || a.label.localeCompare(b.label))
    .map(({ id, label, group, meta, done }) => ({ id, label, group, meta, done }));

  return (
    <Trainspotter
      tape={{
        id: tape.id,
        title: tape.title,
        djs: tape.djs.map((d) => d.name).join(", "),
        djCount: tape.djs.length,
        released: tape.released ?? "",
        sides: tape.sides.map((s) => ({ key: s.position, title: s.title ?? `Side ${s.position}`, audio: s.audio_links[0]?.url ?? null })),
      }}
      sightings={sightings}
      listed={listed}
      official={official}
      others={others}
    />
  );
}
