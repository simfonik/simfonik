// PROTOTYPE (SIM-37) — throwaway exploration surface. Nothing in production imports from here.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllTapes, getCommentsForTape, getTapeById } from "../../../../lib/data";
import { getPaginatedComments } from "../../../../lib/comments";
import { digest, reconcile, runningOrders, type Said } from "../parse";
import { Trainspotter } from "../trainspotter";
import "../trainspotter.css";

export const metadata: Metadata = {
  title: "Prototype: Trainspotter",
  robots: { index: false, follow: false },
};

const GROUPS = ["Tracks marked unknown", "Tracklist known, times needed", "Started in the comments", "Nothing marked yet"];

export default async function TrainspotterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tape = getTapeById(id);
  if (!tape) notFound();

  // Everything anyone has said: the 2008–2023 archive plus the comments posted through the site since.
  // One cached query for the live ones; if the database is unreachable the archive still works.
  // Oldest first, like the archive: a later comment corrects an earlier one, and two on the same day are told
  // apart only by the order they arrive in.
  const live = [...(await getPaginatedComments(1, 5000)).comments].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const said = (tapeId: string): Said[] => [
    ...getCommentsForTape(tapeId).map((c) => ({ author: c.author, date: c.date, content: c.content })),
    ...live
      .filter((c) => c.tape_id === tapeId)
      .map((c) => ({ author: c.author_name, date: new Date(c.created_at).toISOString().slice(0, 10), content: c.content })),
  ];

  // What the comments say about a tape: timed tracks and names in order. The parser is given each side's own
  // title, so "the Planet Earth side" lands on the side the site calls that. A sighting read from a sentence
  // that didn't say which side is only used where there is one side.
  const read = (t: { id: string; sides: { title?: string }[] }) => {
    const { sightings, listed } = digest(said(t.id), t.sides.map((s) => s.title ?? ""));
    return { sightings: sightings.filter((s) => !s.unsure || t.sides.length === 1), listed };
  };
  const { sightings, listed } = read(tape);
  // The tracklist already published on the site: names in order with no times, the most trusted order there is.
  const official = tape.sides.map((side, i) =>
    (side.tracks ?? []).map((t, n) => ({ side: i, n: n + 1, artist: t.artist, title: t.title, known: true, author: "simfonik", date: "" })),
  );

  // Every tape, in the order the switcher lists them: the ones with tracks marked unknown first, then the
  // ones whose tracklist is known but not timed, then the ones with some IDs, then the untouched ones.
  const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
  const others = getAllTapes()
    .map((t) => {
      const all = read(t);
      const marked = reconcile(all.sightings, t.sides.map(() => Infinity));
      const known = marked.filter((m) => m.known).length;
      const unknown = marked.length - known;
      // Two different things, and only one of them is a tracklist. The site's own list is the tape's full
      // running order. A numbered list in a comment is whatever one person remembered, often a handful of
      // tracks with gaps in the numbering, so it never earns "tracklist known".
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
      if (unknown) return { id: t.id, label, group: "Tracks marked unknown", meta: [idd, open].filter(Boolean).join(" · "), rank: unknown };
      if (official > known) return { id: t.id, label, group: "Tracklist known, times needed", meta: `${plural(official, "track")} to place`, rank: official };
      if (known || untimed) return { id: t.id, label, group: "Started in the comments", meta: [idd, untimed].filter(Boolean).join(" · "), rank: known + namedInComments };
      // Every tape is here, including the ones nobody has said anything about: those are the blank ones.
      return { id: t.id, label, group: "Nothing marked yet", meta: "", rank: 0 };
    })
    .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || b.rank - a.rank || a.label.localeCompare(b.label))
    .map(({ id, label, group, meta }) => ({ id, label, group, meta }));

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
