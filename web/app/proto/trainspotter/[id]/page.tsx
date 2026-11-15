// PROTOTYPE (SIM-37) — throwaway exploration surface. Nothing in production imports from here.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTapeById } from "../../../../lib/data";
import { readTape, tapeIndex } from "../comments";
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

  const [{ sightings, listed, complete }, others] = await Promise.all([readTape(tape), tapeIndex()]);
  // How loud each side is along its length, for the tapes where that has been measured. The overview draws it.
  const waves = await import(`../../../../data/waveforms/${tape.id}.json`).then(
    (file) => file.default as number[][],
    () => null,
  );
  // The tracklist already published on the site: names in order with no times, the most trusted order there is.
  const official = tape.sides.map((side, i) =>
    (side.tracks ?? []).map((t, n) => ({ side: i, n: n + 1, artist: t.artist, title: t.title, known: true, author: "simfonik", date: "" })),
  );

  return (
    // Keyed by tape: the timeline, its history and its saved copy belong to one tape and start over with the next.
    <Trainspotter
      key={tape.id}
      tape={{
        id: tape.id,
        title: tape.title,
        djs: tape.djs.map((d) => d.name).join(", "),
        djCount: tape.djs.length,
        released: tape.released ?? "",
        sides: tape.sides.map((s) => ({ key: s.position, title: s.title ?? `Side ${s.position}`, audio: s.audio_links[0]?.url ?? null })),
      }}
      sightings={sightings}
      complete={complete}
      listed={listed}
      official={official}
      others={others}
      waves={waves}
    />
  );
}
