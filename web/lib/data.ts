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

  // Newest first. Works well if you store released as YYYY-MM-DD consistently.
  return tapes.slice().sort((a, b) => b.released.localeCompare(a.released));
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
