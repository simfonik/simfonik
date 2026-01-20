#!/usr/bin/env node
/**
 * Generate redirects.json from CSV and tapes data
 * 
 * Usage: node scripts/generate-redirects.mjs
 * 
 * Creates redirects for:
 * 1. Old WordPress post URLs → new tape URLs (from CSV)
 * 2. /tag/{dj-slug} → /djs/{dj-slug} (from tapes.json)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(process.env.HOME, 'Desktop/simfonik-redirect-old-to-new-urls.csv');
const tapesPath = path.join(__dirname, '../data/tapes.json');
const outputPath = path.join(__dirname, '../data/redirects.json');

const redirects = [];

// 1. Parse CSV for old WordPress post URLs → new tape URLs
console.log('Reading CSV redirects from', csvPath);
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n').slice(1); // Skip header

lines.forEach(line => {
  if (!line.trim()) return;
  
  const [current, old] = line.split(',');
  
  if (!old || !old.trim()) return;
  
  // Skip Wayback Machine URLs or other invalid entries
  if (old.includes('web.archive.org') || old.includes('://')) return;
  
  const oldPath = '/' + old.trim()
    .replace(/^simfonik\.com\//, '')
    .replace(/\/$/, '');
  const newPath = current.replace(/^https?:\/\/simfonik\.com/, '');
  
  redirects.push({
    source: oldPath,
    destination: newPath,
    permanent: true,
  });
});

console.log(`✓ Added ${redirects.length} tape redirects from CSV`);

// 2. Generate /tag/{dj-slug} → /djs/{dj-slug} redirects
console.log('Generating DJ tag redirects...');
const tapes = JSON.parse(fs.readFileSync(tapesPath, 'utf-8'));

// Get unique DJ slugs
const djSlugs = new Set();
tapes.forEach(tape => {
  if (tape.djs) {
    tape.djs.forEach(dj => {
      if (dj.slug) {
        djSlugs.add(dj.slug);
      }
    });
  }
});

// Create tag redirects
djSlugs.forEach(slug => {
  redirects.push({
    source: `/tag/${slug}`,
    destination: `/djs/${slug}`,
    permanent: true,
  });
});

console.log(`✓ Added ${djSlugs.size} DJ tag redirects`);

// Write output
fs.writeFileSync(outputPath, JSON.stringify(redirects, null, 2));
console.log(`\n✅ Generated ${redirects.length} total redirects to ${outputPath}`);
