#!/usr/bin/env node

/**
 * Match Local Files to R2 Migration Manifest
 * 
 * Reads local audio files and matches them to the manifest entries.
 * Outputs a CSV for manual review before organizing files.
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const localDir = process.argv[2];

if (!localDir) {
  console.error('Usage: node match-local-files.mjs <path-to-local-audio-directory>');
  process.exit(1);
}

// Read manifest
const manifestPath = join(__dirname, 'r2-migration-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

// Extract Dropbox filenames from URLs
const manifestWithFilenames = manifest.map(entry => ({
  ...entry,
  dropboxFilename: entry.dropboxUrl.split('/').pop().split('?')[0]
}));

// Read local files
let localFiles;
try {
  localFiles = readdirSync(localDir).filter(f => f.endsWith('.mp3'));
} catch (err) {
  console.error(`Error reading directory: ${localDir}`);
  console.error(err.message);
  process.exit(1);
}

console.log(`Found ${localFiles.length} local MP3 files`);
console.log(`Matching against ${manifest.length} manifest entries\n`);

// Normalize for comparison (lowercase, remove dashes/spaces)
const normalize = (str) => str.toLowerCase().replace(/[-\s]/g, '');

// Match files
const matches = [];
const unmatched = [];

for (const localFile of localFiles) {
  const normalizedLocal = normalize(localFile);
  
  // Try exact match first
  let match = manifestWithFilenames.find(m => 
    normalize(m.dropboxFilename) === normalizedLocal
  );
  
  if (match) {
    matches.push({
      localFile,
      tapeId: match.tapeId,
      sidePosition: match.sidePosition,
      dropboxFilename: match.dropboxFilename,
      r2Path: match.r2Path,
      confidence: 'EXACT',
      action: 'copy'
    });
    continue;
  }
  
  // Try fuzzy match - find entries where dropbox filename is contained in local filename
  const fuzzyMatches = manifestWithFilenames.filter(m => 
    normalizedLocal.includes(normalize(m.dropboxFilename).replace('.mp3', '')) ||
    normalize(m.dropboxFilename).replace('.mp3', '').includes(normalizedLocal.replace('.mp3', ''))
  );
  
  if (fuzzyMatches.length === 1) {
    match = fuzzyMatches[0];
    matches.push({
      localFile,
      tapeId: match.tapeId,
      sidePosition: match.sidePosition,
      dropboxFilename: match.dropboxFilename,
      r2Path: match.r2Path,
      confidence: 'FUZZY',
      action: 'copy'
    });
  } else if (fuzzyMatches.length > 1) {
    // Multiple matches - add as unmatched with suggestions
    unmatched.push({
      localFile,
      tapeId: '',
      sidePosition: '',
      dropboxFilename: fuzzyMatches.map(m => m.dropboxFilename).join(' | '),
      r2Path: '',
      confidence: 'MULTIPLE',
      action: 'skip'
    });
  } else {
    // No match found
    unmatched.push({
      localFile,
      tapeId: '',
      sidePosition: '',
      dropboxFilename: '',
      r2Path: '',
      confidence: 'NONE',
      action: 'skip'
    });
  }
}

// Generate CSV
const csvRows = [
  'localFile,tapeId,sidePosition,dropboxFilename,r2Path,confidence,action'
];

// Add matched files first
matches.forEach(m => {
  csvRows.push(`"${m.localFile}","${m.tapeId}","${m.sidePosition}","${m.dropboxFilename}","${m.r2Path}","${m.confidence}","${m.action}"`);
});

// Add unmatched files
unmatched.forEach(m => {
  csvRows.push(`"${m.localFile}","${m.tapeId}","${m.sidePosition}","${m.dropboxFilename}","${m.r2Path}","${m.confidence}","${m.action}"`);
});

const csvPath = join(__dirname, 'file-mapping.csv');
writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');

// Print summary
console.log(`✓ Matched ${matches.length} files`);
console.log(`  - ${matches.filter(m => m.confidence === 'EXACT').length} exact matches`);
console.log(`  - ${matches.filter(m => m.confidence === 'FUZZY').length} fuzzy matches`);
console.log(`\n⚠ ${unmatched.length} unmatched files`);
console.log(`  - ${unmatched.filter(m => m.confidence === 'MULTIPLE').length} with multiple possibilities`);
console.log(`  - ${unmatched.filter(m => m.confidence === 'NONE').length} with no match found`);
console.log(`\n✓ Saved mapping to: ${csvPath}`);
console.log(`\nNext steps:`);
console.log(`1. Review file-mapping.csv`);
console.log(`2. Fix any incorrect matches or fill in missing tape IDs`);
console.log(`3. Set action to "skip" for files you don't want to upload`);
console.log(`4. Run: node organize-files.mjs <source-dir> <target-dir>`);
