import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { Tape, DJ, ArchivedComment } from "../types/tape";

function readTapesFile(): Tape[] {
  const filePath = path.join(process.cwd(), "data", "tapes.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw) as Tape[];
  return data;
}

// Interface for DJ data structure
interface DJData {
  aliases?: Array<{ name: string; slug: string }>;
  links?: string[];
  bio?: string;
}

// Cache DJ data at module level
let djDataCache: Record<string, DJData> | null = null;

function readDJData(): Record<string, DJData> {
  if (djDataCache === null) {
    const filePath = path.join(process.cwd(), "data", "dj-data.json");
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      djDataCache = JSON.parse(raw);
    } catch {
      djDataCache = {};
    }
  }
  return djDataCache!;
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
    for (const dj of tape.djs) {
      if (dj.slug !== 'unknown') {
        slugs.add(dj.slug);
      }
    }
  }
  return Array.from(slugs).sort();
}

export function getDJ(slug: string): DJ | null {
  const djData = readDJData();
  
  for (const tape of readTapesFile()) {
    const match = tape.djs.find((dj) => dj.slug === slug);
    if (match) {
      return {
        name: match.name,
        slug,
        aka: djData[slug]?.aliases,
      };
    }
  }
  return null;
}

export function getDJDisplayName(slug: string): string {
  const dj = getDJ(slug);
  return dj?.name ?? slug;
}

/**
 * Get external links for a DJ (e.g. Discogs, SoundCloud)
 */
export function getDJLinks(slug: string): string[] {
  const djData = readDJData();
  return djData[slug]?.links || [];
}

/**
 * Get biography text for a DJ
 */
export function getDJBio(slug: string): string | null {
  const djData = readDJData();
  return djData[slug]?.bio || null;
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
      // Skip "unknown" DJs - they should not appear in the DJ index
      if (dj.slug === 'unknown') continue;
      
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

// Cache for archived comments
let archivedCommentsCache: Record<string, ArchivedComment[]> | null = null;

function readArchivedComments(): Record<string, ArchivedComment[]> {
  if (archivedCommentsCache === null) {
    const filePath = path.join(process.cwd(), "data", "tape-comments.json");
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      archivedCommentsCache = JSON.parse(raw);
    } catch (error) {
      // If file doesn't exist, return empty object
      archivedCommentsCache = {};
    }
  }
  return archivedCommentsCache!;
}

/**
 * Get archived comments for a tape (from original WordPress site)
 */
export function getCommentsForTape(tapeId: string): ArchivedComment[] {
  const allComments = readArchivedComments();
  return allComments[tapeId] || [];
}
