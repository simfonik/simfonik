#!/usr/bin/env node
/**
 * Bake the full placeholder cassette mockup (SVG cassette body +
 * shader pattern as label) into static AVIF/PNG at build time.
 *
 * Pipeline per tape:
 *   1. Render shader RGBA via pure-JS shaders
 *   2. Encode RGBA → PNG buffer → base64 data URI
 *   3. Inline that data URI as <image> inside the cassette SVG template
 *   4. Sharp rasterizes the composite SVG → AVIF + PNG
 *
 * Output: web/public/generated/placeholders/{tapeId}.{avif,png}
 *
 * Usage:
 *   node web/scripts/generate-placeholder-shaders.mjs
 */

import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  paramsFromSeed,
  asciiParamsFromSeed,
  renderShaderGradient,
  renderAsciiShader,
  hashString,
} from './lib/placeholder-shader.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'public', 'generated', 'placeholders');
const TAPES_JSON = join(ROOT, 'data', 'tapes.json');

const allTapes = JSON.parse(readFileSync(TAPES_JSON, 'utf8'));
const TAPES = allTapes
  .filter((t) => {
    const hasCover =
      t.images?.cover && t.images.cover !== '/media/site/blank-tape.svg';
    const hasSides = t.sides?.some((s) => s.image);
    return !hasCover && !hasSides;
  })
  .map((t) => t.id);

// Shader is rendered at the label region's aspect (337/161 ≈ 2.094)
// so the cassette's `xMidYMid slice` doesn't need to crop.
const SHADER_W = 1024;
const SHADER_H = Math.round((1024 * 161) / 337); // ≈ 489

// Output cassette dimensions — viewBox is 373×233; render at ~3.2× for
// crisp gallery thumbnails up to ~1200px wide.
const OUTPUT_W = 1200;

mkdirSync(OUTPUT_DIR, { recursive: true });

const variantPool = [
  { name: 'shader', paramsFn: paramsFromSeed,      renderFn: renderShaderGradient },
  { name: 'ascii',  paramsFn: asciiParamsFromSeed, renderFn: renderAsciiShader },
];

// ─── Cassette SVG template ──────────────────────────────────────────
// Path constants and template mirror web/app/dev/placeholders/_placeholders-mock.tsx.
// Reels stay at their natural positions (111, 107) / (266, 107), so no
// SVG transforms are needed and the body/teeth masks simplify.

const OUTER_BODY_D =
  'M370.507 152.092V9.9323C370.507 4.44728 366.043 0 360.538 0H12.4608C6.95557 0 2.49188 4.44728 2.49188 9.9323V152.092L0 154.575V213.756L2.49188 215.839V223.068C2.49188 228.553 6.95557 233 12.4608 233H360.538C366.043 233 370.507 228.553 370.507 223.068V215.839L372.999 213.756L373 154.575L370.507 152.092Z';
const RIGHT_REEL_D =
  'M285.066 114.219C283.282 118.976 279.69 123.008 274.849 125.261L273.75 121.747L268.595 123.349L269.694 126.865C264.426 127.754 259.17 126.47 254.987 123.567L257.548 120.8L253.635 117.091L251.014 119.923C249.413 117.992 248.15 115.73 247.356 113.192C246.561 110.654 246.308 108.077 246.524 105.582L250.472 106.467L251.731 101.233L247.715 100.334C249.499 95.5763 253.091 91.5442 257.931 89.291L259.186 93.2962L264.341 91.6943L263.086 87.6891C268.354 86.8002 273.61 88.0825 277.792 90.9855L275.002 93.9999L279.024 97.593L281.766 94.6283C283.367 96.5591 284.629 98.8215 285.424 101.359C286.218 103.898 286.472 106.474 286.257 108.970L282.483 108.124L281.381 113.392L285.066 114.219Z';
