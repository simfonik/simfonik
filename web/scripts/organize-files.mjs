#!/usr/bin/env node

/**
 * Organize Files for R2 Upload
 * 
 * Reads the reviewed file-mapping.csv and organizes files into
 * the R2 directory structure ready for upload.
 */

import { readFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, parse } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const sourceDir = process.argv[2];
const targetDir = process.argv[3];

if (!sourceDir || !targetDir) {
  console.error('Usage: node organize-files.mjs <source-dir> <target-dir>');
  console.error('\nExample:');
  console.error('  node organize-files.mjs ~/Downloads/simfonik-audio-r2 ~/Desktop/r2-upload');
  process.exit(1);
}

// Read mapping CSV
const csvPath = join(__dirname, 'file-mapping.csv');
let csvContent;
try {
  csvContent = readFileSync(csvPath, 'utf-8');
} catch (err) {
  console.error(`Error reading ${csvPath}`);
  console.error('Run match-local-files.mjs first to generate the mapping file.');
  process.exit(1);
}

// Parse CSV (simple parser, assumes quoted fields)
const lines = csvContent.split('\n').slice(1); // Skip header
const mappings = lines
  .filter(line => line.trim())
  .map(line => {
    const matches = line.match(/"([^"]*)"/g);
    if (!matches || matches.length < 7) return null;
    return {
      localFile: matches[0].replace(/"/g, ''),
      tapeId: matches[1].replace(/"/g, ''),
      sidePosition: matches[2].replace(/"/g, ''),
      dropboxFilename: matches[3].replace(/"/g, ''),
      r2Path: matches[4].replace(/"/g, ''),
      confidence: matches[5].replace(/"/g, ''),
      action: matches[6].replace(/"/g, '')
    };
  })
  .filter(m => m !== null && m.action === 'copy' && m.r2Path);

console.log(`Found ${mappings.length} files to organize\n`);

let copied = 0;
let skipped = 0;
let errors = 0;

for (const mapping of mappings) {
  const sourcePath = join(sourceDir, mapping.localFile);
  const targetPath = join(targetDir, mapping.r2Path);
  
  // Check if source exists
  if (!existsSync(sourcePath)) {
    console.error(`✗ Source not found: ${mapping.localFile}`);
    errors++;
    continue;
  }
  
  // Create target directory
  const targetDirPath = parse(targetPath).dir;
  try {
    mkdirSync(targetDirPath, { recursive: true });
  } catch (err) {
    console.error(`✗ Failed to create directory: ${targetDirPath}`);
    errors++;
    continue;
  }
  
  // Copy file
  try {
    copyFileSync(sourcePath, targetPath);
    console.log(`✓ ${mapping.localFile} → ${mapping.r2Path}`);
    copied++;
  } catch (err) {
    console.error(`✗ Failed to copy: ${mapping.localFile}`);
    console.error(`  Error: ${err.message}`);
    errors++;
  }
}

console.log(`\n═══════════════════════════════════════`);
console.log(`✓ Copied: ${copied} files`);
if (errors > 0) {
  console.log(`✗ Errors: ${errors} files`);
}
console.log(`\nFiles organized in: ${targetDir}`);
console.log(`\nNext steps:`);
console.log(`1. Verify the organized files`);
console.log(`2. Upload to R2 using wrangler or rclone`);
console.log(`3. Run update-r2-urls.mjs to update tapes.json`);
