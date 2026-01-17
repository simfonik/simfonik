#!/usr/bin/env node

/**
 * Phase 3: Update R2 URLs in tapes.json
 * 
 * Replaces all Dropbox URLs with R2 URLs.
 * Creates a backup before modifying.
 */

import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const R2_BASE_URL = 'https://audio.simfonik.com';
const tapesPath = join(__dirname, '../data/tapes.json');
const backupPath = join(__dirname, '../data/tapes.json.backup-pre-r2');

console.log('Phase 3: Update R2 URLs in tapes.json\n');

// Create backup
console.log(`Creating backup: ${backupPath}`);
copyFileSync(tapesPath, backupPath);
console.log('✓ Backup created\n');

// Read tapes.json
const tapes = JSON.parse(readFileSync(tapesPath, 'utf-8'));

let totalUpdated = 0;
let totalSkipped = 0;

// Update URLs
for (const tape of tapes) {
  if (!tape.sides || tape.sides.length === 0) continue;
  
  for (const side of tape.sides) {
    if (!side.audio_links || side.audio_links.length === 0) continue;
    
    for (const audioLink of side.audio_links) {
      const currentUrl = audioLink.url;
      
      // Only update Dropbox URLs
      if (currentUrl.includes('dropbox.com')) {
        // Generate R2 URL: https://audio.simfonik.com/tapes/<tape-id>/<side-position>.mp3
        const sidePositionLower = side.position.toLowerCase();
        const newUrl = `${R2_BASE_URL}/tapes/${tape.id}/${sidePositionLower}.mp3`;
        
        audioLink.url = newUrl;
        totalUpdated++;
        
        console.log(`✓ ${tape.id} [${side.position}]`);
        console.log(`  Old: ${currentUrl.substring(0, 60)}...`);
        console.log(`  New: ${newUrl}\n`);
      } else {
        totalSkipped++;
      }
    }
  }
}

// Write updated tapes.json
writeFileSync(tapesPath, JSON.stringify(tapes, null, 2), 'utf-8');

// Summary
console.log('═══════════════════════════════════════');
console.log(`✓ Updated: ${totalUpdated} URLs`);
if (totalSkipped > 0) {
  console.log(`⊘ Skipped: ${totalSkipped} non-Dropbox URLs`);
}
console.log(`\n✓ Backup saved to: tapes.json.backup-pre-r2`);
console.log(`✓ Updated tapes.json written\n`);

console.log('Next steps:');
console.log('1. Run: npm run validate');
console.log('2. Test locally: npm run dev');
console.log('3. Verify audio playback works');
console.log('4. Commit changes');
console.log('5. Deploy to production');
