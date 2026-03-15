#!/usr/bin/env node

/**
 * Pre-optimize tape cover images at build time
 * 
 * Generates responsive AVIF variants (400w, 800w, 1200w) for all tape covers.
 * Uses hash-based caching to skip unchanged images.
 * 
 * Usage:
 *   node scripts/optimize-images.mjs
 *   node scripts/optimize-images.mjs --only <tape-id>
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  optimizeImage,
  generateOgImage,
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
const QUALITY = 65;
const HERO_QUALITY = 55; // More aggressive compression for decorative background image
const OG_QUALITY = 90; // Higher quality for social sharing
const TAPES_JSON = path.join(ROOT, 'data', 'tapes.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'optimized');
const OG_DIR = path.join(PUBLIC_DIR, 'og');
const CACHE_FILE = path.join(ROOT, '.next', 'cache', 'image-optimization.json');

/**
 * Optimize a single image (cover or side)
 */
async function optimizeImageVariants(sourcePath, outputDir, cacheKeyPrefix, cache, stats, widths = WIDTHS, quality = QUALITY) {
  const sourceSize = fs.statSync(sourcePath).size;

  for (const width of widths) {
    const outputPath = path.join(outputDir, `${width}.avif`);
    const cacheKey = `${cacheKeyPrefix}:${width}`;

    // Check if optimization is needed
    if (!needsOptimization(sourcePath, outputPath, cache, cacheKey)) {
      stats.cached++;
      continue;
    }

    try {
      // Optimize image
      const { size } = await optimizeImage(sourcePath, outputPath, width, quality);

      // Update cache with source file hash
      cache[cacheKey] = getFileHash(sourcePath);

      stats.generated++;
      stats.totalSavings += sourceSize - size;
    } catch (error) {
      console.error(`❌ Failed to optimize ${cacheKeyPrefix}/${width}.avif:`, error.message);
      stats.failed++;
    }
  }
}

/**
 * Generate Open Graph image for social sharing (1200×630)
 */
async function generateOgImageForTape(sourcePath, tapeId, cache, stats) {
  const outputPath = path.join(OG_DIR, `${tapeId}.jpg`);
  const cacheKey = `og:${tapeId}`;

  // Check if generation is needed
  if (!needsOptimization(sourcePath, outputPath, cache, cacheKey)) {
    stats.ogCached++;
    return;
  }

  try {
    await generateOgImage(sourcePath, outputPath, OG_QUALITY);

    // Update cache with source file hash
    cache[cacheKey] = getFileHash(sourcePath);

    stats.ogGenerated++;
  } catch (error) {
    console.error(`❌ Failed to generate OG image for ${tapeId}:`, error.message);
    stats.failed++;
  }
}

/**
 * Main optimization routine
 */
async function main() {
  console.log('🖼️  Image Optimization\n');

  // Parse --only flag
  const onlyIndex = process.argv.indexOf('--only');
  const onlyId = onlyIndex !== -1 ? process.argv[onlyIndex + 1] : null;

  // Load tapes data
  let tapes = JSON.parse(fs.readFileSync(TAPES_JSON, 'utf8'));
  if (onlyId) {
    tapes = tapes.filter(t => t.id === onlyId);
    if (tapes.length === 0) {
      console.error(`❌ No tape found with id: ${onlyId}`);
      process.exit(1);
    }
    console.log(`🎯 Processing only: ${onlyId}\n`);
  } else {
    console.log(`📼 Loaded ${tapes.length} tapes from tapes.json\n`);
  }

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
    ogGenerated: 0,
    ogCached: 0,
  };

  // Process site images first (skip when --only is used)
  if (!onlyId) {
    const heroSource = path.join(PUBLIC_DIR, 'media/site/home-hero.jpg');
    if (fs.existsSync(heroSource)) {
      const heroOutputDir = path.join(OUTPUT_DIR, 'site');
      await optimizeImageVariants(heroSource, heroOutputDir, 'site:home-hero', cache, stats, HERO_WIDTHS, HERO_QUALITY);
      stats.heroProcessed = true;
      console.log('✅ Optimized hero image\n');
    }

    const aboutSource = path.join(PUBLIC_DIR, 'media/site/recording-setup-cropped.jpg');
    if (fs.existsSync(aboutSource)) {
      const aboutOutputDir = path.join(OUTPUT_DIR, 'site', 'about');
      await optimizeImageVariants(aboutSource, aboutOutputDir, 'site:about', cache, stats);
      console.log('✅ Optimized about page image\n');
    }
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
          // Generate responsive AVIF variants
          const outputDir = path.join(OUTPUT_DIR, tape.id);
          await optimizeImageVariants(sourcePath, outputDir, tape.id, cache, stats);

          // Generate OG image for social sharing
          await generateOgImageForTape(sourcePath, tape.id, cache, stats);

          stats.coversProcessed++;
        } else {
          console.warn(`⚠️  Cover not found: ${coverPath}`);
          stats.failed++;
        }
      }
    }

    // No cover — generate OG from side A if available
    if (!tape.images?.cover && tape.sides) {
      const sideA = tape.sides.find(s => s.position === 'A' && s.image?.endsWith('.jpg'));
      if (sideA) {
        const sourcePath = path.join(PUBLIC_DIR, sideA.image.replace(/^\//, ''));
        if (fs.existsSync(sourcePath)) {
          await generateOgImageForTape(sourcePath, tape.id, cache, stats);
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
  console.log(`   OG images: ${stats.ogGenerated} generated, ${stats.ogCached} cached`);

  if (stats.failed > 0) {
    console.log(`   Failed:    ${stats.failed} images`);
  }

  if (stats.generated > 0) {
    console.log(`   Savings:   ${formatBytes(stats.totalSavings)} vs original JPGs`);
  }

  console.log(`\n✨ Optimization complete!`);
  console.log(`   Output: ${OUTPUT_DIR}`);
  console.log(`   OG images: ${OG_DIR}`);
  if (stats.heroProcessed) {
    console.log(`   Hero image: optimized (${HERO_WIDTHS.join('w, ')}w)`);
  }
  console.log(`   Covers optimized: ${stats.coversProcessed} tapes`);
  console.log(`   Sides optimized: ${stats.sidesProcessed} images`);
  console.log(`   OG images: ${stats.ogGenerated + stats.ogCached} (1200×630 for social sharing)`);
  console.log(`   Variants per tape image: ${WIDTHS.length} (${WIDTHS.join('w, ')}w)\n`);

  if (stats.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
