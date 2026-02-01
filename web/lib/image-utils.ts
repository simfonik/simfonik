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

/**
 * Check if a side image should use optimized images
 */
export function hasOptimizedSideImage(sideImage: string | undefined): boolean {
  return !!(sideImage && sideImage.includes('/media/') && sideImage.endsWith('.jpg'));
}

/**
 * Get optimized side image path
 */
export function getOptimizedSideImagePath(tapeId: string, position: string, originalPath: string): {
  src: string;
  srcSet: string;
} | null {
  if (!originalPath.includes('/media/') || !originalPath.endsWith('.jpg')) {
    return null;
  }

  const pos = position.toLowerCase();
  return {
    src: `/optimized/${tapeId}/sides/${pos}/800.webp`,
    srcSet: [
      `/optimized/${tapeId}/sides/${pos}/400.webp 400w`,
      `/optimized/${tapeId}/sides/${pos}/800.webp 800w`,
      `/optimized/${tapeId}/sides/${pos}/1200.webp 1200w`,
    ].join(', '),
  };
}
