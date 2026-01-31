// Simple deterministic pattern generator for blank tape placeholders
// Generates optical illusion / mandala style patterns

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }
  
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  
  range(min, max) {
    return min + this.next() * (max - min);
  }
}

const COLOR = '#d4d4d8'; // Grayish white
const OPACITY = 0.5;

// Label dimensions (18px margins on each side)
const LABEL_WIDTH = 337;
const LABEL_HEIGHT = 161;
const CENTER_X = LABEL_WIDTH / 2;
const CENTER_Y = LABEL_HEIGHT / 2;

// Pattern generators (16 core patterns for variety)

function generateRadialPattern(rng) {
  const rings = Math.floor(rng.range(25, 45));
  const segments = Math.floor(rng.range(12, 24));
  const maxRadius = 200;
  const lineWidth = rng.range(0.5, 2);
  const fillPattern = Math.floor(rng.range(0, 3));
  
  let paths = '';
  for (let ring = 0; ring < rings; ring++) {
    const r1 = (ring / rings) * maxRadius;
    const r2 = ((ring + 1) / rings) * maxRadius;
    
    for (let seg = 0; seg < segments; seg++) {
      const a1 = (seg / segments) * Math.PI * 2;
      const a2 = ((seg + 1) / segments) * Math.PI * 2;
      
      const x1 = (CENTER_X + Math.cos(a1) * r1).toFixed(1);
      const y1 = (CENTER_Y + Math.sin(a1) * r1).toFixed(1);
      const x2 = (CENTER_X + Math.cos(a2) * r1).toFixed(1);
      const y2 = (CENTER_Y + Math.sin(a2) * r1).toFixed(1);
      const x3 = (CENTER_X + Math.cos(a2) * r2).toFixed(1);
      const y3 = (CENTER_Y + Math.sin(a2) * r2).toFixed(1);
      const x4 = (CENTER_X + Math.cos(a1) * r2).toFixed(1);
      const y4 = (CENTER_Y + Math.sin(a1) * r2).toFixed(1);
      
      let filled = false;
      if (fillPattern === 0) filled = (ring + seg) % 2 === 0;
      else if (fillPattern === 1) filled = seg % 2 === 0;
      else filled = ring % 2 === 0;
      
      const opacity = filled ? 0.6 * OPACITY : 0.7 * OPACITY;
      const fill = filled ? COLOR : 'none';
      
      paths += `<path d="M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z" stroke="${COLOR}" stroke-width="${lineWidth}" fill="${fill}" opacity="${opacity}"/>\n`;
    }
  }
  return paths;
}

function generateSpiralPattern(rng) {
  const rings = Math.floor(rng.range(40, 70));
  const maxRadius = 200;
  const rotation = rng.range(0.05, 0.12);
  const lineWidth = rng.range(0.5, 2.5);
  
  let paths = '';
  for (let i = 0; i < rings; i++) {
    const radius = (i / rings) * maxRadius;
    const twist = i * rotation;
    const segments = 32;
    
    let d = '';
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2 + twist;
      const x = (CENTER_X + Math.cos(angle) * radius).toFixed(1);
      const y = (CENTER_Y + Math.sin(angle) * radius).toFixed(1);
      d += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    paths += `<path d="${d}" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${0.7 * OPACITY}"/>\n`;
  }
  return paths;
}

function generateStarburstPattern(rng) {
  const rays = Math.floor(rng.range(30, 60));
  const maxRadius = 220;
  const lineWidth = rng.range(0.5, 3);
  
  let paths = '';
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const x2 = (CENTER_X + Math.cos(angle) * maxRadius).toFixed(1);
    const y2 = (CENTER_Y + Math.sin(angle) * maxRadius).toFixed(1);
    
    paths += `<path d="M ${CENTER_X} ${CENTER_Y} L ${x2} ${y2}" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${rng.range(0.4, 0.7) * OPACITY}"/>\n`;
  }
  return paths;
}

