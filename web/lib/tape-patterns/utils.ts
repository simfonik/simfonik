// Performance utilities and element capping

import type { PatternElement, PatternConfig } from './types';
import type { SeededRandom } from './seed';

const DEFAULT_MAX_ELEMENTS = 60;

/**
 * Thin element array to meet maxElements cap using deterministic sampling
 */
export function capElements(
  elements: PatternElement[],
  maxElements: number,
  rng: SeededRandom
): PatternElement[] {
  if (elements.length <= maxElements) {
    return elements;
  }
  
  // Deterministic thinning: sample every Nth element
  const step = elements.length / maxElements;
  const result: PatternElement[] = [];
  
  for (let i = 0; i < maxElements; i++) {
    const index = Math.floor(i * step);
    result.push(elements[index]);
  }
  
  return result;
}

/**
 * Simplify path by reducing point density (e.g., every 4px instead of every 2px)
 */
export function getPathStep(config?: PatternConfig): number {
  return config?.simplifyPaths !== false ? 4 : 2;
}

/**
 * Get effective max elements cap
 */
export function getMaxElements(config?: PatternConfig): number {
  return config?.maxElements ?? DEFAULT_MAX_ELEMENTS;
}

/**
 * Check if gradients are enabled
 */
export function gradientsEnabled(config?: PatternConfig): boolean {
  return config?.enableGradients ?? false;
}

/**
 * Validate element stays within label bounds (with 18px margins)
 */
export function isWithinBounds(x: number, y: number): boolean {
  return x >= 0 && x <= 337 && y >= 0 && y <= 161;
}
