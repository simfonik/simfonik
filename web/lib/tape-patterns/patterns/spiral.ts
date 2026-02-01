// Rotating spiral pattern

import type { WavePattern, ColorScheme, PatternConfig } from '../types';
import type { SeededRandom } from '../seed';
import { createGradient } from '../palettes';
import { capElements, gradientsEnabled, getMaxElements } from '../utils';

export const PATTERN_NAME = 'Rotating Spiral';

export function generateSpiralPattern(
  rng: SeededRandom,
  scheme: ColorScheme,
  config?: PatternConfig
): WavePattern {
  const gradients = [];
  const elements = [];
  const accentColor = scheme.colors[1];
  const baseOpacity = scheme.opacity || 1;
  const useGradient = gradientsEnabled(config) && rng.next() > 0.5;
  
  let strokeColor = accentColor;
  if (useGradient) {
    const grad = createGradient('spiral-grad', accentColor, rng);
    gradients.push(grad.gradient);
    strokeColor = grad.url;
  }
  
  const centerX = 164.5;
  const centerY = 80.5;
  
  // Reduce ring count from 60-150 to 40-80 for performance
  const rings = Math.floor(rng.range(40, 80));
  const maxRadius = 250;
  const rotation = rng.range(0.03, 0.15);
  const lineThickness = rng.range(0.4, 3);
  
  for (let i = 0; i < rings; i++) {
    const radius = (i / rings) * maxRadius;
    const twist = i * rotation;
    const segments = 48; // Reduced from 64
    let path = '';
    
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2 + twist;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      path += j === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    
    elements.push({
      type: 'path' as const,
      d: path,
      stroke: strokeColor,
      strokeWidth: lineThickness,
      fill: 'none',
      opacity: 0.8 * baseOpacity,
    });
  }
  
  // Cap elements if needed
  const maxElements = getMaxElements(config);
  const cappedElements = capElements(elements, maxElements, rng);
  
  return { 
    gradients, 
    elements: cappedElements,
    backgroundColor: scheme.colors[0],
  };
}
