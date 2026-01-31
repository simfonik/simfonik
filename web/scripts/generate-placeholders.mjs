#!/usr/bin/env node
// Generate static SVG placeholders for tapes missing both cover and sides images

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generatePlaceholderSVG } from './lib/pattern-generator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TAPES_JSON_PATH = join(__dirname, '../data/tapes.json');
const OUTPUT_DIR = join(__dirname, '../public/generated/placeholders');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`✓ Created directory: ${OUTPUT_DIR}`);
}

// Load tapes
const raw = readFileSync(TAPES_JSON_PATH, 'utf8');
const tapes = JSON.parse(raw);

let generated = 0;
let skipped = 0;

console.log(`\nGenerating placeholders for ${tapes.length} tapes...\n`);

for (const tape of tapes) {
  // Skip tapes that have cover OR sides images
  const hasCover = tape.images?.cover && tape.images.cover !== '/media/site/blank-tape.svg';
  const hasSides = tape.sides?.some(side => side.image);
  
  if (hasCover || hasSides) {
    skipped++;
    continue;
  }
  
  const artistName = tape.djs[0]?.name || 'Unknown';
  const svg = generatePlaceholderSVG(artistName, tape.title, tape.released);
  
  const outputPath = join(OUTPUT_DIR, `${tape.id}.svg`);
  writeFileSync(outputPath, svg, 'utf8');
  
  generated++;
  console.log(`  ✓ ${tape.id}.svg (${artistName} - ${tape.title})`);
}

console.log(`\n✅ Generated ${generated} placeholders`);
console.log(`   Skipped ${skipped} tapes (have cover or sides images)\n`);
