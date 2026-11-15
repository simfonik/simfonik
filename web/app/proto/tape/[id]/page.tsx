// PROTOTYPE (SIM-43): four directions for the top of the tape page, behind a picker. Throwaway: nothing on
// the site imports from this folder, and it is deleted once a direction is chosen. It is given the same
// materials as the real page (app/tapes/[id]/page.tsx): the tape, its images, its measured waveforms.
import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import sharp from "sharp";
import sideLengths from "../../../../data/side-lengths.json";
import { getAllSeries, getTapeById } from "../../../../lib/data";
import { hasOptimizedImages, isOptimizableImagePath } from "../../../../lib/image-utils";
import { AudioCoordinator } from "../../../../components/AudioCoordinator";
import { LiveComments } from "../../../../components/LiveComments";
import { TapeTrackIdsProvider } from "../../../../components/TapeTrackIds";
import { Harness } from "./harness";
import type { TapeView } from "./shared";

// As on the real page.
const isStreamable = (url: string) => url.toLowerCase().includes("raw=1") || /\.(mp3|m4a|ogg|wav)(\?|#|$)/.test(url.toLowerCase());

export const metadata: Metadata = { title: "Tape page prototype", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tape = getTapeById(id);
  if (!tape) notFound();

  const lengths = (sideLengths as Record<string, (number | null)[]>)[tape.id];
  const waves = await import(`../../../../data/waveforms/${tape.id}.json`).then(
    (file) => file.default as (number[] | null)[],
    () => null,
  );
  const allSeries = getAllSeries();

  const found: Omit<TapeView["images"][number], "width" | "height">[] = [];
  if (tape.images?.cover) {
    found.push({ src: tape.images.cover, label: `${tape.title} mixtape by ${tape.djs.map((dj) => dj.name).join(", ")}`, tapeId: hasOptimizedImages(tape) ? tape.id : undefined });
  }
  tape.sides.forEach((side) => {
    if (!side.image) return;
    const optimizable = isOptimizableImagePath(side.image);
    found.push({ src: side.image, label: `${tape.title} – ${side.title ?? `Side ${side.position}`} image`, tapeId: optimizable ? tape.id : undefined, sidePosition: optimizable ? side.position.toLowerCase() : undefined });
  });
  if (found.length === 0) found.push({ src: "/media/site/blank-tape.svg", label: "Blank cassette tape placeholder" });
  const usesPlaceholder = found.length === 1 && found[0].src.includes("/generated/placeholders/");
  // Each image's own size, so a picture's place on the page is known before the picture has loaded.
  const images: TapeView["images"] = await Promise.all(
    found.map(async (img) => {
      const { width, height } = await sharp(path.join(process.cwd(), "public", img.src)).metadata();
      return { ...img, width, height };
    }),
  );

  const view: TapeView = {
    id: tape.id,
    title: tape.title,
    djs: tape.djs.map((dj) => ({ name: dj.name, slug: dj.slug, link: dj.link !== false && dj.slug !== "unknown" })),
    released: tape.released ?? null,
    series: (tape.series ?? []).map((slug) => ({ slug, name: allSeries.find((s) => s.slug === slug)?.name ?? slug })),
    source: tape.source ? { name: tape.source, url: tape.source_url ?? null } : null,
    images,
    placeholderLabel: usesPlaceholder
      ? `data:image/avif;base64,${fs.readFileSync(path.join(process.cwd(), "public", "generated", "placeholders", `${tape.id}-label.avif`)).toString("base64")}`
      : null,
    sideCount: tape.sides.length,
    unlabelled: tape.sides.length === 1 && !tape.sides[0].title,
    tracks: tape.sides
      .map((side, index) => ({ side, index }))
      .filter(({ side }) => side.audio_links[0] && isStreamable(side.audio_links[0].url))
      .map(({ side, index }) => ({
        title: side.title ?? `Side ${side.position}`,
        url: side.audio_links[0].url,
        position: side.position,
        index,
        djs: side.djs,
        wave: waves?.[index] ?? null,
        length: lengths?.[index] ?? null,
      })),
  };

  return (
    <main className="min-h-screen">
      <AudioCoordinator />
      <TapeTrackIdsProvider tapeId={tape.id}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <Harness tape={view} />

          {/* What follows on the real page, so each direction is judged with something under it. */}
          <section className="border-t-[1.5px] border-[var(--border)] pt-14 mt-16">
            <div className="max-w-3xl">
              <h2 className="font-display text-4xl sm:text-5xl leading-[0.95] text-[var(--text)] mb-8">Comments</h2>
              <LiveComments tapeId={tape.id} />
            </div>
          </section>
        </div>
      </TapeTrackIdsProvider>
    </main>
  );
}
