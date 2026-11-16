// PROTOTYPE (SIM-37) — throwaway exploration surface. Nothing in production imports from here.
// The page is at /spot/<tape>, a short address to pass around; what it is made of is in app/proto/trainspotter.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCoverImageWithFallback, getTapeById } from "../../../lib/data";
import { readTape, tapeIndex } from "../../proto/trainspotter/comments";
import { Trainspotter } from "../../proto/trainspotter/trainspotter";
import "../../proto/trainspotter/trainspotter.css";

// What a link to the page shows where it is pasted: the tape, what the page is for, and the tape's own
// picture. (The address in it is this deployment's, where there is one: the page is not on the live site.)
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const tape = getTapeById((await params).id);
  const robots = { index: false, follow: false };
  if (!tape) return { title: "Trainspotter", robots };
  const djs = tape.djs.length > 2 ? `${tape.djs[0].name}, ${tape.djs[1].name}, ...` : tape.djs.map((dj) => dj.name).join(", ");
  const title = `Trainspotter: ${djs} — ${tape.title}`;
  const description = "Play the tape, see the tracks other people have named, and ID the ones you know.";
  const image = `https://simfonik.com${getCoverImageWithFallback(tape)}`;
  const host = process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL;
  return {
    title,
    description,
    robots,
    openGraph: { title, description, type: "website", images: [{ url: image, alt: `${tape.title} cover` }], ...(host ? { url: `https://${host}/spot/${tape.id}` } : {}) },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function TrainspotterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tape = getTapeById(id);
  if (!tape) notFound();

  const [{ sightings, listed, complete }, others] = await Promise.all([readTape(tape), tapeIndex()]);
  // How loud each side is along its length, for the tapes where that has been measured. The overview draws it.
  const waves = await import(`../../../data/waveforms/${tape.id}.json`).then(
    (file) => file.default as (number[] | null)[],
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
