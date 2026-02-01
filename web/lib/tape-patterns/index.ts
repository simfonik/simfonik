// Main entry point for tape pattern generation with memoization

import type { WavePattern, PatternConfig } from './types';
import { hashString, SeededRandom } from './seed';
import { COLOR_SCHEMES } from './palettes';
import { generateSpiralPattern } from './patterns/spiral';
import { generateRadialPattern } from './patterns/radial';

// Re-export types
export type { WavePattern, PatternElement, GradientDef, PatternConfig } from './types';

// Server-side memoization cache (LRU with size cap)
const CACHE_SIZE = 100;
const patternCache = new Map<string, WavePattern>();

function addToCache(key: string, pattern: WavePattern): void {
  // Simple LRU: if at capacity, delete oldest (first) entry
  if (patternCache.size >= CACHE_SIZE) {
    const firstKey = patternCache.keys().next().value;
    if (firstKey) patternCache.delete(firstKey);
  }
  patternCache.set(key, pattern);
}

/**
 * Generate a deterministic tape label pattern
 * 
 * @param artistName - Artist/DJ name
 * @param tapeTitle - Mixtape title  
 * @param year - Release year (optional)
 * @param config - Performance and visual config
 * @returns Pattern with elements, gradients, and background color
 */
export function generateTapePattern(
  artistName: string,
  tapeTitle: string,
  year?: string,
  config?: PatternConfig
): WavePattern {
  // Create cache key
  const configKey = config ? JSON.stringify(config) : 'default';
  const cacheKey = `${artistName}::${tapeTitle}::${year || 'unknown'}::${configKey}`;
  
  // Check cache
  const cached = patternCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Generate pattern
  const seed = hashString(cacheKey);
  const rng = new SeededRandom(seed);
  
  // Pick color scheme (currently only 1)
  const scheme = COLOR_SCHEMES[seed % COLOR_SCHEMES.length];
  
  // Pick pattern (currently 2, will expand to 16)
  // TODO: Add remaining 14 pattern generators following same approach
  const patternIndex = Math.floor(seed / COLOR_SCHEMES.length) % 2;
  const generators = [
    generateRadialPattern,  // 1. Radial checkerboard mandala
    generateSpiralPattern,  // 2. Rotating spiral
    // TODO: Add remaining patterns here
    // generateStarburstPattern,
    // generateConcentricPattern,
    // etc.
  ];
  
  const pattern = generators[patternIndex](rng, scheme, config);
  
  // Add to cache
  addToCache(cacheKey, pattern);
  
  return pattern;
}

/**
 * Get pattern metadata for debugging
 */
export function getPatternMeta(
  artistName: string,
  tapeTitle: string,
  year?: string
): { name: string; elementCount: number; seed: number } {
  const pattern = generateTapePattern(artistName, tapeTitle, year);
  const seed = hashString(`${artistName}::${tapeTitle}::${year || 'unknown'}::default`);
  const patternIndex = Math.floor(seed / COLOR_SCHEMES.length) % 2;
  
  const names = ['Radial Checkerboard', 'Rotating Spiral'];
  
  return {
    name: names[patternIndex] || 'Unknown',
    elementCount: pattern.elements.length,
    seed,
  };
}

/**
 * Clear the pattern cache (useful for testing)
 */
export function clearPatternCache(): void {
  patternCache.clear();
}
