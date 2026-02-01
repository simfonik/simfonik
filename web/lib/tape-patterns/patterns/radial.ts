// Radial checkerboard mandala pattern

import type { WavePattern, ColorScheme, PatternConfig } from '../types';
import type { SeededRandom } from '../seed';
import { createGradient } from '../palettes';
import { capElements, gradientsEnabled, getMaxElements } from '../utils';

export const PATTERN_NAME = 'Radial Checkerboard';

export function generateRadialPattern(
  rng: SeededRandom,
  scheme: ColorScheme,
  config?: PatternConfig
): WavePattern {
  const gradients = [];
  const elements = [];
  const accentColor = scheme.colors[1];
  const baseOpacity = scheme.opacity || 1;
  const useGradient = gradientsEnabled(config) && rng.next() > 0.5;
  
  let fillColor = accentColor;
  if (useGradient) {
    const grad = createGradient('radial-grad', accentColor, rng);
    gradients.push(grad.gradient);
    fillColor = grad.url;
  }
  
  const centerX = 164.5;
  const centerY = 80.5;
  
  // Reduce from 40-120 to 30-60 rings for performance
  const rings = Math.floor(rng.range(30, 60));
  // Reduce from 16-64 to 12-32 segments
  const segments = Math.floor(rng.range(12, 32));
  const maxRadius = 250;
  const lineThickness = rng.range(0.3, 2.5);
  const fillPattern = Math.floor(rng.range(0, 4));
  
  for (let ring = 0; ring < rings; ring++) {
    const r1 = (ring / rings) * maxRadius;
    const r2 = ((ring + 1) / rings) * maxRadius;
    
    for (let seg = 0; seg < segments; seg++) {
      const a1 = (seg / segments) * Math.PI * 2;
      const a2 = ((seg + 1) / segments) * Math.PI * 2;
      
      const x1 = (centerX + Math.cos(a1) * r1).toFixed(1);
      const y1 = (centerY + Math.sin(a1) * r1).toFixed(1);
      const x2 = (centerX + Math.cos(a2) * r1).toFixed(1);
      const y2 = (centerY + Math.sin(a2) * r1).toFixed(1);
      const x3 = (centerX + Math.cos(a2) * r2).toFixed(1);
      const y3 = (centerY + Math.sin(a2) * r2).toFixed(1);
      const x4 = (centerX + Math.cos(a1) * r2).toFixed(1);
      const y4 = (centerY + Math.sin(a1) * r2).toFixed(1);
      
      const path = `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
      
      let filled = false;
      if (fillPattern === 0) filled = (ring + seg) % 2 === 0;
      else if (fillPattern === 1) filled = seg % 2 === 0;
      else if (fillPattern === 2) filled = ring % 2 === 0;
      else filled = (ring % 3 === 0 && seg % 2 === 0);
      
      elements.push({
        type: 'path' as const,
        d: path,
        stroke: accentColor,
        strokeWidth: lineThickness,
        fill: filled ? fillColor : 'none',
        opacity: filled ? (0.8 * baseOpacity) : (0.9 * baseOpacity),
      });
    }
  }
  
  // Cap elements deterministically
  const maxElements = getMaxElements(config);
  const cappedElements = capElements(elements, maxElements, rng);
  
  return { 
    gradients, 
    elements: cappedElements,
    backgroundColor: scheme.colors[0],
  };
}
