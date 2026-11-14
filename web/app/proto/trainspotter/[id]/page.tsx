// PROTOTYPE (SIM-37) — throwaway exploration surface. Nothing in production imports from here.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllTapes, getCommentsForTape, getTapeById } from "../../../../lib/data";
import { parseComment } from "../parse";
import { Trainspotter } from "../trainspotter";
import "../trainspotter.css";

export const metadata: Metadata = {
  title: "Prototype: Trainspotter",
  robots: { index: false, follow: false },
};

export default async function TrainspotterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tape = getTapeById(id);
  if (!tape) notFound();

  const sightings = getCommentsForTape(id).flatMap((c) => parseComment(c.content, c.author, c.date));
  // Other tapes worth opening: the ones whose comments carry timed IDs.
  const others = getAllTapes()
    .map((t) => ({
      id: t.id,
      label: `${t.djs.map((d) => d.name).join(", ")} — ${t.title}`,
      count: getCommentsForTape(t.id).reduce((n, c) => n + parseComment(c.content, c.author, c.date).length, 0),
    }))
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
      others={others}
    />
  );
}
