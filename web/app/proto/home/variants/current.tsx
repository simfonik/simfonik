"use client";

// Baseline: the live homepage, unchanged, so every other direction is judged against the real thing.
import { TapeGalleryWithSearch } from "../../../../components/TapeGalleryWithSearch";
import { Oscilloscope } from "../../../../components/Oscilloscope";
import type { ProtoTape } from "../shared";

export function Current({ tapes, recent }: { tapes: ProtoTape[]; recent: React.ReactNode }) {
  return (
    <div>
      <div className="relative h-[77px] sm:h-[110px] lg:h-[154px] w-full overflow-hidden" aria-hidden>
        <Oscilloscope className="oscilloscope-hero absolute inset-0" />
      </div>
      {recent}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <TapeGalleryWithSearch tapes={tapes} />
      </main>
    </div>
  );
}
