// PROTOTYPE (SIM-37) — throwaway exploration surface. Nothing in production imports from here.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllTapes, getCommentsForTape, getTapeById } from "../../../../lib/data";
import { getPaginatedComments } from "../../../../lib/comments";
import { parseComment, parseListing, runningOrders } from "../parse";
import { Trainspotter } from "../trainspotter";
import "../trainspotter.css";

export const metadata: Metadata = {
  title: "Prototype: Trainspotter",
  robots: { index: false, follow: false },
};

type Said = { author: string; date: string; content: string };

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

  const mine = said(id);
  const sightings = mine.flatMap((c) => parseComment(c.content, c.author, c.date));
  const listed = mine.flatMap((c) => parseListing(c.content, c.author, c.date));
  // The tracklist already published on the site: names in order with no times, the most trusted order there is.
  const official = tape.sides.map((side, i) =>
    (side.tracks ?? []).map((t, n) => ({ side: i, n: n + 1, artist: t.artist, title: t.title, known: true, author: "simfonik", date: "" })),
  );

  // Other tapes worth opening: the ones with timed IDs or a running order to place.
  const others = getAllTapes()
    .map((t) => {
      const all = said(t.id);
      const timed = all.reduce((n, c) => n + parseComment(c.content, c.author, c.date).length, 0);
      const named =
        t.sides.reduce((n, side) => n + (side.tracks?.length ?? 0), 0) ||
        runningOrders(all.flatMap((c) => parseListing(c.content, c.author, c.date)), t.sides.length)
          .flat()
          .filter((l) => l.known).length;
      return { id: t.id, label: `${t.djs.map((d) => d.name).join(", ")} — ${t.title}`, count: timed + named };
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <Trainspotter
      tape={{
        id: tape.id,
        title: tape.title,
        djs: tape.djs.map((d) => d.name).join(", "),
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
