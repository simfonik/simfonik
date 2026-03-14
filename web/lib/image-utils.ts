import type { Tape, TapeListSubset } from "../types/tape";

/**
 * Check if a tape cover should use optimized images
 */
export function hasOptimizedImages(tape: Tape | TapeListSubset): boolean {
  const cover = tape.images?.cover;
  return !!(cover && cover.includes('/media/') && cover.endsWith('.jpg'));
}