function generateConcentricPattern(rng) {
  const rings = Math.floor(rng.range(35, 65));
  const maxRadius = 200;
  const lineWidth = rng.range(0.6, 3);
  
  let paths = '';
  for (let i = 0; i < rings; i++) {
    const radius = ((i + 1) / rings) * maxRadius;
    const segments = 48;
    
    let d = '';
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2;
      const x = (CENTER_X + Math.cos(angle) * radius).toFixed(1);
      const y = (CENTER_Y + Math.sin(angle) * radius).toFixed(1);
      d += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    paths += `<path d="${d}" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${0.75 * OPACITY}"/>\n`;
  }
  return paths;
}

function generateTwistedSpiralPattern(rng) {
  const arms = Math.floor(rng.range(4, 10));
  const rotations = rng.range(5, 10);
  const maxRadius = 220;
  const lineWidth = rng.range(1.5, 4);
  
  let paths = '';
  for (let arm = 0; arm < arms; arm++) {
    const startAngle = (arm / arms) * Math.PI * 2;
    let d = `M ${CENTER_X} ${CENTER_Y}`;
    
    for (let i = 1; i <= 60; i++) {
      const t = i / 60;
      const radius = t * maxRadius;
      const angle = startAngle + t * rotations * Math.PI * 2;
      const x = (CENTER_X + Math.cos(angle) * radius).toFixed(1);
      const y = (CENTER_Y + Math.sin(angle) * radius).toFixed(1);
      d += ` L ${x} ${y}`;
    }
    
    paths += `<path d="${d}" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${0.65 * OPACITY}"/>\n`;
  }
  return paths;
}