const LEFT_REEL_D =
  'M125.887 120.738C122.401 124.444 117.528 126.788 112.19 127.011L112.533 123.344L107.157 122.846L106.815 126.512C101.607 125.31 97.2541 122.11 94.5144 117.828L97.9483 116.256L95.7691 111.333L92.2555 112.942C91.5251 110.547 91.234 107.974 91.4806 105.326C91.7286 102.678 92.49 100.204 93.6531 97.9829L96.9549 100.314L100.138 95.9662L96.7784 93.5964C100.265 89.8905 105.137 87.5459 110.475 87.3245L110.084 91.5016L115.46 91.9998L115.851 87.8227C121.057 89.0231 125.411 92.2228 128.149 96.5062L124.408 98.2181L126.732 103.076L130.408 101.392C131.14 103.788 131.431 106.36 131.183 109.008C130.935 111.656 130.175 114.131 129.01 116.352L125.856 114.125L122.803 118.563L125.887 120.738Z';
const DRIVE_HOLES_D =
  'M100.506 228.125C95.3445 228.125 91.1599 223.956 91.1599 218.813C91.1599 213.671 95.3445 209.501 100.506 209.501C105.668 209.501 109.852 213.671 109.852 218.813C109.852 223.956 105.668 228.125 100.506 228.125ZM137.608 221.917C133.224 221.917 129.67 218.377 129.67 214.009C129.67 209.641 133.224 206.1 137.608 206.1C141.992 206.100 145.546 209.641 145.546 214.009C145.545 218.377 141.991 221.917 137.608 221.917ZM242.111 221.917C237.727 221.917 234.173 218.377 234.173 214.009C234.173 209.641 237.727 206.100 242.111 206.100C246.495 206.100 250.048 209.641 250.048 214.009C250.048 218.377 246.496 221.917 242.111 221.917ZM278.671 228.125C273.509 228.125 269.325 223.956 269.325 218.813C269.325 213.671 273.508 209.501 278.671 209.501C283.832 209.501 288.017 213.671 288.017 218.813C288.017 223.956 283.832 228.125 278.671 228.125Z';
const LABEL_CLIP_D =
  'M339 14C347.837 14 355 21.1634 355 30V159C355 167.837 347.837 175 339 175H34C25.1634 175 18 167.837 18 159V30C18 21.1634 25.1634 14 34 14H339ZM105 81C94.0132 81 85 90.0132 85 101V113C85 123.987 94.0132 133 105 133H274C284.987 133 294 123.987 294 113V101C294 90.0132 284.097 81 274 81H105Z';

// Defaults from DEFAULT_CASSETTE_PARAMS in _placeholders-mock.tsx.
const CASSETTE = {
  circleRadius: 68,
  reelSize: 25,
  bodyLightness: 4,
  grainStrength: 0.04,
  vignetteStrength: 0.235,
  recessStrength: 0.5,
  circleColor: '#363535',
  teethColor: '#5e5a5a',
  leftReelX: 111,
  leftReelY: 107,
  rightReelX: 266,
  rightReelY: 107,
};

