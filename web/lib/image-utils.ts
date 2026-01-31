import type { Tape } from "../types/tape";

/**
 * Check if a tape cover should use optimized images
 */
export function hasOptimizedImages(tape: Tape): boolean {
  const cover = tape.images?.cover;
  return !!(cover && cover.includes('/media/') && cover.endsWith('.jpg'));
}

/**
 * Get optimized image srcset for responsive loading
 * Returns null for placeholders and non-optimized images
 */
export function getOptimizedSrcSet(tape: Tape): string | null {
  if (!hasOptimizedImages(tape)) {
    return null;
  }

  return [
    `/optimized/${tape.id}/400.webp 400w`,
    `/optimized/${tape.id}/800.webp 800w`,
    `/optimized/${tape.id}/1200.webp 1200w`,
  ].join(', ');
}

/**
 * Get default optimized image source (medium size)
 */
export function getOptimizedSrc(tape: Tape): string | null {
  if (!hasOptimizedImages(tape)) {
    return null;
  }

  return `/optimized/${tape.id}/800.webp`;
}
