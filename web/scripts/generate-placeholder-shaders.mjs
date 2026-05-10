#!/usr/bin/env node
/**
 * Bake the placeholder shader output into static PNGs at build time.
 *
 * Pure-JS shaders (web/scripts/lib/placeholder-shader.mjs) compute
 * raw RGBA pixels; Sharp encodes the PNG. No WebGL, no headless
 * browser, no native deps beyond Sharp (already in the project).
 *
 * Output: web/public/generated/placeholders/{tapeId}-{variant}.png
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
  paramsPerlinFromSeed,
  paramsRetroFromSeed,
  renderShaderGradient,
  renderAsciiShader,
  renderPerlinOrganic,
  renderRetroDither,
} from './lib/placeholder-shader.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'public', 'generated', 'placeholders');
const TAPES_JSON = join(ROOT, 'data', 'tapes.json');

// Auto-discover tapes without cover or side images — those are the
// ones that render placeholders in production.
const allTapes = JSON.parse(readFileSync(TAPES_JSON, 'utf8'));
const TAPES = allTapes
  .filter((t) => {
    const hasCover =
      t.images?.cover && t.images.cover !== '/media/site/blank-tape.svg';
    const hasSides = t.sides?.some((s) => s.image);
    return !hasCover && !hasSides;
  })
  .map((t) => t.id);

const WIDTH = 1024;
const HEIGHT = 512;

mkdirSync(OUTPUT_DIR, { recursive: true });

// Pool of variant styles. Each tape gets ONE variant chosen at build
// time, saved with a generic filename ({tapeId}.avif/png) so callers
// don't need to know which style won.
const variantPool = [
  { name: 'shader', paramsFn: paramsFromSeed,      renderFn: renderShaderGradient },
  { name: 'ascii',  paramsFn: asciiParamsFromSeed, renderFn: renderAsciiShader },
];

console.log(`🖼️  Generating ${TAPES.length} placeholder images (${WIDTH}×${HEIGHT})…\n`);
const startTotal = Date.now();

const randSeed = () => Math.floor(Math.random() * 0xffffffff);

for (let i = 0; i < TAPES.length; i++) {
  const tapeId = TAPES[i];
  const start = Date.now();
  // Alternate: even indexes → first variant, odd → second.
  const variant = variantPool[i % variantPool.length];
  const seed = randSeed();
  const params = variant.paramsFn(seed);
  const rgba = variant.renderFn(params, WIDTH, HEIGHT);
  const basePath = join(OUTPUT_DIR, tapeId);
  const pipeline = sharp(Buffer.from(rgba.buffer), {
    raw: { width: WIDTH, height: HEIGHT, channels: 4 },
  });
  await Promise.all([
    pipeline.clone().avif({ quality: 65, effort: 2 }).toFile(`${basePath}.avif`),
    pipeline.clone().png({ compressionLevel: 9 }).toFile(`${basePath}.png`),
  ]);
  const elapsed = Date.now() - start;
  console.log(`  ✓ ${tapeId}.{avif,png}  [${variant.name}]  (${elapsed}ms)`);
}

console.log(`\n✅ Done in ${Date.now() - startTotal}ms — ${OUTPUT_DIR}`);
