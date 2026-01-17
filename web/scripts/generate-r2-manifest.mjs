#!/usr/bin/env node

/**
 * Phase 1: Generate R2 Migration Manifest
 * 
 * Extracts all Dropbox URLs from tapes.json and generates a manifest
 * mapping each audio file to its target R2 path.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read tapes.json
const tapesPath = join(__dirname, '../data/tapes.json');
const tapes = JSON.parse(readFileSync(tapesPath, 'utf-8'));

const manifest = [];

// Extract all Dropbox URLs
for (const tape of tapes) {
  if (!tape.sides || tape.sides.length === 0) continue;
  
  for (const side of tape.sides) {
    if (!side.audio_links || side.audio_links.length === 0) continue;
    
    for (const audioLink of side.audio_links) {
      const url = audioLink.url;
      
      // Only process Dropbox URLs
      if (!url.includes('dropbox.com')) continue;
      
      // Calculate R2 path: tapes/<tape-id>/<side-position-lowercase>.mp3
      const sidePositionLower = side.position.toLowerCase();
      const r2Path = `tapes/${tape.id}/${sidePositionLower}.mp3`;
      
      manifest.push({
        tapeId: tape.id,
        sidePosition: side.position,
        dropboxUrl: url,
        r2Path: r2Path,
      });
    }
  }
}

// Write manifest
const manifestPath = join(__dirname, 'r2-migration-manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

console.log(`✓ Generated manifest with ${manifest.length} audio files`);
console.log(`✓ Saved to: ${manifestPath}`);
console.log(`\nNext steps:`);
console.log(`1. Create R2 bucket named 'simfonik-audio'`);
console.log(`2. Upload files using this manifest as a guide`);
console.log(`3. Run update-r2-urls.mjs to update tapes.json`);