function generatePolygonPattern(rng) {
  const sides = Math.floor(rng.range(6, 14));
  const layers = Math.floor(rng.range(35, 60));
  const maxRadius = 200;
  const rotation = rng.range(0.03, 0.1);
  const lineWidth = rng.range(0.5, 2);
  
  let paths = '';
  for (let i = 0; i < layers; i++) {
    const radius = (i / layers) * maxRadius;
    const twist = i * rotation;
    
    let d = '';
    for (let j = 0; j <= sides; j++) {
      const angle = (j / sides) * Math.PI * 2 + twist;
      const x = (CENTER_X + Math.cos(angle) * radius).toFixed(1);
      const y = (CENTER_Y + Math.sin(angle) * radius).toFixed(1);
      d += j === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    paths += `<path d="${d}" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${0.7 * OPACITY}"/>\n`;
  }
  return paths;
}

function generateWarpedGridPattern(rng) {
  const gridSize = Math.floor(rng.range(12, 24));
  const warpIntensity = rng.range(20, 50);
  const lineWidth = rng.range(0.4, 2.2);
  const warpFrequency = rng.range(0.03, 0.06);
  
  let paths = '';
  
  // Horizontal lines
  for (let i = 0; i <= gridSize; i++) {
    const baseY = (i / gridSize) * LABEL_HEIGHT;
    let d = '';
    
    for (let j = 0; j <= 60; j++) {
      const x = (j / 60) * LABEL_WIDTH;
      const dx = x - CENTER_X;
      const dy = baseY - CENTER_Y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const warp = Math.sin(distance * warpFrequency) * warpIntensity;
      const angle = Math.atan2(dy, dx);
      const y = (baseY + Math.sin(angle) * warp).toFixed(1);
      d += j === 0 ? `M ${x.toFixed(1)} ${y}` : ` L ${x.toFixed(1)} ${y}`;
    }
    
    paths += `<path d="${d}" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${0.7 * OPACITY}"/>\n`;
  }
  
  // Vertical lines
  for (let i = 0; i <= gridSize * 1.5; i++) {
    const baseX = (i / (gridSize * 1.5)) * LABEL_WIDTH;
    let d = '';
    
    for (let j = 0; j <= 40; j++) {
      const y = (j / 40) * LABEL_HEIGHT;
      const dx = baseX - CENTER_X;
      const dy = y - CENTER_Y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const warp = Math.sin(distance * warpFrequency) * warpIntensity;
      const angle = Math.atan2(dy, dx);
      const x = (baseX + Math.cos(angle) * warp).toFixed(1);
      d += j === 0 ? `M ${x} ${y.toFixed(1)}` : ` L ${x} ${y.toFixed(1)}`;
    }
    
    paths += `<path d="${d}" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${0.7 * OPACITY}"/>\n`;
  }
  
  return paths;
}

function generateTunnelPattern(rng) {
  const layers = Math.floor(rng.range(35, 55));
  const lineWidth = rng.range(0.5, 1.5);
  
  let paths = '';
  for (let i = layers; i > 0; i--) {
    const scale = i / layers;
    const rectWidth = 220 * scale;
    const rectHeight = 150 * scale;
    const x = CENTER_X - rectWidth / 2;
    const y = CENTER_Y - rectHeight / 2;
    
    const filled = i % 2 === 0;
    const opacity = (0.7 + (1 - scale) * 0.2) * OPACITY;
    
    paths += `<path d="M ${x.toFixed(1)} ${y.toFixed(1)} L ${(x + rectWidth).toFixed(1)} ${y.toFixed(1)} L ${(x + rectWidth).toFixed(1)} ${(y + rectHeight).toFixed(1)} L ${x.toFixed(1)} ${(y + rectHeight).toFixed(1)} Z" stroke="${COLOR}" stroke-width="${lineWidth}" fill="${filled ? COLOR : 'none'}" opacity="${filled ? opacity * 0.4 : opacity}"/>\n`;
  }
  return paths;
}

function generateFlowerMandala(rng) {
  const petals = Math.floor(rng.range(8, 16));
  const layers = Math.floor(rng.range(15, 30));
  const maxRadius = 200;
  const lineWidth = rng.range(0.5, 2);
  
  let paths = '';
  for (let layer = 0; layer < layers; layer++) {
    const radius = ((layer + 1) / layers) * maxRadius;
    const petalWidth = rng.range(0.3, 0.6);
    
    for (let p = 0; p < petals; p++) {
      const angle = (p / petals) * Math.PI * 2;
      const petalRadius = radius * (0.8 + Math.sin(layer * 0.5) * 0.2);
      
      // Create petal shape
      const cx = CENTER_X + Math.cos(angle) * petalRadius;
      const cy = CENTER_Y + Math.sin(angle) * petalRadius;
      const r = radius * petalWidth;
      
      paths += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${0.6 * OPACITY}"/>\n`;
    }
  }
  return paths;
}

function generateZigzagPattern(rng) {
  const rows = Math.floor(rng.range(20, 35));
  const amplitude = rng.range(15, 30);
  const frequency = rng.range(0.15, 0.3);
  const lineWidth = rng.range(0.5, 2);
  
  let paths = '';
  for (let i = 0; i <= rows; i++) {
    const y = (i / rows) * LABEL_HEIGHT;
    let d = '';
    
    for (let j = 0; j <= 60; j++) {
      const x = (j / 60) * LABEL_WIDTH;
      const zigzag = Math.sin(x * frequency) * amplitude;
      const yPos = (y + zigzag).toFixed(1);
      d += j === 0 ? `M ${x.toFixed(1)} ${yPos}` : ` L ${x.toFixed(1)} ${yPos}`;
    }
    
    paths += `<path d="${d}" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${0.65 * OPACITY}"/>\n`;
  }
  return paths;
}

function generateMoirePattern(rng) {
  const lines = Math.floor(rng.range(50, 80));
  const angle1 = rng.range(0, Math.PI / 4);
  const angle2 = angle1 + rng.range(0.1, 0.3);
  const lineWidth = rng.range(0.3, 1.2);
  
  let paths = '';
  
  // First set of parallel lines
  for (let i = 0; i < lines; i++) {
    const offset = (i / lines) * (LABEL_WIDTH + LABEL_HEIGHT);
    const x1 = -LABEL_HEIGHT * Math.sin(angle1) + offset * Math.cos(angle1);
    const y1 = offset * Math.sin(angle1);
    const x2 = x1 + LABEL_WIDTH * Math.cos(angle1);
    const y2 = y1 + LABEL_WIDTH * Math.sin(angle1);
    
    paths += `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${0.5 * OPACITY}"/>\n`;
  }
  
  // Second set at different angle
  for (let i = 0; i < lines; i++) {
    const offset = (i / lines) * (LABEL_WIDTH + LABEL_HEIGHT);
    const x1 = -LABEL_HEIGHT * Math.sin(angle2) + offset * Math.cos(angle2);
    const y1 = offset * Math.sin(angle2);
    const x2 = x1 + LABEL_WIDTH * Math.cos(angle2);
    const y2 = y1 + LABEL_WIDTH * Math.sin(angle2);
    
    paths += `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${0.5 * OPACITY}"/>\n`;
  }
  
  return paths;
}

function generateFibonacciSpiral(rng) {
  const segments = Math.floor(rng.range(40, 70));
  const lineWidth = rng.range(0.8, 2.5);
  const growthRate = rng.range(1.1, 1.25);
  
  let paths = '';
  let radius = 2;
  let angle = 0;
  let d = `M ${CENTER_X} ${CENTER_Y}`;
  
  for (let i = 0; i < segments; i++) {
    angle += 0.3;
    radius *= growthRate;
    const x = (CENTER_X + Math.cos(angle) * radius).toFixed(1);
    const y = (CENTER_Y + Math.sin(angle) * radius).toFixed(1);
    d += ` L ${x} ${y}`;
  }
  
  paths += `<path d="${d}" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${0.7 * OPACITY}"/>\n`;
  
  return paths;
}

function generateHypnoticCircles(rng) {
  const centers = Math.floor(rng.range(3, 6));
  const ringsPerCenter = Math.floor(rng.range(15, 25));
  const maxRadius = rng.range(80, 120);
  const lineWidth = rng.range(0.4, 1.5);
  
  let paths = '';
  const centerPositions = [];
  
  // Create center positions
  for (let i = 0; i < centers; i++) {
    const angle = (i / centers) * Math.PI * 2;
    const distance = rng.range(40, 80);
    centerPositions.push({
      x: CENTER_X + Math.cos(angle) * distance,
      y: CENTER_Y + Math.sin(angle) * distance
    });
  }
  
  // Draw concentric circles from each center
  for (const center of centerPositions) {
    for (let ring = 1; ring <= ringsPerCenter; ring++) {
      const radius = (ring / ringsPerCenter) * maxRadius;
      paths += `<circle cx="${center.x.toFixed(1)}" cy="${center.y.toFixed(1)}" r="${radius.toFixed(1)}" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${0.6 * OPACITY}"/>\n`;
    }
  }
  
  return paths;
}

function generateDiamondTessellation(rng) {
  const size = rng.range(15, 25);
  const lineWidth = rng.range(0.5, 1.8);
  const rotation = rng.range(0, Math.PI / 6);
  
  let paths = '';
  const cols = Math.ceil(LABEL_WIDTH / size) + 4;
  const rows = Math.ceil(LABEL_HEIGHT / size) + 4;
  
  for (let row = -2; row < rows; row++) {
    for (let col = -2; col < cols; col++) {
      const cx = col * size + (row % 2) * size / 2;
      const cy = row * size;
      
      // Rotate around center
      const dx = cx - CENTER_X;
      const dy = cy - CENTER_Y;
      const x = CENTER_X + dx * Math.cos(rotation) - dy * Math.sin(rotation);
      const y = CENTER_Y + dx * Math.sin(rotation) + dy * Math.cos(rotation);
      
      const half = size / 2;
      const x1 = (x - half).toFixed(1);
      const y1 = y.toFixed(1);
      const x2 = x.toFixed(1);
      const y2 = (y - half).toFixed(1);
      const x3 = (x + half).toFixed(1);
      const y3 = y.toFixed(1);
      const x4 = x.toFixed(1);
      const y4 = (y + half).toFixed(1);
      
      paths += `<path d="M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${0.65 * OPACITY}"/>\n`;
    }
  }
  
  return paths;
}

function generateRotatingTriangles(rng) {
  const layers = Math.floor(rng.range(20, 35));
  const trianglesPerLayer = Math.floor(rng.range(6, 12));
  const maxRadius = 200;
  const lineWidth = rng.range(0.5, 2);
  
  let paths = '';
  for (let layer = 0; layer < layers; layer++) {
    const radius = ((layer + 1) / layers) * maxRadius;
    const rotation = layer * rng.range(0.05, 0.15);
    
    for (let tri = 0; tri < trianglesPerLayer; tri++) {
      const angle = (tri / trianglesPerLayer) * Math.PI * 2 + rotation;
      const triSize = radius * 0.15;
      
      const cx = CENTER_X + Math.cos(angle) * radius;
      const cy = CENTER_Y + Math.sin(angle) * radius;
      
      const x1 = (cx + Math.cos(angle) * triSize).toFixed(1);
      const y1 = (cy + Math.sin(angle) * triSize).toFixed(1);
      const x2 = (cx + Math.cos(angle + Math.PI * 2/3) * triSize).toFixed(1);
      const y2 = (cy + Math.sin(angle + Math.PI * 2/3) * triSize).toFixed(1);
      const x3 = (cx + Math.cos(angle + Math.PI * 4/3) * triSize).toFixed(1);
      const y3 = (cy + Math.sin(angle + Math.PI * 4/3) * triSize).toFixed(1);
      
      paths += `<path d="M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} Z" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${0.6 * OPACITY}"/>\n`;
    }
  }
  
  return paths;
}

function generateWaveInterference(rng) {
  const sources = Math.floor(rng.range(2, 4));
  const waves = Math.floor(rng.range(30, 50));
  const lineWidth = rng.range(0.3, 1.2);
  
  let paths = '';
  const wavePoints = [];
  
  // Create wave source positions
  for (let i = 0; i < sources; i++) {
    const angle = (i / sources) * Math.PI * 2;
    const distance = rng.range(60, 100);
    wavePoints.push({
      x: CENTER_X + Math.cos(angle) * distance,
      y: CENTER_Y + Math.sin(angle) * distance
    });
  }
  
  // Draw interference pattern
  for (let wave = 0; wave < waves; wave++) {
    const radius = (wave / waves) * 150 + 10;
    
    for (const source of wavePoints) {
      paths += `<circle cx="${source.x.toFixed(1)}" cy="${source.y.toFixed(1)}" r="${radius.toFixed(1)}" stroke="${COLOR}" stroke-width="${lineWidth}" fill="none" opacity="${(0.4 + (1 - wave/waves) * 0.3) * OPACITY}"/>\n`;
    }
  }
  
  return paths;
}

const PATTERN_GENERATORS = [
  generateRadialPattern,
  generateSpiralPattern,
  generateStarburstPattern,
  generateConcentricPattern,
  generateTwistedSpiralPattern,
  generatePolygonPattern,
  generateWarpedGridPattern,
  generateTunnelPattern,
  generateFlowerMandala,
  generateZigzagPattern,
  generateMoirePattern,
  generateFibonacciSpiral,
  generateHypnoticCircles,
  generateDiamondTessellation,
  generateRotatingTriangles,
  generateWaveInterference,
];

export function generatePlaceholderSVG(artistName, tapeTitle, year) {
  const seed = hashString(`${artistName}::${tapeTitle}::${year || 'unknown'}`);
  
  // Use different parts of the seed for pattern selection and RNG initialization
  // This ensures different seeds produce more distinct patterns
  const patternIndex = seed % PATTERN_GENERATORS.length;
  const rngSeed = Math.floor(seed / PATTERN_GENERATORS.length);
  const rng = new SeededRandom(rngSeed);
  
  const patternPaths = PATTERN_GENERATORS[patternIndex](rng);
  
  return `<svg viewBox="0 0 373 233" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="label-clip">
      <path d="M339 14C347.837 14 355 21.1634 355 30V159C355 167.837 347.837 175 339 175H34C25.1634 175 18 167.837 18 159V30C18 21.1634 25.1634 14 34 14H339ZM105 81C94.0132 81 85 90.0132 85 101V113C85 123.987 94.0132 133 105 133H274C284.987 133 294 123.987 294 113V101C294 90.0132 284.987 81 274 81H105Z"/>
    </clipPath>
  </defs>
  
  <!-- Base tape shape -->
  <path d="M370.507 152.092V9.9323C370.507 4.44728 366.043 0 360.538 0H12.4608C6.95557 0 2.49188 4.44728 2.49188 9.9323V152.092L0 154.575V213.756L2.49188 215.839V223.068C2.49188 228.553 6.95557 233 12.4608 233H360.538C366.043 233 370.507 228.553 370.507 223.068V215.839L372.999 213.756L373 154.575L370.507 152.092ZM285.066 114.219C283.282 118.976 279.69 123.008 274.849 125.261L273.75 121.747L268.595 123.349L269.694 126.865C264.426 127.754 259.17 126.47 254.987 123.567L257.548 120.8L253.635 117.091L251.014 119.923C249.413 117.992 248.15 115.73 247.356 113.192C246.561 110.654 246.308 108.077 246.524 105.582L250.472 106.467L251.731 101.233L247.715 100.334C249.499 95.5763 253.091 91.5442 257.931 89.291L259.186 93.2962L264.341 91.6943L263.086 87.6891C268.354 86.8002 273.61 88.0825 277.792 90.9855L275.002 93.9999L279.024 97.593L281.766 94.6283C283.367 96.5591 284.629 98.8215 285.424 101.359C286.218 103.898 286.472 106.474 286.257 108.970L282.483 108.124L281.381 113.392L285.066 114.219ZM125.887 120.738C122.401 124.444 117.528 126.788 112.19 127.011L112.533 123.344L107.157 122.846L106.815 126.512C101.607 125.31 97.2541 122.11 94.5144 117.828L97.9483 116.256L95.7691 111.333L92.2555 112.942C91.5251 110.547 91.234 107.974 91.4806 105.326C91.7286 102.678 92.49 100.204 93.6531 97.9829L96.9549 100.314L100.138 95.9662L96.7784 93.5964C100.265 89.8905 105.137 87.5459 110.475 87.3245L110.084 91.5016L115.46 91.9998L115.851 87.8227C121.057 89.0231 125.411 92.2228 128.149 96.5062L124.408 98.2181L126.732 103.076L130.408 101.392C131.14 103.788 131.431 106.36 131.183 109.008C130.935 111.656 130.175 114.131 129.01 116.352L125.856 114.125L122.803 118.563L125.887 120.738ZM100.506 228.125C95.3445 228.125 91.1599 223.956 91.1599 218.813C91.1599 213.671 95.3445 209.501 100.506 209.501C105.668 209.501 109.852 213.671 109.852 218.813C109.852 223.956 105.668 228.125 100.506 228.125ZM137.608 221.917C133.224 221.917 129.67 218.377 129.67 214.009C129.67 209.641 133.224 206.1 137.608 206.1C141.992 206.100 145.546 209.641 145.546 214.009C145.545 218.377 141.991 221.917 137.608 221.917ZM242.111 221.917C237.727 221.917 234.173 218.377 234.173 214.009C234.173 209.641 237.727 206.100 242.111 206.100C246.495 206.100 250.048 209.641 250.048 214.009C250.048 218.377 246.496 221.917 242.111 221.917ZM278.671 228.125C273.509 228.125 269.325 223.956 269.325 218.813C269.325 213.671 273.508 209.501 278.671 209.501C283.832 209.501 288.017 213.671 288.017 218.813C288.017 223.956 283.832 228.125 278.671 228.125Z" fill="#101010"/>
  
  <!-- Pattern layer -->
  <g clip-path="url(#label-clip)">
    <rect x="18" y="14" width="337" height="161" fill="#000000"/>
    <g transform="translate(18, 14)">
${patternPaths}    </g>
  </g>
</svg>`;
}
