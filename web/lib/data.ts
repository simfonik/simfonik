import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { Tape } from "../types/tape";

function readTapesFile(): Tape[] {
  const filePath = path.join(process.cwd(), "data", "tapes.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw) as Tape[];
  return data;
}

export function getAllTapes(): Tape[] {
  const tapes = readTapesFile();

  // Reverse order: last in JSON appears first on site
  return tapes.slice().reverse();
}

export function getTapeById(id: string): Tape | undefined {
  return readTapesFile().find((t) => t.id === id);
}

export function getTapesByDJSlug(slug: string): Tape[] {
  return getAllTapes().filter((t) => t.djs.some((dj) => dj.slug === slug));
}

export function getAllDJSlugs(): string[] {
  const slugs = new Set<string>();
  for (const tape of readTapesFile()) {
    for (const dj of tape.djs) slugs.add(dj.slug);
  }
  return Array.from(slugs).sort();
}

export function getDJDisplayName(slug: string): string {
  for (const tape of readTapesFile()) {
    const match = tape.djs.find((dj) => dj.slug === slug);
    if (match) return match.name;
  }
  return slug;
}

export interface DJIndexItem {
  name: string;
  slug: string;
  tapeCount: number;
  tapes: Array<{ id: string; title: string }>;
}

export function getAllDJs(): DJIndexItem[] {
  const allTapes = getAllTapes();
  const djMap = new Map<string, { name: string; tapeIds: string[] }>();
  
  for (const tape of allTapes) {
    for (const dj of tape.djs) {
      const existing = djMap.get(dj.slug);
      if (existing) {
        existing.tapeIds.push(tape.id);
      } else {
        djMap.set(dj.slug, { name: dj.name, tapeIds: [tape.id] });
      }
    }
  }
  
  return Array.from(djMap.entries())
    .map(([slug, { name, tapeIds }]) => ({
      name,
      slug,
      tapeCount: tapeIds.length,
      tapes: tapeIds.slice(0, 5).map((id) => {
        const tape = allTapes.find((t) => t.id === id);
        return { id, title: tape?.title ?? '' };
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get the best available cover image for a tape.
 * Falls back through: cover -> side A image -> side B image -> blank tape SVG
 */
export function getCoverImageWithFallback(tape: Tape): string {
  // First try the primary cover image
  if (tape.images?.cover) {
    return tape.images.cover;
  }
  
  // Fall back to side A image
  if (tape.sides[0]?.image) {
    return tape.sides[0].image;
  }
  
  // Fall back to side B image
  if (tape.sides[1]?.image) {
    return tape.sides[1].image;
  }
  
  // Final fallback to blank tape
  return "/media/site/blank-tape.svg";
}
