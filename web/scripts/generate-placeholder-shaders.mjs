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
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  paramsFromSeed,
  asciiParamsFromSeed,
  renderShaderGradient,
  renderAsciiShader,
  hashString,
} from './lib/placeholder-shader.mjs';
import {
  OUTER_BODY_D,
  REEL_D,
  DRIVE_HOLES_D,
  buildRaisedPlate,
  buildRaisedPlateBorder,
  buildScrewInner,
  buildScrewPositions,
  buildTapeRing,
  LABEL_CLIP_D,
  CASSETTE_DEFAULTS,
} from './lib/cassette-svg.mjs';
import { mergeIntoManifest, shortHash } from './lib/asset-manifest.mjs';

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

// Cassette mechanism params — single source of truth in cassette-svg.mjs
// so the bake script, the dev playground, and the live placeholder
// component all stay in sync.
const CASSETTE = CASSETTE_DEFAULTS;

function buildCassetteSvg(shaderDataUri, grainSeed) {
  const c = CASSETTE;
  const hubR = c.reelSize * 1.05;
  const bodyFill = `rgb(${c.bodyLightness}, ${c.bodyLightness}, ${c.bodyLightness})`;
  const rs = c.recessStrength;
  // Bake the at-rest state: left reel full, right reel empty (matches
  // a cassette before the tape starts playing). The live placeholder
  // on tape pages animates these radii via track time.
  const ringPath = buildTapeRing(c.leftReelX, c.leftReelY, c.circleRadius, hubR);
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
    <clipPath id="bodyClip"><path d="${OUTER_BODY_D}"/></clipPath>
    <filter id="grain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="${grainSeed}" result="noise"/>
      <feComposite in="SourceGraphic" in2="noise" operator="arithmetic" k1="0" k2="1" k3="${c.grainStrength}" k4="0" result="grained"/>
      <!-- Clip the grain-tinted output to SourceGraphic alpha. Without
           this, feComposite arithmetic leaves a faint k3·noise tint in
           "transparent" pixels (alpha ≈ 6/255), producing a visible
           rectangular halo around the cassette on dark backgrounds. -->
      <feComposite in="grained" in2="SourceGraphic" operator="in"/>
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
      <path d="${REEL_D}" transform="translate(${c.leftReelX - 18} ${c.leftReelY - 18})" fill="black"/>
      <path d="${REEL_D}" transform="translate(${c.rightReelX - 18} ${c.rightReelY - 18})" fill="black"/>
    </mask>
    <mask id="bodyMask">
      <rect x="0" y="0" width="373" height="233" fill="white"/>
      <path d="${REEL_D}" transform="translate(${c.leftReelX - 18} ${c.leftReelY - 18})" fill="black"/>
      <path d="${REEL_D}" transform="translate(${c.rightReelX - 18} ${c.rightReelY - 18})" fill="black"/>
      <rect x="152" y="96.5" width="75" height="21" fill="black"/>
    </mask>
    <symbol id="screw" viewBox="0 0 24 24">${buildScrewInner(c.screwLightness, c.screwOuterLightness)}</symbol>
  </defs>
  <path d="${ringPath}" fill="${c.circleColor}" fill-rule="evenodd"/>
  <g mask="url(#bodyMask)">
    <path d="${OUTER_BODY_D}${DRIVE_HOLES_D}" fill="${bodyFill}" fill-rule="evenodd" filter="url(#grain)"/>
    <path d="${OUTER_BODY_D}${DRIVE_HOLES_D}" fill="url(#form)" fill-rule="evenodd"/>
  </g>
  <!-- Raised plate over the bottom drive-hole region. Slightly lighter
       than the body so it reads as a plateau catching ambient light;
       drive holes punch through via evenodd; clipped to the body so
       the bottom corners follow the cassette's rounded shell. -->
  <path d="${buildRaisedPlate(c.plateWidth, c.plateHeight)}${DRIVE_HOLES_D}" fill="rgb(${c.plateLightness}, ${c.plateLightness}, ${c.plateLightness})" fill-rule="evenodd" filter="url(#grain)" clip-path="url(#bodyClip)"/>
  <!-- Border along the plate's left/top/right edges (no bottom) —
       tunable lightness + thickness give a shadow/highlight that
       reads as raised plastic. Clipped to the body so the strokes
       at the bottom corners follow the cassette's rounded shell. -->
  <path d="${buildRaisedPlateBorder(c.plateWidth, c.plateHeight)}" fill="none" stroke="rgb(${c.plateBorderLightness}, ${c.plateBorderLightness}, ${c.plateBorderLightness})" stroke-width="${c.plateBorderWidth}" stroke-linejoin="miter" clip-path="url(#bodyClip)"/>
  <rect x="0" y="0" width="373" height="233" fill="${c.teethColor}" filter="url(#grain)" mask="url(#teethMask)"/>
  <g clip-path="url(#clip)">
    <image href="${shaderDataUri}" x="18" y="14" width="337" height="161" preserveAspectRatio="xMidYMid slice"/>
    <rect x="18" y="14" width="337" height="161" fill="url(#recess)" style="mix-blend-mode: multiply"/>
  </g>
  <!-- Outline around the label area + spool window for inset depth. -->
  <path d="${LABEL_CLIP_D}" fill="none" stroke="rgb(${c.artStrokeLightness}, ${c.artStrokeLightness}, ${c.artStrokeLightness})" stroke-width="${c.artStrokeWidth}" fill-rule="evenodd"/>
  <!-- Phillips screws at the four corners + middle of the raised plate. -->
  ${buildScrewPositions({
    insetX: c.screwInsetX,
    topY: c.screwTopY,
    bottomY: c.screwBottomY,
    centerX: c.screwCenterX,
    centerY: c.screwCenterY,
  })
    .map(
      (p) =>
        `<use href="#screw" x="${(p.x - c.screwSize / 2).toFixed(2)}" y="${(p.y - c.screwSize / 2).toFixed(2)}" width="${c.screwSize}" height="${c.screwSize}"/>`,
    )
    .join('\n  ')}
</svg>`;
}

console.log(`🖼️  Generating ${TAPES.length} placeholder cassettes (${OUTPUT_W}px wide)…\n`);
const startTotal = Date.now();

const manifestEntries = {};

// Deterministic per-tape seeding: re-baking on every Vercel deploy
// produces byte-identical output, keeping the manifest hash stable
// and the CDN cache valid until the tape itself changes. Variant
// alternates by index (stable 4/3 split for 7 tapes); shader seed is
// hashed from the tape ID directly (would be lumpy for variant choice
// at this small N, but produces good visual variety as a 32-bit seed).
for (let i = 0; i < TAPES.length; i++) {
  const tapeId = TAPES[i];
  const start = Date.now();
  const idHash = hashString(tapeId);
  const variant = variantPool[i % variantPool.length];
  const params = variant.paramsFn(idHash);
  const rgba = variant.renderFn(params, SHADER_W, SHADER_H);

  // RGBA → PNG buffer → base64 data URI for SVG <image>.
  const shaderPng = await sharp(Buffer.from(rgba.buffer), {
    raw: { width: SHADER_W, height: SHADER_H, channels: 4 },
  }).png({ compressionLevel: 6 }).toBuffer();
  const shaderDataUri = `data:image/png;base64,${shaderPng.toString('base64')}`;

  const grainSeed = idHash % 100;
  const svg = buildCassetteSvg(shaderDataUri, grainSeed);

  // density:288 = 4× the SVG's natural 72dpi → ~1492×932 base raster,
  // then resize to OUTPUT_W for the final encode.
  const basePath = join(OUTPUT_DIR, tapeId);
  const pipeline = sharp(Buffer.from(svg), { density: 288 }).resize(OUTPUT_W);
  const [avifBuffer, pngBuffer] = await Promise.all([
    pipeline.clone().avif({ quality: 65, effort: 2 }).toBuffer(),
    pipeline.clone().png({ compressionLevel: 9 }).toBuffer(),
  ]);
  writeFileSync(`${basePath}.avif`, avifBuffer);
  writeFileSync(`${basePath}.png`, pngBuffer);
  // Also write the bare shader artwork (no cassette frame) so the dev
  // page can wrap a live CassetteSvg around just the label content
  // without producing a duplicate set of reels.
  writeFileSync(`${basePath}-label.png`, shaderPng);
  // Hash of the AVIF bytes — that's what the loader cache-busts on.
  manifestEntries[`generated/placeholders/${tapeId}`] = shortHash(avifBuffer);
  const elapsed = Date.now() - start;
  console.log(`  ✓ ${tapeId}.{avif,png,-label.png}  [${variant.name}]  (${elapsed}ms)`);
}

mergeIntoManifest(manifestEntries);

console.log(`\n✅ Done in ${Date.now() - startTotal}ms — ${OUTPUT_DIR}`);
