export type GradientDef = {
  id: string;
  type: 'linear';
  x1: string;
  y1: string;
  x2: string;
  y2: string;
  stops: { offset: string; color: string; opacity: number }[];
};

export type PatternElement = {
  type: 'path';
  d: string;
  stroke: string;
  strokeWidth: number;
  fill: string;
  opacity?: number;
};

export type WavePattern = {
  gradients: GradientDef[];
  elements: PatternElement[];
  backgroundColor: string;
};

// Color schemes - grayish white monochrome
const COLOR_SCHEMES = [
  { colors: ['#000000', '#d4d4d8'], name: 'gray-white', opacity: 0.8 },  // Grayish white
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  
  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// Helper to create gradients
function createGradient(id: string, color: string, rng: SeededRandom): { gradient: GradientDef; url: string } {
  const angle = rng.range(0, 360);
  const x1 = Math.cos((angle * Math.PI) / 180) * 50 + 50;
  const y1 = Math.sin((angle * Math.PI) / 180) * 50 + 50;
  const x2 = Math.cos(((angle + 180) * Math.PI) / 180) * 50 + 50;
  const y2 = Math.sin(((angle + 180) * Math.PI) / 180) * 50 + 50;
  
  // Lighten color for gradient end
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

function generateWavePattern1(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const gradients: GradientDef[] = [];
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Highly varied horizontal flowing waves
  const lineCount = Math.floor(rng.range(20, 80));
  const baseAmplitude = rng.range(8, 35);
  const baseFrequency = rng.range(0.015, 0.06);
  const phaseShift = rng.range(0.05, 0.25);
  const amplitudeVariation = rng.range(0.3, 2.0);
  
  for (let i = 0; i < lineCount; i++) {
    const y = (i / lineCount) * 161 + rng.range(-3, 3);
    const amplitude = baseAmplitude * rng.range(amplitudeVariation * 0.5, amplitudeVariation * 1.5);
    const frequency = baseFrequency * rng.range(0.8, 1.4);
    const phase = i * phaseShift + rng.range(0, Math.PI);
    
    let path = `M ${rng.range(-20, 20)} ${y}`;
    for (let x = 0; x <= 337; x += 2) {
      const offset = Math.sin(x * frequency + phase) * amplitude;
      path += ` L ${x} ${y + offset}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: rng.range(0.5, 1.2),
      fill: 'none',
      opacity: rng.range(0.5, 0.85),
    });
  }
  
  return { 
    gradients, 
    elements,
    backgroundColor: scheme.colors[0],
  };
}

function generateWavePattern2(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const gradients: GradientDef[] = [];
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Varied concentric shapes - circles or ellipses - FILLS ENTIRE LABEL
  const originX = rng.range(80, 250);
  const originY = rng.range(20, 140);
  const ringCount = Math.floor(rng.range(30, 100));
  const maxRadius = rng.range(180, 280); // Increased to ensure fill
  const elliptical = rng.next() > 0.5;
  const stretchX = elliptical ? rng.range(0.6, 1.8) : 1;
  const stretchY = elliptical ? rng.range(0.6, 1.8) : 1;
  
  for (let i = 0; i < ringCount; i++) {
    const radius = (i / ringCount) * maxRadius + rng.range(-2, 2);
    const segments = 64;
    let path = '';
    
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2;
      const x = originX + Math.cos(angle) * radius * stretchX;
      const y = originY + Math.sin(angle) * radius * stretchY;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: rng.range(0.5, 0.9),
      fill: 'none',
      opacity: rng.range(0.6, 0.85),
    });
  }
  
  return { 
    gradients, 
    elements,
    backgroundColor: scheme.colors[0],
  };
}

function generateWavePattern3(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const gradients: GradientDef[] = [];
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Highly varied distorted grid
  const gridSizeX = Math.floor(rng.range(12, 40));
  const gridSizeY = Math.floor(rng.range(8, 25));
  const warpIntensity = rng.range(5, 25);
  const warpFreqX = rng.range(0.008, 0.045);
  const warpFreqY = rng.range(0.01, 0.05);
  const warpStyle = Math.floor(rng.range(0, 3));
  const phaseOffsetX = rng.range(0, Math.PI * 2);
  const phaseOffsetY = rng.range(0, Math.PI * 2);
  
  // Horizontal grid lines with varied distortion
  for (let i = 0; i <= gridSizeY; i++) {
    const baseY = (i / gridSizeY) * 161;
    let path = '';
    for (let j = 0; j <= 100; j++) {
      const x = (j / 100) * 337;
      let warp;
      
      if (warpStyle === 0) {
        warp = Math.sin(x * warpFreqX + phaseOffsetX) * warpIntensity;
      } else if (warpStyle === 1) {
        warp = Math.sin(x * warpFreqX + phaseOffsetX) * warpIntensity + 
               Math.cos(x * warpFreqX * 2 + phaseOffsetY) * warpIntensity * 0.5;
      } else {
        warp = Math.sin(x * warpFreqX + baseY * 0.02) * warpIntensity * (1 + Math.sin(baseY * 0.05) * 0.5);
      }
      
      const y = baseY + warp;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: rng.range(0.5, 1),
      fill: 'none',
      opacity: rng.range(0.6, 0.85),
    });
  }
  
  // Vertical grid lines with varied distortion
  for (let i = 0; i <= gridSizeX; i++) {
    const baseX = (i / gridSizeX) * 337;
    let path = '';
    for (let j = 0; j <= 60; j++) {
      const y = (j / 60) * 161;
      let warp;
      
      if (warpStyle === 0) {
        warp = Math.sin(y * warpFreqY + phaseOffsetY) * warpIntensity;
      } else if (warpStyle === 1) {
        warp = Math.sin(y * warpFreqY + phaseOffsetY) * warpIntensity + 
               Math.cos(y * warpFreqY * 2 + phaseOffsetX) * warpIntensity * 0.5;
      } else {
        warp = Math.sin(y * warpFreqY + baseX * 0.02) * warpIntensity * (1 + Math.cos(baseX * 0.05) * 0.5);
      }
      
      const x = baseX + warp;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: rng.range(0.5, 1),
      fill: 'none',
      opacity: rng.range(0.6, 0.85),
    });
  }
  
  return { 
    gradients, 
    elements,
    backgroundColor: scheme.colors[0],
  };
}

function generateWavePattern4(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const gradients: GradientDef[] = [];
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Highly varied perspective grid with 3D depth
  const gridSizeX = Math.floor(rng.range(10, 35));
  const gridSizeY = Math.floor(rng.range(6, 20));
  const centerX = rng.range(120, 210);
  const centerY = rng.range(40, 120);
  const depth = rng.range(0.2, 0.9);
  const rotation = rng.range(-0.3, 0.3);
  
  // Horizontal lines with varied perspective
  for (let i = 0; i <= gridSizeY; i++) {
    const t = i / gridSizeY;
    const baseY = t * 161;
    const scale = 1 + (t - 0.5) * depth;
    
    let path = '';
    for (let j = 0; j <= 70; j++) {
      const u = j / 70;
      const offsetX = (u - 0.5) * 337 * scale;
      const x = centerX + offsetX * Math.cos(rotation) - (baseY - centerY) * Math.sin(rotation) * 0.2;
      const y = baseY + offsetX * Math.sin(rotation) * 0.1;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: rng.range(0.5, 0.9),
      fill: 'none',
      opacity: 0.5 + t * 0.35,
    });
  }
  
  // Vertical lines with varied perspective
  for (let i = 0; i <= gridSizeX; i++) {
    const u = i / gridSizeX;
    const baseX = u * 337;
    
    let path = '';
    for (let j = 0; j <= 50; j++) {
      const t = j / 50;
      const scale = 1 + (t - 0.5) * depth;
      const offsetX = (baseX - centerX) * scale;
      const x = centerX + offsetX * Math.cos(rotation);
      const y = t * 161 + offsetX * Math.sin(rotation) * 0.15;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: rng.range(0.5, 0.9),
      fill: 'none',
      opacity: rng.range(0.6, 0.8),
    });
  }
  
  return { 
    gradients, 
    elements,
    backgroundColor: scheme.colors[0],
  };
}

// Add more pattern variations for extreme uniqueness
function generateCheckerPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Distorted checkerboard (like green reference)
  const gridSize = Math.floor(rng.range(10, 20));
  const warpIntensity = rng.range(15, 35);
  const warpCenterX = rng.range(100, 230);
  const warpCenterY = rng.range(50, 110);
  
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < Math.floor(gridSize * 2); j++) {
      const baseX = (j / (gridSize * 2)) * 337;
      const baseY = (i / gridSize) * 161;
      const cellWidth = 337 / (gridSize * 2);
      const cellHeight = 161 / gridSize;
      
      // Calculate perspective/warp distortion
      const distX = (baseX + cellWidth / 2) - warpCenterX;
      const distY = (baseY + cellHeight / 2) - warpCenterY;
      const distance = Math.sqrt(distX * distX + distY * distY);
      const warpFactor = Math.sin(distance * 0.02) * warpIntensity;
      
      const points: [number, number][] = [
        [baseX, baseY],
        [baseX + cellWidth, baseY],
        [baseX + cellWidth, baseY + cellHeight],
        [baseX, baseY + cellHeight],
      ];
      
      // Apply distortion to each corner
      const warpedPoints = points.map(([x, y]) => {
        const dx = x - warpCenterX;
        const dy = y - warpCenterY;
        const d = Math.sqrt(dx * dx + dy * dy);
        const warp = Math.sin(d * 0.025) * warpIntensity;
        const angle = Math.atan2(dy, dx);
        return [
          x + Math.cos(angle) * warp,
          y + Math.sin(angle) * warp,
        ];
      });
      
      const pathStr = `M ${warpedPoints[0][0]} ${warpedPoints[0][1]} L ${warpedPoints[1][0]} ${warpedPoints[1][1]} L ${warpedPoints[2][0]} ${warpedPoints[2][1]} L ${warpedPoints[3][0]} ${warpedPoints[3][1]} Z`;
      
      elements.push({
        type: 'path',
        d: pathStr,
        stroke: accentColor,
        strokeWidth: 0.6,
        fill: (i + j) % 2 === 0 ? accentColor : 'none',
        opacity: (i + j) % 2 === 0 ? 0.15 : 0.7,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateRadialBurst(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Radial lines bursting from center
  const originX = rng.range(100, 230);
  const originY = rng.range(50, 110);
  const rayCount = Math.floor(rng.range(40, 120));
  const innerRadius = rng.range(10, 30);
  const outerRadius = rng.range(150, 250);
  
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const x1 = originX + Math.cos(angle) * innerRadius;
    const y1 = originY + Math.sin(angle) * innerRadius;
    const x2 = originX + Math.cos(angle) * outerRadius;
    const y2 = originY + Math.sin(angle) * outerRadius;
    
    elements.push({
      type: 'path',
      d: `M ${x1} ${y1} L ${x2} ${y2}`,
      stroke: accentColor,
      strokeWidth: rng.range(0.4, 0.8),
      fill: 'none',
      opacity: rng.range(0.4, 0.75),
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateSpiralPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Rotating spiral (like pink spiral in reference) - FILLS ENTIRE LABEL
  const originX = rng.range(80, 250);
  const originY = rng.range(20, 140);
  const spiralCount = Math.floor(rng.range(30, 80));
  const maxRadius = rng.range(200, 300); // Increased to fill space
  const rotation = rng.range(0.05, 0.25); // Rotation per ring
  
  for (let i = 0; i < spiralCount; i++) {
    const radius = (i / spiralCount) * maxRadius;
    const baseRotation = i * rotation;
    const segments = 64;
    let path = '';
    
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2 + baseRotation;
      const x = originX + Math.cos(angle) * radius;
      const y = originY + Math.sin(angle) * radius;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: rng.range(0.6, 1),
      fill: 'none',
      opacity: rng.range(0.6, 0.85),
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateTwistedBurst(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Twisted spiral burst (like cyan/pink twisted burst) - FILLS ENTIRE LABEL
  const originX = rng.range(80, 250);
  const originY = rng.range(20, 140);
  const armCount = Math.floor(rng.range(4, 12));
  const twistIntensity = rng.range(0.5, 2);
  const maxRadius = rng.range(220, 340); // Increased to fill space
  
  for (let arm = 0; arm < armCount; arm++) {
    const baseAngle = (arm / armCount) * Math.PI * 2;
    let path = `M ${originX} ${originY}`;
    
    for (let i = 1; i <= 50; i++) {
      const t = i / 50;
      const radius = t * maxRadius;
      const twist = Math.sin(t * Math.PI * twistIntensity) * 0.5;
      const angle = baseAngle + twist;
      const x = originX + Math.cos(angle) * radius;
      const y = originY + Math.sin(angle) * radius;
      path += ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: rng.range(1, 2.5),
      fill: 'none',
      opacity: rng.range(0.5, 0.8),
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generatePerspectiveCheckerboard(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Checkerboard with strong perspective vanishing to center
  const vanishX = rng.range(140, 190);
  const vanishY = rng.range(70, 90);
  const gridSize = Math.floor(rng.range(8, 16));
  
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize * 2; col++) {
      // Calculate corners in a grid
      const u1 = col / (gridSize * 2);
      const u2 = (col + 1) / (gridSize * 2);
      const v1 = row / gridSize;
      const v2 = (row + 1) / gridSize;
      
      // Apply perspective transformation
      const scale1 = 0.3 + v1 * 0.7;
      const scale2 = 0.3 + v2 * 0.7;
      
      const x1 = vanishX + (u1 - 0.5) * 337 * scale1;
      const x2 = vanishX + (u2 - 0.5) * 337 * scale1;
      const x3 = vanishX + (u2 - 0.5) * 337 * scale2;
      const x4 = vanishX + (u1 - 0.5) * 337 * scale2;
      
      const y1 = vanishY + (v1 - 0.5) * 161 * scale1;
      const y2 = vanishY + (v1 - 0.5) * 161 * scale1;
      const y3 = vanishY + (v2 - 0.5) * 161 * scale2;
      const y4 = vanishY + (v2 - 0.5) * 161 * scale2;
      
      const pathStr = `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
      const filled = (row + col) % 2 === 0;
      
      elements.push({
        type: 'path',
        d: pathStr,
        stroke: accentColor,
        strokeWidth: 0.6,
        fill: filled ? accentColor : 'none',
        opacity: filled ? 0.2 : 0.7,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateRandomCheckerboard(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Random-sized checkerboard cells with noise
  const baseGridSize = Math.floor(rng.range(10, 18));
  const cellWidth = 337 / baseGridSize;
  const cellHeight = 161 / (baseGridSize * 0.5);
  
  for (let row = 0; row < baseGridSize * 0.5; row++) {
    for (let col = 0; col < baseGridSize; col++) {
      const x = col * cellWidth + rng.range(-cellWidth * 0.2, cellWidth * 0.2);
      const y = row * cellHeight + rng.range(-cellHeight * 0.2, cellHeight * 0.2);
      const w = cellWidth * rng.range(0.8, 1.2);
      const h = cellHeight * rng.range(0.8, 1.2);
      
      const pathStr = `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
      const filled = rng.next() > 0.5;
      
      elements.push({
        type: 'path',
        d: pathStr,
        stroke: accentColor,
        strokeWidth: 0.6,
        fill: filled ? accentColor : 'none',
        opacity: filled ? 0.25 : 0.7,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateConcentricSquares(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Concentric squares/rectangles
  const originX = rng.range(140, 190);
  const originY = rng.range(70, 90);
  const layerCount = Math.floor(rng.range(30, 60));
  const maxSize = rng.range(180, 280);
  const aspectRatio = rng.range(0.6, 1.8);
  
  for (let i = 0; i < layerCount; i++) {
    const size = (i / layerCount) * maxSize;
    const w = size;
    const h = size * aspectRatio;
    const x = originX - w / 2;
    const y = originY - h / 2;
    
    const pathStr = `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    
    elements.push({
      type: 'path',
      d: pathStr,
      stroke: accentColor,
      strokeWidth: rng.range(0.5, 0.9),
      fill: 'none',
      opacity: rng.range(0.6, 0.85),
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateRotatingRadialBurst(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Radial burst with rotation creating twist effect - FILLS ENTIRE LABEL
  const originX = rng.range(80, 250);
  const originY = rng.range(20, 140);
  const segmentCount = Math.floor(rng.range(8, 24));
  const layers = Math.floor(rng.range(20, 40));
  const maxRadius = rng.range(220, 320); // Increased to fill space
  
  for (let i = 0; i < layers; i++) {
    const radiusInner = (i / layers) * maxRadius;
    const radiusOuter = ((i + 1) / layers) * maxRadius;
    const rotation = i * rng.range(0.02, 0.1);
    
    for (let seg = 0; seg < segmentCount; seg++) {
      if (seg % 2 === 0) continue; // Alternating segments
      
      const angle1 = (seg / segmentCount) * Math.PI * 2 + rotation;
      const angle2 = ((seg + 1) / segmentCount) * Math.PI * 2 + rotation;
      
      const x1 = originX + Math.cos(angle1) * radiusInner;
      const y1 = originY + Math.sin(angle1) * radiusInner;
      const x2 = originX + Math.cos(angle2) * radiusInner;
      const y2 = originY + Math.sin(angle2) * radiusInner;
      const x3 = originX + Math.cos(angle2) * radiusOuter;
      const y3 = originY + Math.sin(angle2) * radiusOuter;
      const x4 = originX + Math.cos(angle1) * radiusOuter;
      const y4 = originY + Math.sin(angle1) * radiusOuter;
      
      const path = `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: 0.5,
        fill: accentColor,
        opacity: 0.3,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateConvergingSpiral(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Tightening spiral that converges to center - FILLS ENTIRE LABEL
  const originX = rng.range(80, 250);
  const originY = rng.range(20, 140);
  const armCount = Math.floor(rng.range(3, 8));
  const rotations = rng.range(3, 8);
  
  for (let arm = 0; arm < armCount; arm++) {
    const startAngle = (arm / armCount) * Math.PI * 2;
    let path = '';
    
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const radius = (1 - t) * rng.range(200, 320); // Converging inward - increased radius
      const angle = startAngle + t * rotations * Math.PI * 2;
      const x = originX + Math.cos(angle) * radius;
      const y = originY + Math.sin(angle) * radius;
      path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: rng.range(1.5, 3),
      fill: 'none',
      opacity: 0.7,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateDivergingSpiral(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Expanding spiral from center outward - FILLS ENTIRE LABEL
  const originX = rng.range(80, 250);
  const originY = rng.range(20, 140);
  const armCount = Math.floor(rng.range(3, 10));
  const rotations = rng.range(4, 10);
  
  for (let arm = 0; arm < armCount; arm++) {
    const startAngle = (arm / armCount) * Math.PI * 2;
    let path = '';
    
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const radius = t * rng.range(220, 340); // Expanding outward - increased radius
      const angle = startAngle + t * rotations * Math.PI * 2;
      const x = originX + Math.cos(angle) * radius;
      const y = originY + Math.sin(angle) * radius;
      path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: rng.range(1.5, 3),
      fill: 'none',
      opacity: 0.7,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateCheckerboardSpiral(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Checkerboard pattern that spirals inward - FILLS ENTIRE LABEL
  const originX = rng.range(80, 250);
  const originY = rng.range(20, 140);
  const layers = Math.floor(rng.range(25, 50));
  const segmentsPerLayer = Math.floor(rng.range(16, 32));
  const maxRadius = rng.range(220, 320); // Increased to fill space
  
  for (let layer = 0; layer < layers; layer++) {
    const radiusInner = (layer / layers) * maxRadius;
    const radiusOuter = ((layer + 1) / layers) * maxRadius;
    const rotation = layer * rng.range(0.03, 0.08);
    
    for (let seg = 0; seg < segmentsPerLayer; seg++) {
      const angle1 = (seg / segmentsPerLayer) * Math.PI * 2 + rotation;
      const angle2 = ((seg + 1) / segmentsPerLayer) * Math.PI * 2 + rotation;
      
      const x1 = originX + Math.cos(angle1) * radiusInner;
      const y1 = originY + Math.sin(angle1) * radiusInner;
      const x2 = originX + Math.cos(angle2) * radiusInner;
      const y2 = originY + Math.sin(angle2) * radiusInner;
      const x3 = originX + Math.cos(angle2) * radiusOuter;
      const y3 = originY + Math.sin(angle2) * radiusOuter;
      const x4 = originX + Math.cos(angle1) * radiusOuter;
      const y4 = originY + Math.sin(angle1) * radiusOuter;
      
      const path = `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
      const filled = (layer + seg) % 2 === 0;
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: 0.4,
        fill: filled ? accentColor : 'none',
        opacity: filled ? 0.4 : 0.7,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateTwistedCheckerboard(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Grid that twists around center point
  const centerX = rng.range(140, 190);
  const centerY = rng.range(70, 90);
  const gridSize = Math.floor(rng.range(12, 20));
  const twistIntensity = rng.range(0.5, 2);
  
  for (let row = 0; row < gridSize * 0.6; row++) {
    for (let col = 0; col < gridSize; col++) {
      const x = (col / gridSize) * 337;
      const y = (row / (gridSize * 0.6)) * 161;
      const cellW = 337 / gridSize;
      const cellH = 161 / (gridSize * 0.6);
      
      // Calculate twist based on distance from center
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const twist = Math.sin(dist * 0.02) * twistIntensity * 15;
      
      // Apply rotation to corners
      const corners = [
        [x, y], [x + cellW, y], [x + cellW, y + cellH], [x, y + cellH]
      ];
      
      const rotatedCorners = corners.map(([px, py]) => {
        const pdx = px - centerX;
        const pdy = py - centerY;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        const pangle = Math.atan2(pdy, pdx) + (twist * Math.PI / 180);
        return [
          centerX + Math.cos(pangle) * pdist,
          centerY + Math.sin(pangle) * pdist
        ];
      });
      
      const path = `M ${rotatedCorners[0][0]} ${rotatedCorners[0][1]} L ${rotatedCorners[1][0]} ${rotatedCorners[1][1]} L ${rotatedCorners[2][0]} ${rotatedCorners[2][1]} L ${rotatedCorners[3][0]} ${rotatedCorners[3][1]} Z`;
      const filled = (row + col) % 2 === 0;
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: 0.5,
        fill: filled ? accentColor : 'none',
        opacity: filled ? 0.35 : 0.7,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateWaveSpiral(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Spiral with wavy edges - FILLS ENTIRE LABEL
  const originX = rng.range(80, 250);
  const originY = rng.range(20, 140);
  const layers = Math.floor(rng.range(40, 80));
  const maxRadius = rng.range(200, 300); // Increased to fill space
  const waveFreq = rng.range(8, 20);
  const waveAmp = rng.range(3, 8);
  
  for (let i = 0; i < layers; i++) {
    const baseRadius = (i / layers) * maxRadius;
    const rotation = i * rng.range(0.05, 0.15);
    const segments = 64;
    let path = '';
    
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2 + rotation;
      const wave = Math.sin(j / segments * waveFreq * Math.PI * 2) * waveAmp;
      const radius = baseRadius + wave;
      const x = originX + Math.cos(angle) * radius;
      const y = originY + Math.sin(angle) * radius;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: rng.range(0.6, 1),
      fill: 'none',
      opacity: 0.7,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generatePolygonSpiral(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Concentric polygons with rotation - FILLS ENTIRE LABEL
  const originX = rng.range(80, 250);
  const originY = rng.range(20, 140);
  const sides = Math.floor(rng.range(5, 12));
  const layers = Math.floor(rng.range(30, 60));
  const maxRadius = rng.range(200, 300); // Increased to fill space
  const rotationPerLayer = rng.range(0.02, 0.1);
  
  for (let i = 0; i < layers; i++) {
    const radius = (i / layers) * maxRadius;
    const rotation = i * rotationPerLayer;
    let path = '';
    
    for (let j = 0; j <= sides; j++) {
      const angle = (j / sides) * Math.PI * 2 + rotation;
      const x = originX + Math.cos(angle) * radius;
      const y = originY + Math.sin(angle) * radius;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: rng.range(0.6, 1),
      fill: 'none',
      opacity: 0.7,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateStarBurst(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Star pattern radiating from center - FILLS ENTIRE LABEL
  const originX = rng.range(80, 250);
  const originY = rng.range(20, 140);
  const points = Math.floor(rng.range(5, 16));
  const layers = Math.floor(rng.range(20, 40));
  const maxRadius = rng.range(220, 320); // Increased to fill space
  
  for (let layer = 0; layer < layers; layer++) {
    const radiusOuter = ((layer + 1) / layers) * maxRadius;
    const radiusInner = (layer / layers) * maxRadius;
    
    for (let i = 0; i < points * 2; i++) {
      const angle1 = (i / (points * 2)) * Math.PI * 2;
      const angle2 = ((i + 1) / (points * 2)) * Math.PI * 2;
      const r1 = i % 2 === 0 ? radiusOuter : radiusInner;
      const r2 = (i + 1) % 2 === 0 ? radiusOuter : radiusInner;
      
      const x1 = originX + Math.cos(angle1) * r1;
      const y1 = originY + Math.sin(angle1) * r1;
      const x2 = originX + Math.cos(angle2) * r2;
      const y2 = originY + Math.sin(angle2) * r2;
      
      if (layer > 0) {
        const prevR1 = i % 2 === 0 ? radiusInner : ((layer - 1) / layers) * maxRadius;
        const x0 = originX + Math.cos(angle1) * prevR1;
        const y0 = originY + Math.sin(angle1) * prevR1;
        
        const path = `M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2} Z`;
        const filled = i % 2 === 0;
        
        elements.push({
          type: 'path',
          d: path,
          stroke: accentColor,
          strokeWidth: 0.5,
          fill: filled ? accentColor : 'none',
          opacity: filled ? 0.3 : 0.7,
        });
      }
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateHypnoticCircles(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Alternating filled/empty circles - FILLS ENTIRE LABEL
  const originX = rng.range(80, 250);
  const originY = rng.range(20, 140);
  const rings = Math.floor(rng.range(25, 50));
  const maxRadius = rng.range(200, 300); // Increased to fill space
  
  for (let i = rings - 1; i >= 0; i--) {
    const radiusOuter = ((i + 1) / rings) * maxRadius;
    const radiusInner = (i / rings) * maxRadius;
    const filled = i % 2 === 0;
    
    if (filled && i < rings - 1) {
      // Create ring shape
      const segments = 64;
      let pathOuter = '';
      let pathInner = '';
      
      for (let j = 0; j <= segments; j++) {
        const angle = (j / segments) * Math.PI * 2;
        const xo = originX + Math.cos(angle) * radiusOuter;
        const yo = originY + Math.sin(angle) * radiusOuter;
        const xi = originX + Math.cos(angle) * radiusInner;
        const yi = originY + Math.sin(angle) * radiusInner;
        
        pathOuter += j === 0 ? `M ${xo} ${yo}` : ` L ${xo} ${yo}`;
        pathInner = `M ${xi} ${yi}` + pathInner;
      }
      
      elements.push({
        type: 'path',
        d: pathOuter + ' ' + pathInner + ' Z',
        stroke: 'none',
        strokeWidth: 0,
        fill: accentColor,
        opacity: 0.9,
      });
    }
    
    // Draw circle outline
    const segments = 64;
    let path = '';
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2;
      const x = originX + Math.cos(angle) * radiusOuter;
      const y = originY + Math.sin(angle) * radiusOuter;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: 0.6,
      fill: 'none',
      opacity: 0.8,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateMoirePattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Overlapping circle grids creating moiré effect
  const spacing = rng.range(12, 25);
  const radius = rng.range(8, 18);
  const offset = rng.range(5, 15);
  
  for (let y = -radius; y < 161 + radius; y += spacing) {
    for (let x = -radius; x < 337 + radius; x += spacing) {
      const segments = 32;
      let path = '';
      
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        path += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
      }
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: 0.8,
        fill: 'none',
        opacity: 0.4,
      });
    }
  }
  
  // Second overlapping grid
  for (let y = -radius + offset; y < 161 + radius; y += spacing) {
    for (let x = -radius + offset; x < 337 + radius; x += spacing) {
      const segments = 32;
      let path = '';
      
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        path += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
      }
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: 0.8,
        fill: 'none',
        opacity: 0.4,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateDiamondPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Diamond/rhombus grid with perspective
  const gridSize = Math.floor(rng.range(8, 16));
  const centerX = rng.range(140, 190);
  const centerY = rng.range(70, 90);
  const skew = rng.range(0.3, 0.8);
  
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize * 1.5; col++) {
      const x = (col - gridSize * 0.75) * (337 / (gridSize * 1.5));
      const y = (row - gridSize * 0.5) * (161 / gridSize);
      
      // Diamond points
      const size = 337 / (gridSize * 1.5);
      const halfSize = size / 2;
      
      // Apply perspective distortion
      const dx = x / 337 - 0.5;
      const dy = y / 161 - 0.5;
      const scale = 1 + Math.sqrt(dx * dx + dy * dy) * 0.3;
      
      const points = [
        [centerX + x, centerY + y - halfSize * scale],
        [centerX + x + halfSize * scale * skew, centerY + y],
        [centerX + x, centerY + y + halfSize * scale],
        [centerX + x - halfSize * scale * skew, centerY + y],
      ];
      
      const path = `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]} L ${points[2][0]} ${points[2][1]} L ${points[3][0]} ${points[3][1]} Z`;
      const filled = (row + col) % 2 === 0;
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: 0.6,
        fill: filled ? accentColor : 'none',
        opacity: filled ? 0.3 : 0.7,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateSquareTunnel(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Alternating square tunnel perspective
  const vanishX = rng.range(140, 190);
  const vanishY = rng.range(70, 90);
  const layers = Math.floor(rng.range(30, 60));
  
  for (let i = layers - 1; i >= 0; i--) {
    const scale = (i / layers);
    const size = rng.range(200, 300) * scale;
    const x = vanishX - size / 2;
    const y = vanishY - size / 2 * rng.range(0.4, 0.7);
    const filled = i % 2 === 0;
    
    const path = `M ${x} ${y} L ${x + size} ${y} L ${x + size} ${y + size * 0.6} L ${x} ${y + size * 0.6} Z`;
    
    if (filled) {
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: 0.5,
        fill: accentColor,
        opacity: 0.5,
      });
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: 0.8,
      fill: 'none',
      opacity: 0.8,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateCurvedRays(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Curved rays emanating from center
  const originX = rng.range(140, 190);
  const originY = rng.range(70, 90);
  const rayCount = Math.floor(rng.range(16, 40));
  const curvature = rng.range(0.3, 1.2);
  
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const controlDist = rng.range(80, 150);
    const endDist = rng.range(150, 250);
    
    // Start point
    const x1 = originX + Math.cos(angle) * 10;
    const y1 = originY + Math.sin(angle) * 10;
    
    // Control point (creates curve)
    const controlAngle = angle + curvature;
    const cx = originX + Math.cos(controlAngle) * controlDist;
    const cy = originY + Math.sin(controlAngle) * controlDist;
    
    // End point
    const x2 = originX + Math.cos(angle + curvature * 0.5) * endDist;
    const y2 = originY + Math.sin(angle + curvature * 0.5) * endDist;
    
    const path = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: rng.range(1, 2.5),
      fill: 'none',
      opacity: 0.6,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateInterlockingCircles(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Grid of overlapping circles
  const spacing = rng.range(25, 45);
  const radius = spacing * rng.range(0.6, 0.9);
  
  for (let y = -radius; y < 161 + radius; y += spacing) {
    for (let x = -radius; x < 337 + radius; x += spacing) {
      const segments = 48;
      let path = '';
      
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        path += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
      }
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: rng.range(1, 2),
        fill: 'none',
        opacity: 0.5,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generatePsychedelicWaves(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Multiple overlapping wave patterns
  const waveCount = Math.floor(rng.range(3, 8));
  
  for (let w = 0; w < waveCount; w++) {
    const lineCount = Math.floor(rng.range(20, 40));
    const amplitude = rng.range(15, 35);
    const frequency = rng.range(0.015, 0.04);
    const phase = w * Math.PI / 3;
    const angle = (w / waveCount) * Math.PI / 6; // Slight angle variation
    
    for (let i = 0; i < lineCount; i++) {
      const t = i / lineCount;
      let path = '';
      
      for (let x = 0; x <= 337; x += 3) {
        const y = t * 161 + Math.sin(x * frequency + phase) * amplitude;
        // Apply rotation
        const rx = x * Math.cos(angle) - y * Math.sin(angle) + 50;
        const ry = x * Math.sin(angle) + y * Math.cos(angle);
        path += x === 0 ? `M ${rx} ${ry}` : ` L ${rx} ${ry}`;
      }
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: 0.7,
        fill: 'none',
        opacity: 0.4,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateVortex(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Swirling vortex pattern - FILLS ENTIRE LABEL
  const originX = rng.range(80, 250);
  const originY = rng.range(20, 140);
  const spirals = Math.floor(rng.range(5, 12));
  const density = Math.floor(rng.range(40, 80));
  
  for (let s = 0; s < spirals; s++) {
    const startAngle = (s / spirals) * Math.PI * 2;
    
    for (let i = 0; i < density; i++) {
      const t = i / density;
      const radius = t * rng.range(180, 280); // Increased radius
      const rotation = t * rng.range(3, 7) * Math.PI;
      const angle = startAngle + rotation;
      
      const x = originX + Math.cos(angle) * radius;
      const y = originY + Math.sin(angle) * radius;
      const size = rng.range(2, 6) * (1 - t * 0.5);
      
      // Small circle at this point
      const segments = 16;
      let path = '';
      for (let j = 0; j <= segments; j++) {
        const a = (j / segments) * Math.PI * 2;
        const px = x + Math.cos(a) * size;
        const py = y + Math.sin(a) * size;
        path += j === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
      }
      
      elements.push({
        type: 'path',
        d: path,
        stroke: 'none',
        strokeWidth: 0,
        fill: accentColor,
        opacity: 0.6,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateRadialCheckerboard(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Radial checkerboard (like center image in reference) - FILLS ENTIRE LABEL
  const originX = rng.range(80, 250);
  const originY = rng.range(20, 140);
  const rings = Math.floor(rng.range(15, 30));
  const segments = Math.floor(rng.range(24, 48));
  const maxRadius = rng.range(200, 300); // Increased to fill space
  
  for (let ring = 0; ring < rings; ring++) {
    const r1 = (ring / rings) * maxRadius;
    const r2 = ((ring + 1) / rings) * maxRadius;
    
    for (let seg = 0; seg < segments; seg++) {
      const a1 = (seg / segments) * Math.PI * 2;
      const a2 = ((seg + 1) / segments) * Math.PI * 2;
      
      const x1 = originX + Math.cos(a1) * r1;
      const y1 = originY + Math.sin(a1) * r1;
      const x2 = originX + Math.cos(a2) * r1;
      const y2 = originY + Math.sin(a2) * r1;
      const x3 = originX + Math.cos(a2) * r2;
      const y3 = originY + Math.sin(a2) * r2;
      const x4 = originX + Math.cos(a1) * r2;
      const y4 = originY + Math.sin(a1) * r2;
      
      const path = `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
      const filled = (ring + seg) % 2 === 0;
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: 0.4,
        fill: filled ? accentColor : 'none',
        opacity: filled ? 0.9 : 0.8,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateOpArtWaves(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Op-art style undulating bands
  const bands = Math.floor(rng.range(30, 60));
  const waveAmp = rng.range(20, 40);
  const waveFreq = rng.range(0.02, 0.05);
  const direction = rng.next() > 0.5 ? 'horizontal' : 'vertical';
  
  for (let i = 0; i < bands; i++) {
    const filled = i % 2 === 0;
    let path1 = '', path2 = '';
    
    if (direction === 'horizontal') {
      const y1 = (i / bands) * 161;
      const y2 = ((i + 1) / bands) * 161;
      
      // Top edge
      for (let x = 0; x <= 337; x += 2) {
        const wave = Math.sin(x * waveFreq + i * 0.3) * waveAmp;
        path1 += x === 0 ? `M ${x} ${y1 + wave}` : ` L ${x} ${y1 + wave}`;
      }
      
      // Bottom edge (reverse direction)
      for (let x = 337; x >= 0; x -= 2) {
        const wave = Math.sin(x * waveFreq + i * 0.3) * waveAmp;
        path1 += ` L ${x} ${y2 + wave}`;
      }
      
      path1 += ' Z';
    } else {
      const x1 = (i / bands) * 337;
      const x2 = ((i + 1) / bands) * 337;
      
      // Left edge
      for (let y = 0; y <= 161; y += 2) {
        const wave = Math.sin(y * waveFreq * 1.5 + i * 0.3) * waveAmp;
        path1 += y === 0 ? `M ${x1 + wave} ${y}` : ` L ${x1 + wave} ${y}`;
      }
      
      // Right edge (reverse)
      for (let y = 161; y >= 0; y -= 2) {
        const wave = Math.sin(y * waveFreq * 1.5 + i * 0.3) * waveAmp;
        path1 += ` L ${x2 + wave} ${y}`;
      }
      
      path1 += ' Z';
    }
    
    elements.push({
      type: 'path',
      d: path1,
      stroke: filled ? 'none' : accentColor,
      strokeWidth: 0.6,
      fill: filled ? accentColor : 'none',
      opacity: filled ? 0.9 : 0.7,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateZigZagPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Zigzag chevron pattern
  const rows = Math.floor(rng.range(15, 30));
  const cols = Math.floor(rng.range(20, 40));
  const amplitude = rng.range(8, 18);
  
  for (let row = 0; row < rows; row++) {
    const y = (row / rows) * 161;
    const nextY = ((row + 1) / rows) * 161;
    
    for (let col = 0; col < cols; col++) {
      const x = (col / cols) * 337;
      const nextX = ((col + 1) / cols) * 337;
      const midX = (x + nextX) / 2;
      
      const direction = col % 2 === 0 ? 1 : -1;
      
      const path = `M ${x} ${y} L ${midX} ${y + amplitude * direction} L ${nextX} ${y} L ${nextX} ${nextY} L ${midX} ${nextY - amplitude * direction} L ${x} ${nextY} Z`;
      const filled = (row + col) % 2 === 0;
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: 0.5,
        fill: filled ? accentColor : 'none',
        opacity: filled ? 0.4 : 0.7,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateTriangleSpiral(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  // Triangular spiral pattern - FILLS ENTIRE LABEL
  const originX = rng.range(80, 250);
  const originY = rng.range(20, 140);
  const triangles = Math.floor(rng.range(60, 120));
  const maxRadius = rng.range(200, 300); // Increased to fill space
  const rotationSpeed = rng.range(0.1, 0.3);
  
  for (let i = 0; i < triangles; i++) {
    const t = i / triangles;
    const radius = t * maxRadius;
    const angle = t * Math.PI * 2 * rng.range(3, 7) + i * rotationSpeed;
    const size = rng.range(4, 10) * (1 - t * 0.4);
    
    // Triangle vertices
    const x1 = originX + Math.cos(angle) * radius;
    const y1 = originY + Math.sin(angle) * radius;
    const x2 = x1 + Math.cos(angle + Math.PI * 2 / 3) * size;
    const y2 = y1 + Math.sin(angle + Math.PI * 2 / 3) * size;
    const x3 = x1 + Math.cos(angle - Math.PI * 2 / 3) * size;
    const y3 = y1 + Math.sin(angle - Math.PI * 2 / 3) * size;
    
    const path = `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} Z`;
    const filled = i % 3 === 0;
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: 0.6,
      fill: filled ? accentColor : 'none',
      opacity: filled ? 0.5 : 0.7,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

// Simplified pattern generator - just 8 core optical illusion/mandala patterns
function generateSimpleRadialPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const gradients: GradientDef[] = [];
  const accentColor = scheme.colors[1];
  const baseOpacity = scheme.opacity || 1;
  const useGradient = rng.next() > 0.5;
  
  let fillColor = accentColor;
  if (useGradient) {
    const grad = createGradient('radial-grad', accentColor, rng);
    gradients.push(grad.gradient);
    fillColor = grad.url;
  }
  
  const centerX = 164.5;
  const centerY = 80.5;
  const rings = Math.floor(rng.range(40, 120));
  const segments = Math.floor(rng.range(16, 64));
  const maxRadius = 250;
  const lineThickness = rng.range(0.3, 2.5);
  const fillPattern = Math.floor(rng.range(0, 4)); // Different fill patterns
  
  for (let ring = 0; ring < rings; ring++) {
    const r1 = (ring / rings) * maxRadius;
    const r2 = ((ring + 1) / rings) * maxRadius;
    
    for (let seg = 0; seg < segments; seg++) {
      const a1 = (seg / segments) * Math.PI * 2;
      const a2 = ((seg + 1) / segments) * Math.PI * 2;
      
      const x1 = centerX + Math.cos(a1) * r1;
      const y1 = centerY + Math.sin(a1) * r1;
      const x2 = centerX + Math.cos(a2) * r1;
      const y2 = centerY + Math.sin(a2) * r1;
      const x3 = centerX + Math.cos(a2) * r2;
      const y3 = centerY + Math.sin(a2) * r2;
      const x4 = centerX + Math.cos(a1) * r2;
      const y4 = centerY + Math.sin(a1) * r2;
      
      const path = `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
      
      let filled = false;
      if (fillPattern === 0) filled = (ring + seg) % 2 === 0;
      else if (fillPattern === 1) filled = seg % 2 === 0;
      else if (fillPattern === 2) filled = ring % 2 === 0;
      else filled = (ring % 3 === 0 && seg % 2 === 0);
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: lineThickness,
        fill: filled ? fillColor : 'none',
        opacity: filled ? (0.8 * baseOpacity) : (0.9 * baseOpacity),
      });
    }
  }
  
  return { gradients, elements, backgroundColor: scheme.colors[0] };
}

function generateSimpleSpiralPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const gradients: GradientDef[] = [];
  const accentColor = scheme.colors[1];
  const baseOpacity = scheme.opacity || 1;
  const useGradient = rng.next() > 0.5;
  
  let strokeColor = accentColor;
  if (useGradient) {
    const grad = createGradient('spiral-grad', accentColor, rng);
    gradients.push(grad.gradient);
    strokeColor = grad.url;
  }
  
  const centerX = 164.5;
  const centerY = 80.5;
  const rings = Math.floor(rng.range(60, 150));
  const maxRadius = 250;
  const rotation = rng.range(0.03, 0.15);
  const lineThickness = rng.range(0.4, 3);
  
  for (let i = 0; i < rings; i++) {
    const radius = (i / rings) * maxRadius;
    const twist = i * rotation;
    const segments = 64;
    let path = '';
    
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2 + twist;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: strokeColor,
      strokeWidth: lineThickness,
      fill: 'none',
      opacity: 0.8 * baseOpacity,
    });
  }
  
  return { gradients, elements, backgroundColor: scheme.colors[0] };
}

function generateSimpleStarburstPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  const centerX = 164.5;
  const centerY = 80.5;
  const rays = Math.floor(rng.range(24, 96));
  const maxRadius = 250;
  const lineThickness = rng.range(0.5, 4);
  
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const x1 = centerX;
    const y1 = centerY;
    const x2 = centerX + Math.cos(angle) * maxRadius;
    const y2 = centerY + Math.sin(angle) * maxRadius;
    
    elements.push({
      type: 'path',
      d: `M ${x1} ${y1} L ${x2} ${y2}`,
      stroke: accentColor,
      strokeWidth: lineThickness,
      fill: 'none',
      opacity: rng.range(0.4, 0.9),
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateSimpleConcentricPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const gradients: GradientDef[] = [];
  const accentColor = scheme.colors[1];
  const baseOpacity = scheme.opacity || 1;
  const useGradient = rng.next() > 0.5;
  
  let fillColor = accentColor;
  if (useGradient) {
    const grad = createGradient('concentric-grad', accentColor, rng);
    gradients.push(grad.gradient);
    fillColor = grad.url;
  }
  
  const centerX = 164.5;
  const centerY = 80.5;
  const rings = Math.floor(rng.range(30, 100));
  const maxRadius = 250;
  const lineThickness = rng.range(0.5, 4);
  const filled = rng.next() > 0.5;
  
  for (let i = rings - 1; i >= 0; i--) {
    const radiusOuter = ((i + 1) / rings) * maxRadius;
    const radiusInner = (i / rings) * maxRadius;
    const segments = 64;
    
    if (filled && i % 2 === 0 && i < rings - 1) {
      let pathOuter = '';
      let pathInner = '';
      
      for (let j = 0; j <= segments; j++) {
        const angle = (j / segments) * Math.PI * 2;
        const xo = centerX + Math.cos(angle) * radiusOuter;
        const yo = centerY + Math.sin(angle) * radiusOuter;
        const xi = centerX + Math.cos(angle) * radiusInner;
        const yi = centerY + Math.sin(angle) * radiusInner;
        
        pathOuter += j === 0 ? `M ${xo} ${yo}` : ` L ${xo} ${yo}`;
        pathInner = `M ${xi} ${yi}` + pathInner;
      }
      
      elements.push({
        type: 'path',
        d: pathOuter + ' ' + pathInner + ' Z',
        stroke: 'none',
        strokeWidth: 0,
        fill: fillColor,
        opacity: 0.9 * baseOpacity,
      });
    }
    
    let path = '';
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radiusOuter;
      const y = centerY + Math.sin(angle) * radiusOuter;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: lineThickness,
      fill: 'none',
      opacity: 0.85 * baseOpacity,
    });
  }
  
  return { gradients, elements, backgroundColor: scheme.colors[0] };
}

function generateSimpleTwistedSpiralPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const gradients: GradientDef[] = [];
  const accentColor = scheme.colors[1];
  const baseOpacity = scheme.opacity || 1;
  const useGradient = rng.next() > 0.5;
  
  let strokeColor = accentColor;
  if (useGradient) {
    const grad = createGradient('twisted-grad', accentColor, rng);
    gradients.push(grad.gradient);
    strokeColor = grad.url;
  }
  
  const centerX = 164.5;
  const centerY = 80.5;
  const arms = Math.floor(rng.range(3, 12));
  const rotations = rng.range(4, 12);
  const maxRadius = 260;
  const lineThickness = rng.range(1, 5);
  
  for (let arm = 0; arm < arms; arm++) {
    const startAngle = (arm / arms) * Math.PI * 2;
    let path = `M ${centerX} ${centerY}`;
    
    for (let i = 1; i <= 100; i++) {
      const t = i / 100;
      const radius = t * maxRadius;
      const angle = startAngle + t * rotations * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      path += ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: strokeColor,
      strokeWidth: lineThickness,
      fill: 'none',
      opacity: 0.7 * baseOpacity,
    });
  }
  
  return { gradients, elements, backgroundColor: scheme.colors[0] };
}

function generateSimplePolygonPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  const centerX = 164.5;
  const centerY = 80.5;
  const sides = Math.floor(rng.range(5, 16));
  const layers = Math.floor(rng.range(40, 100));
  const maxRadius = 250;
  const rotation = rng.range(0.02, 0.12);
  const lineThickness = rng.range(0.4, 3);
  
  for (let i = 0; i < layers; i++) {
    const radius = (i / layers) * maxRadius;
    const twist = i * rotation;
    let path = '';
    
    for (let j = 0; j <= sides; j++) {
      const angle = (j / sides) * Math.PI * 2 + twist;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: lineThickness,
      fill: 'none',
      opacity: 0.8,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateSimpleRotatingRadialPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  const centerX = 164.5;
  const centerY = 80.5;
  const segments = Math.floor(rng.range(12, 48));
  const layers = Math.floor(rng.range(30, 80));
  const maxRadius = 250;
  const rotation = rng.range(0.03, 0.12);
  const lineThickness = rng.range(0.3, 1.5);
  
  for (let i = 0; i < layers; i++) {
    const radiusInner = (i / layers) * maxRadius;
    const radiusOuter = ((i + 1) / layers) * maxRadius;
    const twist = i * rotation;
    
    for (let seg = 0; seg < segments; seg++) {
      if (seg % 2 === 0) continue;
      
      const angle1 = (seg / segments) * Math.PI * 2 + twist;
      const angle2 = ((seg + 1) / segments) * Math.PI * 2 + twist;
      
      const x1 = centerX + Math.cos(angle1) * radiusInner;
      const y1 = centerY + Math.sin(angle1) * radiusInner;
      const x2 = centerX + Math.cos(angle2) * radiusInner;
      const y2 = centerY + Math.sin(angle2) * radiusInner;
      const x3 = centerX + Math.cos(angle2) * radiusOuter;
      const y3 = centerY + Math.sin(angle2) * radiusOuter;
      const x4 = centerX + Math.cos(angle1) * radiusOuter;
      const y4 = centerY + Math.sin(angle1) * radiusOuter;
      
      const path = `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: lineThickness,
        fill: accentColor,
        opacity: 0.6,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateSimpleFlowerPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  const centerX = 164.5;
  const centerY = 80.5;
  const petals = Math.floor(rng.range(6, 24));
  const layers = Math.floor(rng.range(20, 60));
  const maxRadius = 250;
  const lineThickness = rng.range(0.5, 3);
  
  for (let layer = 0; layer < layers; layer++) {
    const radius = ((layer + 1) / layers) * maxRadius;
    
    for (let p = 0; p < petals; p++) {
      const angle = (p / petals) * Math.PI * 2;
      const nextAngle = ((p + 1) / petals) * Math.PI * 2;
      const midAngle = (angle + nextAngle) / 2;
      
      const x1 = centerX + Math.cos(angle) * radius * 0.6;
      const y1 = centerY + Math.sin(angle) * radius * 0.6;
      const x2 = centerX + Math.cos(midAngle) * radius;
      const y2 = centerY + Math.sin(midAngle) * radius;
      const x3 = centerX + Math.cos(nextAngle) * radius * 0.6;
      const y3 = centerY + Math.sin(nextAngle) * radius * 0.6;
      
      const path = `M ${centerX} ${centerY} Q ${x2} ${y2} ${x3} ${y3}`;
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: lineThickness,
        fill: 'none',
        opacity: 0.5,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateWarpedGridPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  const centerX = 164.5;
  const centerY = 80.5;
  const gridSize = Math.floor(rng.range(12, 24));
  const warpIntensity = rng.range(30, 80);
  const lineThickness = rng.range(0.4, 2.5);
  
  // Horizontal lines
  for (let i = 0; i <= gridSize; i++) {
    const baseY = (i / gridSize) * 161;
    let path = '';
    
    for (let j = 0; j <= 100; j++) {
      const x = (j / 100) * 337;
      const dx = x - centerX;
      const dy = baseY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const warp = Math.sin(distance * 0.03) * warpIntensity;
      const angle = Math.atan2(dy, dx);
      const y = baseY + Math.sin(angle) * warp;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: lineThickness,
      fill: 'none',
      opacity: 0.8,
    });
  }
  
  // Vertical lines
  for (let i = 0; i <= gridSize * 2; i++) {
    const baseX = (i / (gridSize * 2)) * 337;
    let path = '';
    
    for (let j = 0; j <= 60; j++) {
      const y = (j / 60) * 161;
      const dx = baseX - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const warp = Math.sin(distance * 0.03) * warpIntensity;
      const angle = Math.atan2(dy, dx);
      const x = baseX + Math.cos(angle) * warp;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: lineThickness,
      fill: 'none',
      opacity: 0.8,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateTunnelPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  const centerX = 164.5;
  const centerY = 80.5;
  const layers = Math.floor(rng.range(40, 80));
  const lineThickness = rng.range(0.4, 2);
  const filled = rng.next() > 0.5;
  
  for (let i = layers; i > 0; i--) {
    const scale = i / layers;
    const rectWidth = 250 * scale;
    const rectHeight = 180 * scale;
    const x = centerX - rectWidth / 2;
    const y = centerY - rectHeight / 2;
    
    const path = `M ${x} ${y} L ${x + rectWidth} ${y} L ${x + rectWidth} ${y + rectHeight} L ${x} ${y + rectHeight} Z`;
    
    if (filled && i % 2 === 0) {
      elements.push({
        type: 'path',
        d: path,
        stroke: 'none',
        strokeWidth: 0,
        fill: accentColor,
        opacity: 0.5,
      });
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: lineThickness,
      fill: 'none',
      opacity: 0.7 + (1 - scale) * 0.3,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateWaveRingsPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  const centerX = 164.5;
  const centerY = 80.5;
  const rings = Math.floor(rng.range(40, 100));
  const maxRadius = 250;
  const waveFreq = rng.range(6, 18);
  const waveAmp = rng.range(3, 10);
  const lineThickness = rng.range(0.4, 2.5);
  
  for (let i = 0; i < rings; i++) {
    const baseRadius = (i / rings) * maxRadius;
    const segments = 64;
    let path = '';
    
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2;
      const wave = Math.sin(j / segments * waveFreq * Math.PI * 2) * waveAmp;
      const radius = baseRadius + wave;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      path += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: lineThickness,
      fill: 'none',
      opacity: 0.7,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateDoubleHelixPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  const centerX = 164.5;
  const centerY = 80.5;
  const arms = Math.floor(rng.range(2, 6)) * 2; // Always even number
  const rotations = rng.range(6, 15);
  const maxRadius = 260;
  const lineThickness = rng.range(1.5, 5);
  
  for (let arm = 0; arm < arms; arm++) {
    const startAngle = (arm / arms) * Math.PI * 2;
    let path = `M ${centerX} ${centerY}`;
    
    for (let i = 1; i <= 100; i++) {
      const t = i / 100;
      const baseRadius = t * maxRadius;
      const angle = startAngle + t * rotations * Math.PI * 2;
      const wave = Math.sin(t * Math.PI * 4) * 20;
      const radius = baseRadius + wave;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      path += ` L ${x} ${y}`;
    }
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: lineThickness,
      fill: 'none',
      opacity: 0.7,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateDottedSpiralPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  const centerX = 164.5;
  const centerY = 80.5;
  const spirals = Math.floor(rng.range(4, 12));
  const density = Math.floor(rng.range(60, 120));
  const dotSize = rng.range(1.5, 5);
  
  for (let s = 0; s < spirals; s++) {
    const startAngle = (s / spirals) * Math.PI * 2;
    
    for (let i = 0; i < density; i++) {
      const t = i / density;
      const radius = t * 260;
      const rotation = t * rng.range(4, 8) * Math.PI;
      const angle = startAngle + rotation;
      
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      const segments = 16;
      let path = '';
      for (let j = 0; j <= segments; j++) {
        const a = (j / segments) * Math.PI * 2;
        const px = x + Math.cos(a) * dotSize;
        const py = y + Math.sin(a) * dotSize;
        path += j === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
      }
      
      elements.push({
        type: 'path',
        d: path,
        stroke: 'none',
        strokeWidth: 0,
        fill: accentColor,
        opacity: 0.6,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateStarMandalaPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  const centerX = 164.5;
  const centerY = 80.5;
  const points = Math.floor(rng.range(6, 20));
  const layers = Math.floor(rng.range(30, 70));
  const maxRadius = 250;
  const lineThickness = rng.range(0.4, 2);
  
  for (let layer = 0; layer < layers; layer++) {
    const radiusOuter = ((layer + 1) / layers) * maxRadius;
    const radiusInner = radiusOuter * 0.6;
    
    for (let i = 0; i < points * 2; i++) {
      const angle1 = (i / (points * 2)) * Math.PI * 2;
      const angle2 = ((i + 1) / (points * 2)) * Math.PI * 2;
      const r1 = i % 2 === 0 ? radiusOuter : radiusInner;
      const r2 = (i + 1) % 2 === 0 ? radiusOuter : radiusInner;
      
      const x1 = centerX + Math.cos(angle1) * r1;
      const y1 = centerY + Math.sin(angle1) * r1;
      const x2 = centerX + Math.cos(angle2) * r2;
      const y2 = centerY + Math.sin(angle2) * r2;
      
      if (layer > 0) {
        const prevR1 = i % 2 === 0 ? (layer / layers) * maxRadius : (layer / layers) * maxRadius * 0.6;
        const x0 = centerX + Math.cos(angle1) * prevR1;
        const y0 = centerY + Math.sin(angle1) * prevR1;
        
        const path = `M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2} Z`;
        const filled = i % 2 === 0 && layer % 2 === 0;
        
        elements.push({
          type: 'path',
          d: path,
          stroke: accentColor,
          strokeWidth: lineThickness,
          fill: filled ? accentColor : 'none',
          opacity: filled ? 0.4 : 0.7,
        });
      }
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateCurvedRaysPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  const centerX = 164.5;
  const centerY = 80.5;
  const rayCount = Math.floor(rng.range(20, 60));
  const curvature = rng.range(0.5, 1.8);
  const lineThickness = rng.range(0.8, 4);
  
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const controlDist = rng.range(100, 180);
    const endDist = 280;
    
    const x1 = centerX + Math.cos(angle) * 10;
    const y1 = centerY + Math.sin(angle) * 10;
    
    const controlAngle = angle + curvature;
    const cx = centerX + Math.cos(controlAngle) * controlDist;
    const cy = centerY + Math.sin(controlAngle) * controlDist;
    
    const x2 = centerX + Math.cos(angle + curvature * 0.5) * endDist;
    const y2 = centerY + Math.sin(angle + curvature * 0.5) * endDist;
    
    const path = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
    
    elements.push({
      type: 'path',
      d: path,
      stroke: accentColor,
      strokeWidth: lineThickness,
      fill: 'none',
      opacity: 0.6,
    });
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

function generateMoireCirclesPattern(rng: SeededRandom, scheme: typeof COLOR_SCHEMES[0]): WavePattern {
  const elements: PatternElement[] = [];
  const accentColor = scheme.colors[1];
  
  const centerX = 164.5;
  const centerY = 80.5;
  const spacing = rng.range(15, 30);
  const radius = rng.range(10, 20);
  const lineThickness = rng.range(0.6, 2);
  const offset = spacing / 2;
  
  // First grid of circles
  for (let y = -radius; y < 161 + radius; y += spacing) {
    for (let x = -radius; x < 337 + radius; x += spacing) {
      const segments = 32;
      let path = '';
      
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        path += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
      }
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: lineThickness,
        fill: 'none',
        opacity: 0.5,
      });
    }
  }
  
  // Second overlapping grid offset
  for (let y = -radius + offset; y < 161 + radius; y += spacing) {
    for (let x = -radius + offset; x < 337 + radius; x += spacing) {
      const segments = 32;
      let path = '';
      
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        path += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
      }
      
      elements.push({
        type: 'path',
        d: path,
        stroke: accentColor,
        strokeWidth: lineThickness,
        fill: 'none',
        opacity: 0.5,
      });
    }
  }
  
  return { gradients: [], elements, backgroundColor: scheme.colors[0] };
}

export function generateTapePattern(artistName: string, tapeTitle: string, year?: string): WavePattern {
  const seed = hashString(`${artistName}::${tapeTitle}::${year || 'unknown'}`);
  const rng = new SeededRandom(seed);
  
  // Pick color scheme deterministically
  const scheme = COLOR_SCHEMES[seed % COLOR_SCHEMES.length];
  
  // Pick from 16 optical illusion & mandala patterns
  const patternIndex = Math.floor(seed / COLOR_SCHEMES.length) % 16;
  const generators = [
    generateSimpleRadialPattern,         // 1. Radial checkerboard mandala
    generateSimpleSpiralPattern,         // 2. Rotating spiral
    generateSimpleStarburstPattern,      // 3. Starburst rays
    generateSimpleConcentricPattern,     // 4. Concentric circles (hypnotic)
    generateSimpleTwistedSpiralPattern,  // 5. Twisted spiral arms
    generateSimplePolygonPattern,        // 6. Polygon mandala
    generateSimpleRotatingRadialPattern, // 7. Rotating radial segments
    generateSimpleFlowerPattern,         // 8. Flower/petal mandala
    generateWarpedGridPattern,           // 9. Warped grid (like reference image!)
    generateTunnelPattern,               // 10. 3D tunnel perspective
    generateWaveRingsPattern,            // 11. Wavy concentric rings
    generateDoubleHelixPattern,          // 12. Double helix spirals
    generateDottedSpiralPattern,         // 13. Dotted spiral vortex
    generateStarMandalaPattern,          // 14. Star mandala with fills
    generateCurvedRaysPattern,           // 15. Curved rays from center
    generateMoireCirclesPattern,         // 16. Moiré interference pattern
  ];
  
  return generators[patternIndex](rng, scheme);
}
