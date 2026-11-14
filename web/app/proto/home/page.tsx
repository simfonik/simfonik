// PROTOTYPE — throwaway exploration surface (SIM-37). Nothing in production imports from here.
import type { Metadata } from "next";
import { getAllTapes, getCoverImageWithFallback } from "../../../lib/data";
import { Harness } from "./harness";
import "./proto.css";

export const metadata: Metadata = {
  title: "Prototype: homepage directions",
  robots: { index: false, follow: false },
};

export default function ProtoHome() {
  const tapes = getAllTapes();
  const total = tapes.length;
  const data = tapes.map((tape, i) => ({
    id: tape.id,
    title: tape.title,
    released: tape.released,
    djs: tape.djs,
    images: tape.images,
    coverImage: getCoverImageWithFallback(tape),
    catalogNumber: String(total - i).padStart(3, "0"),
    audio: tape.sides[0]?.audio_links[0]?.url ?? null,
  }));
  return <Harness tapes={data} />;
}
