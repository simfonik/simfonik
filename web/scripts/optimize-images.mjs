#!/usr/bin/env node

/**
 * Pre-optimize tape cover images at build time
 * 
 * Generates responsive WebP variants (400w, 800w, 1200w) for all tape covers.
 * Uses hash-based caching to skip unchanged images.
 * 
 * Usage:
 *   node scripts/optimize-images.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  optimizeImage,
  getFileHash,
  needsOptimization,
  loadCache,
  saveCache,
  formatBytes,
} from './lib/image-optimizer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Configuration
const WIDTHS = [400, 800, 1200];
const QUALITY = 85;
const TAPES_JSON = path.join(ROOT, 'data', 'tapes.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'optimized');
const CACHE_FILE = path.join(ROOT, '.next', 'cache', 'image-optimization.json');

/**
 * Main optimization routine
 */
async function main() {
  console.log('🖼️  Image Optimization\n');

  // Load tapes data
  const tapes = JSON.parse(fs.readFileSync(TAPES_JSON, 'utf8'));
  console.log(`📼 Loaded ${tapes.length} tapes from tapes.json\n`);

  // Load optimization cache
  const cache = loadCache(CACHE_FILE);

  // Filter tapes with real JPG covers
  const tapesWithCovers = tapes.filter((tape) => {
    const cover = tape.images?.cover;
    return cover && cover.includes('/media/') && cover.endsWith('.jpg');
  });

  console.log(`✅ Found ${tapesWithCovers.length} tapes with JPG covers`);
  console.log(`⏭️  Skipping ${tapes.length - tapesWithCovers.length} tapes (placeholders or no cover)\n`);

  let generated = 0;
  let cached = 0;
  let failed = 0;
  let totalSavings = 0;

  // Process each tape
  for (const tape of tapesWithCovers) {
    const coverPath = tape.images.cover.replace(/^\//, '');
    const sourcePath = path.join(PUBLIC_DIR, coverPath);

    // Check if source file exists
    if (!fs.existsSync(sourcePath)) {
      console.warn(`⚠️  Source not found: ${coverPath}`);
      failed++;
      continue;
    }

    // Get source file size
    const sourceSize = fs.statSync(sourcePath).size;

    // Process each width variant
    for (const width of WIDTHS) {
      const outputPath = path.join(OUTPUT_DIR, tape.id, `${width}.webp`);
      const cacheKey = `${tape.id}:${width}`;

      // Check if optimization is needed
      if (!needsOptimization(sourcePath, outputPath, cache, cacheKey)) {
        cached++;
        continue;
      }

      try {
        // Optimize image
        const { size } = await optimizeImage(sourcePath, outputPath, width, QUALITY);
        
        // Update cache with source file hash
        cache[cacheKey] = getFileHash(sourcePath);
        
        generated++;
        totalSavings += sourceSize - size;
      } catch (error) {
        console.error(`❌ Failed to optimize ${tape.id}/${width}.webp:`, error.message);
        failed++;
      }
    }
  }

  // Save cache
  saveCache(CACHE_FILE, cache);

  // Print summary
  console.log('\n📊 Summary:');
  console.log(`   Generated: ${generated} images`);
  console.log(`   Cached:    ${cached} images (unchanged)`);
  
  if (failed > 0) {
    console.log(`   Failed:    ${failed} images`);
  }

  if (generated > 0) {
    console.log(`   Savings:   ${formatBytes(totalSavings)} vs original JPGs`);
  }

  console.log(`\n✨ Optimization complete!`);
  console.log(`   Output: ${OUTPUT_DIR}`);
  console.log(`   Total tapes optimized: ${tapesWithCovers.length}`);
  console.log(`   Variants per tape: ${WIDTHS.length} (${WIDTHS.join('w, ')}w)\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
