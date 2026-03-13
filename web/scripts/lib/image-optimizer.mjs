/**
 * Image optimization utilities using sharp
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

/**
 * Generate MD5 hash of file contents for caching
 */
export function getFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Check if optimization is needed based on cache
 */
export function needsOptimization(sourceFile, outputFile, cache, cacheKey) {
  // If output doesn't exist, needs optimization
  if (!fs.existsSync(outputFile)) {
    return true;
  }

  // If no cache entry, needs optimization
  if (!cache[cacheKey]) {
    return true;
  }

  // If source file has changed, needs optimization
  const currentHash = getFileHash(sourceFile);
  if (cache[cacheKey] !== currentHash) {
    return true;
  }

  return false;
}

/**
 * Optimize an image to AVIF at specified width and quality
 * 
 * @param {string} inputPath - Path to source image
 * @param {string} outputPath - Path to write optimized image
 * @param {number} width - Target width in pixels
 * @param {number} quality - AVIF quality (0-100)
 * @returns {Promise<{size: number}>} Output file size
 */
export async function optimizeImage(inputPath, outputPath, width, quality = 60) {
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  // Process image with sharp
  await sharp(inputPath)
    .resize(width, null, {
      width,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .avif({ quality, effort: 4 })
    .toFile(outputPath);

  // Return file stats
  const stats = fs.statSync(outputPath);
  return { size: stats.size };
}

/**
 * Generate Open Graph image with letterboxing
 * 
 * Creates a 1200×630 image (Facebook's recommended OG size) with black letterboxing
 * to preserve the entire source image without cropping.
 * 
 * @param {string} inputPath - Path to source image
 * @param {string} outputPath - Path to write OG image
 * @param {number} quality - JPEG quality (0-100)
 * @returns {Promise<{size: number}>} Output file size
 */
export async function generateOgImage(inputPath, outputPath, quality = 90) {
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  // Process image with sharp - fit: 'contain' adds letterboxing automatically
  await sharp(inputPath)
    .resize(1200, 630, {
      fit: 'contain', // Fit entire image, add padding as needed
      background: { r: 0, g: 0, b: 0 }, // Black letterboxing
    })
    .jpeg({ quality })
    .toFile(outputPath);

  // Return file stats
  const stats = fs.statSync(outputPath);
  return { size: stats.size };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Load optimization cache from disk
 */
export function loadCache(cachePath) {
  try {
    if (fs.existsSync(cachePath)) {
      const content = fs.readFileSync(cachePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('Failed to load cache, starting fresh:', error.message);
  }
  return {};
}

/**
 * Save optimization cache to disk
 */
export function saveCache(cachePath, cache) {
  const cacheDir = path.dirname(cachePath);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
}
