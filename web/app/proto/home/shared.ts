import imageLoader from "../../../lib/imageLoader";
import type { TapeListSubset } from "../../../types/tape";

export type ProtoTape = TapeListSubset & { coverImage: string; catalogNumber: string; audio: string | null };

export const djLine = (t: ProtoTape) => t.djs.map((d) => d.name).join(", ");
export const cover = (t: ProtoTape, width: 400 | 800 | 1200) => imageLoader({ src: t.coverImage, width });

/** Oldest first; within a year, in the order they joined the archive. */
export const chronological = (tapes: ProtoTape[]) =>
  [...tapes].sort(
    (a, b) => (a.released ?? "").localeCompare(b.released ?? "") || a.catalogNumber.localeCompare(b.catalogNumber),
  );

/** Stable 0..n-1 pick from a string, so "random" looks don't change between renders. */
export const pick = (seed: string, n: number) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % n;
};
