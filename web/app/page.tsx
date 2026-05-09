import type { Metadata } from "next";
import { getAllTapes, getCoverImageWithFallback } from "../lib/data";
import { TapeGalleryWithSearch } from "../components/TapeGalleryWithSearch";
import { Oscilloscope } from "../components/Oscilloscope";
import { JsonLd } from "../components/JsonLd";
import { generateWebsiteSchema } from "../lib/structured-data";

export const metadata: Metadata = {
  title: {
    absolute: "90s Rave DJ Mixtapes - Los Angeles Underground Archive"
  },
  description: "Curated archive of 90s rave DJ mixes from the early Los Angeles underground scene.",
};

// ISR: Revalidate every 60 seconds
export const revalidate = 60;

export default async function Home() {
  const tapes = getAllTapes();
  const total = tapes.length;

  // Pass only the fields the gallery needs to keep the RSC payload small
  const tapesWithCovers = tapes.map((tape, i) => ({
    id: tape.id,
    title: tape.title,
    released: tape.released,
    djs: tape.djs,
    images: tape.images,
    coverImage: getCoverImageWithFallback(tape),
    catalogNumber: String(total - i).padStart(3, "0"),
  }));

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <JsonLd data={generateWebsiteSchema()} />

      {/* Hero — oscilloscope waveform */}
      <div
        className="relative h-[70px] sm:h-[100px] lg:h-[140px] w-full overflow-hidden"
        aria-hidden
      >
        <Oscilloscope className="oscilloscope-hero absolute inset-0" />
      </div>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <TapeGalleryWithSearch tapes={tapesWithCovers} />
      </main>
    </div>
  );
}
