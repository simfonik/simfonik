import type { Tape, TapeListSubset } from "../types/tape";

// Source extensions that the build-time AVIF optimizer (scripts/
// optimize-images.mjs) processes. Keep in sync with that script.
const OPTIMIZABLE_EXT = /\.(jpg|jpeg|png)$/i;

/**
 * Whether a `/media/...` image path has corresponding AVIF variants
 * generated under `/optimized/...`. Returns false for paths outside
 * `/media/` or with extensions the optimizer doesn't process.
 */
export function isOptimizableImagePath(path: string | undefined | null): boolean {
  if (!path) return false;
  return path.includes('/media/') && OPTIMIZABLE_EXT.test(path);
}

/**
 * Check if a tape cover should use optimized images
 */
export function hasOptimizedImages(tape: Tape | TapeListSubset): boolean {
  return isOptimizableImagePath(tape.images?.cover);
}
