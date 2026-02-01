// Color schemes and gradient generation

import type { ColorScheme, GradientDef } from './types';
import type { SeededRandom } from './seed';

// Monochrome grayish white palette
export const COLOR_SCHEMES: ColorScheme[] = [
  { colors: ['#000000', '#d4d4d8'], name: 'gray-white', opacity: 0.8 },
];

export function createGradient(
  id: string,
  color: string,
  rng: SeededRandom
): { gradient: GradientDef; url: string } {
  const angle = rng.range(0, 360);
  const x1 = Math.cos((angle * Math.PI) / 180) * 50 + 50;
  const y1 = Math.sin((angle * Math.PI) / 180) * 50 + 50;
  const x2 = Math.cos(((angle + 180) * Math.PI) / 180) * 50 + 50;
  const y2 = Math.sin(((angle + 180) * Math.PI) / 180) * 50 + 50;
  
  const darkenAmount = rng.range(0.3, 0.7);
  
  return {
    gradient: {
      id,
      type: 'linear',
      x1: `${x1}%`,
      y1: `${y1}%`,
      x2: `${x2}%`,
      y2: `${y2}%`,
      stops: [
        { offset: '0%', color, opacity: 1 },
        { offset: '100%', color, opacity: darkenAmount },
      ],
    },
    url: `url(#${id})`,
  };
}