function buildCassetteSvg(shaderDataUri, grainSeed) {
  const c = CASSETTE;
  const cx = c.leftReelX, cy = c.leftReelY, R = c.circleRadius, rIn = c.reelSize * 1.05;
  const bodyFill = `rgb(${c.bodyLightness}, ${c.bodyLightness}, ${c.bodyLightness})`;
  const rs = c.recessStrength;
  const ringPath = [
    `M ${cx - R} ${cy}`,
    `A ${R} ${R} 0 1 0 ${cx + R} ${cy}`,
    `A ${R} ${R} 0 1 0 ${cx - R} ${cy}`,
    'Z',
    `M ${cx - rIn} ${cy}`,
    `A ${rIn} ${rIn} 0 1 0 ${cx + rIn} ${cy}`,
    `A ${rIn} ${rIn} 0 1 0 ${cx - rIn} ${cy}`,
    'Z',
  ].join(' ');
  const recessStops = `
    <stop offset="0" stop-color="black" stop-opacity="${Math.min(1, 0.55 * rs)}"/>
    <stop offset="0.06" stop-color="black" stop-opacity="${Math.min(1, 0.18 * rs)}"/>
    <stop offset="0.14" stop-color="black" stop-opacity="0"/>
    <stop offset="0.86" stop-color="black" stop-opacity="0"/>
    <stop offset="0.95" stop-color="black" stop-opacity="${Math.min(1, 0.10 * rs)}"/>
    <stop offset="1" stop-color="black" stop-opacity="${Math.min(1, 0.22 * rs)}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 373 233">
  <defs>
    <clipPath id="clip"><path d="${LABEL_CLIP_D}"/></clipPath>
    <filter id="grain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="${grainSeed}" result="noise"/>
      <feComposite in="SourceGraphic" in2="noise" operator="arithmetic" k1="0" k2="1" k3="${c.grainStrength}" k4="0"/>
    </filter>
    <linearGradient id="recess" x1="0" y1="0" x2="0" y2="1">${recessStops}
    </linearGradient>
    <radialGradient id="form" cx="50%" cy="50%" r="75%">
      <stop offset="0" stop-color="white" stop-opacity="${c.vignetteStrength * 0.2}"/>
      <stop offset="0.65" stop-color="black" stop-opacity="0"/>
      <stop offset="1" stop-color="black" stop-opacity="${c.vignetteStrength}"/>
    </radialGradient>
    <mask id="teethMask">
      <circle cx="${c.leftReelX}" cy="${c.leftReelY}" r="20" fill="white"/>
      <circle cx="${c.rightReelX}" cy="${c.rightReelY}" r="20" fill="white"/>
      <path d="${LEFT_REEL_D}" fill="black"/>
      <path d="${RIGHT_REEL_D}" fill="black"/>
    </mask>
    <mask id="bodyMask">
      <rect x="0" y="0" width="373" height="233" fill="white"/>
      <path d="${LEFT_REEL_D}" fill="black"/>
      <path d="${RIGHT_REEL_D}" fill="black"/>
      <rect x="152" y="96.5" width="75" height="21" fill="black"/>
    </mask>
  </defs>
  <path d="${ringPath}" fill="${c.circleColor}" fill-rule="evenodd"/>
  <g mask="url(#bodyMask)">
    <path d="${OUTER_BODY_D}${DRIVE_HOLES_D}" fill="${bodyFill}" fill-rule="evenodd" filter="url(#grain)"/>
    <path d="${OUTER_BODY_D}${DRIVE_HOLES_D}" fill="url(#form)" fill-rule="evenodd"/>
  </g>
  <rect x="0" y="0" width="373" height="233" fill="${c.teethColor}" mask="url(#teethMask)"/>
  <g clip-path="url(#clip)">
    <image href="${shaderDataUri}" x="18" y="14" width="337" height="161" preserveAspectRatio="xMidYMid slice"/>
    <rect x="18" y="14" width="337" height="161" fill="url(#recess)" style="mix-blend-mode: multiply"/>
  </g>
</svg>`;
}

console.log(`🖼️  Generating ${TAPES.length} placeholder cassettes (${OUTPUT_W}px wide)…\n`);
const startTotal = Date.now();

const randSeed = () => Math.floor(Math.random() * 0xffffffff);

for (let i = 0; i < TAPES.length; i++) {
  const tapeId = TAPES[i];
  const start = Date.now();
  const variant = variantPool[i % variantPool.length];
  const seed = randSeed();
  const params = variant.paramsFn(seed);
  const rgba = variant.renderFn(params, SHADER_W, SHADER_H);

  // RGBA → PNG buffer → base64 data URI for SVG <image>.
  const shaderPng = await sharp(Buffer.from(rgba.buffer), {
    raw: { width: SHADER_W, height: SHADER_H, channels: 4 },
  }).png({ compressionLevel: 6 }).toBuffer();
  const shaderDataUri = `data:image/png;base64,${shaderPng.toString('base64')}`;

  const grainSeed = hashString(tapeId) % 100;
  const svg = buildCassetteSvg(shaderDataUri, grainSeed);

  // density:288 = 4× the SVG's natural 72dpi → ~1492×932 base raster,
  // then resize to OUTPUT_W for the final encode.
  const basePath = join(OUTPUT_DIR, tapeId);
  const pipeline = sharp(Buffer.from(svg), { density: 288 }).resize(OUTPUT_W);
  await Promise.all([
    pipeline.clone().avif({ quality: 65, effort: 2 }).toFile(`${basePath}.avif`),
    pipeline.clone().png({ compressionLevel: 9 }).toFile(`${basePath}.png`),
  ]);
  const elapsed = Date.now() - start;
  console.log(`  ✓ ${tapeId}.{avif,png}  [${variant.name}]  (${elapsed}ms)`);
}

console.log(`\n✅ Done in ${Date.now() - startTotal}ms — ${OUTPUT_DIR}`);
