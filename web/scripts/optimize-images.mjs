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
const HERO_WIDTHS = [640, 1024, 1920]; // Viewport-based widths for hero
const QUALITY = 85;
const TAPES_JSON = path.join(ROOT, 'data', 'tapes.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'optimized');
const CACHE_FILE = path.join(ROOT, '.next', 'cache', 'image-optimization.json');

/**
 * Optimize a single image (cover or side)
 */
async function optimizeImageVariants(sourcePath, outputDir, cacheKeyPrefix, cache, stats, widths = WIDTHS) {
  const sourceSize = fs.statSync(sourcePath).size;

  for (const width of widths) {
    const outputPath = path.join(outputDir, `${width}.webp`);
    const cacheKey = `${cacheKeyPrefix}:${width}`;

    // Check if optimization is needed
    if (!needsOptimization(sourcePath, outputPath, cache, cacheKey)) {
      stats.cached++;
      continue;
    }

    try {
      // Optimize image
      const { size } = await optimizeImage(sourcePath, outputPath, width, QUALITY);
      
      // Update cache with source file hash
      cache[cacheKey] = getFileHash(sourcePath);
      
      stats.generated++;
      stats.totalSavings += sourceSize - size;
    } catch (error) {
      console.error(`❌ Failed to optimize ${cacheKeyPrefix}/${width}.webp:`, error.message);
      stats.failed++;
    }
  }
}

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

  const stats = {
    generated: 0,
    cached: 0,
    failed: 0,
    totalSavings: 0,
    coversProcessed: 0,
    sidesProcessed: 0,
    heroProcessed: false,
  };

  // Process hero image first
  const heroPath = 'media/site/home-hero.jpg';
  const heroSource = path.join(PUBLIC_DIR, heroPath);
  if (fs.existsSync(heroSource)) {
    const heroOutputDir = path.join(OUTPUT_DIR, 'site');
    await optimizeImageVariants(heroSource, heroOutputDir, 'site:home-hero', cache, stats, HERO_WIDTHS);
    stats.heroProcessed = true;
    console.log('✅ Optimized hero image\n');
  }

  // Process each tape
  for (const tape of tapes) {
    // Process cover image if it's a JPG
    if (tape.images?.cover) {
      const cover = tape.images.cover;
      if (cover.includes('/media/') && cover.endsWith('.jpg')) {
        const coverPath = cover.replace(/^\//, '');
        const sourcePath = path.join(PUBLIC_DIR, coverPath);

        if (fs.existsSync(sourcePath)) {
          const outputDir = path.join(OUTPUT_DIR, tape.id);
          await optimizeImageVariants(sourcePath, outputDir, tape.id, cache, stats);
          stats.coversProcessed++;
        } else {
          console.warn(`⚠️  Cover not found: ${coverPath}`);
          stats.failed++;
        }
      }
    }

    // Process side images if they're JPGs
    if (tape.sides && Array.isArray(tape.sides)) {
      for (const side of tape.sides) {
        if (side.image && side.image.includes('/media/') && side.image.endsWith('.jpg')) {
          const sidePath = side.image.replace(/^\//, '');
          const sourcePath = path.join(PUBLIC_DIR, sidePath);

          if (fs.existsSync(sourcePath)) {
            const sidePosition = side.position.toLowerCase();
            const outputDir = path.join(OUTPUT_DIR, tape.id, 'sides', sidePosition);
            const cacheKey = `${tape.id}:sides:${sidePosition}`;
            await optimizeImageVariants(sourcePath, outputDir, cacheKey, cache, stats);
            stats.sidesProcessed++;
          } else {
            console.warn(`⚠️  Side image not found: ${sidePath}`);
            stats.failed++;
          }
        }
      }
    }
  }

  // Save cache
  saveCache(CACHE_FILE, cache);

  // Print summary
  console.log('\n📊 Summary:');
  console.log(`   Generated: ${stats.generated} images`);
  console.log(`   Cached:    ${stats.cached} images (unchanged)`);
  
  if (stats.failed > 0) {
    console.log(`   Failed:    ${stats.failed} images`);
  }

  if (stats.generated > 0) {
    console.log(`   Savings:   ${formatBytes(stats.totalSavings)} vs original JPGs`);
  }

  console.log(`\n✨ Optimization complete!`);
  console.log(`   Output: ${OUTPUT_DIR}`);
  if (stats.heroProcessed) {
    console.log(`   Hero image: optimized (${HERO_WIDTHS.join('w, ')}w)`);
  }
  console.log(`   Covers optimized: ${stats.coversProcessed} tapes`);
  console.log(`   Sides optimized: ${stats.sidesProcessed} images`);
  console.log(`   Variants per tape image: ${WIDTHS.length} (${WIDTHS.join('w, ')}w)\n`);

  if (stats.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
