#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const TAPES_JSON_PATH = join(__dirname, '../data/tapes.json');
const PUBLIC_DIR = join(__dirname, '../public');

// Regex for valid slugs
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Error and warning collectors
const errors = [];
const warnings = [];

function addError(tapeId, path, message, hint) {
  errors.push({ tapeId, path, message, hint });
}

function addWarning(tapeId, path, message) {
  warnings.push({ tapeId, path, message });
}

// Validate a slug format
function isValidSlug(slug) {
  return typeof slug === 'string' && SLUG_REGEX.test(slug);
}

// Check if Dropbox URL is streamable
function validateDropboxUrl(url, tapeId, sidePath) {
  if (!url.includes('dropbox.com')) return;
  
  const isStreamable = 
    url.includes('raw=1') || 
    url.includes('dl.dropboxusercontent.com');
  
  if (!isStreamable) {
    const hasDl0 = url.includes('dl=0');
    const hint = hasDl0 
      ? 'Replace dl=0 with raw=1 in the URL'
      : 'Add raw=1 parameter to the URL';
    addError(tapeId, sidePath, 'Dropbox URL is not streamable', hint);
  }
}

// Check if a media file exists
function validateMediaPath(mediaPath, tapeId, jsonPath) {
  if (!mediaPath || !mediaPath.startsWith('/media/')) return;
  
  const filePath = join(PUBLIC_DIR, mediaPath);
  if (!existsSync(filePath)) {
    addError(
      tapeId, 
      jsonPath, 
      `Media file not found: ${mediaPath}`,
      `Create the file at web/public${mediaPath}`
    );
  }
}

// Main validation
function validateTapes() {
  // Read and parse JSON
  let tapes;
  try {
    const content = readFileSync(TAPES_JSON_PATH, 'utf-8');
    tapes = JSON.parse(content);
  } catch (err) {
    console.error('❌ Failed to read or parse tapes.json:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(tapes)) {
    console.error('❌ tapes.json must contain an array');
    process.exit(1);
  }

  // Track IDs and DJ slug->name mapping
  const seenIds = new Set();
  const djSlugToNames = new Map(); // slug -> Set of names

  // Validate each tape
  tapes.forEach((tape, idx) => {
    const tapeNum = idx + 1;
    
    // Validate tape.id
    if (!tape.id || typeof tape.id !== 'string' || tape.id.trim() === '') {
      addError(`tape[${tapeNum}]`, 'id', 'ID is missing or empty', 'Add a unique slug-format ID');
      return; // Can't continue without ID
    }
    
    if (!isValidSlug(tape.id)) {
      addError(
        tape.id, 
        'id', 
        'ID must match format: ^[a-z0-9]+(?:-[a-z0-9]+)*$',
        'Use lowercase letters, numbers, and hyphens only'
      );
    }
    
    if (seenIds.has(tape.id)) {
      addError(tape.id, 'id', 'Duplicate tape ID', 'Each tape must have a unique ID');
    }
    seenIds.add(tape.id);

    // Validate tape.title
    if (!tape.title || typeof tape.title !== 'string' || tape.title.trim() === '') {
      addError(tape.id, 'title', 'Title is missing or empty', 'Add a title for this tape');
    }

    // Validate tape.released (optional, but warn if present and empty)
    if (tape.released !== undefined && (!tape.released || tape.released.trim() === '')) {
      addWarning(tape.id, 'released', 'Released field is present but empty');
    }

    // Validate tape.djs
    if (!Array.isArray(tape.djs) || tape.djs.length === 0) {
      addError(tape.id, 'djs', 'Must have at least one DJ', 'Add at least one DJ with name and slug');
    } else {
      tape.djs.forEach((dj, djIdx) => {
        const djPath = `djs[${djIdx}]`;
        
        if (!dj.slug || typeof dj.slug !== 'string' || dj.slug.trim() === '') {
          addError(tape.id, `${djPath}.slug`, 'DJ slug is missing or empty', 'Add a slug for this DJ');
        } else if (!isValidSlug(dj.slug)) {
          addError(
            tape.id, 
            `${djPath}.slug`, 
            'DJ slug must match format: ^[a-z0-9]+(?:-[a-z0-9]+)*$',
            'Use lowercase letters, numbers, and hyphens only'
          );
        }
        
        if (!dj.name || typeof dj.name !== 'string' || dj.name.trim() === '') {
          addError(tape.id, `${djPath}.name`, 'DJ name is missing or empty', 'Add a name for this DJ');
        }
        
        // Track DJ slug -> name mapping for consistency check
        if (dj.slug && dj.name) {
          if (!djSlugToNames.has(dj.slug)) {
            djSlugToNames.set(dj.slug, new Set());
          }
          djSlugToNames.get(dj.slug).add(dj.name);
        }
      });
    }

    // Validate tape.images.cover
    if (tape.images?.cover) {
      validateMediaPath(tape.images.cover, tape.id, 'images.cover');
    }

    // Validate tape.sides
    if (!Array.isArray(tape.sides) || tape.sides.length === 0) {
      addError(tape.id, 'sides', 'Must have at least one side', 'Add at least one side');
    } else {
      // Collect tape-level DJ slugs for side DJ validation
      const tapeDjSlugs = new Set((tape.djs || []).map(dj => dj.slug));
      
      tape.sides.forEach((side, sideIdx) => {
        const sidePath = `sides[${sideIdx}]`;
        
        // Validate side.position
        if (!side.position || typeof side.position !== 'string' || side.position.trim() === '') {
          addError(tape.id, `${sidePath}.position`, 'Side position is missing or empty', 'Add a position (e.g., "A", "B")');
        }
        
        // Validate side.audio_links
        if (!Array.isArray(side.audio_links) || side.audio_links.length === 0) {
          addError(tape.id, `${sidePath}.audio_links`, 'Must have at least one audio link', 'Add at least one audio link with a URL');
        } else {
          if (side.audio_links.length > 1) {
            addWarning(tape.id, `${sidePath}.audio_links`, `Has ${side.audio_links.length} audio links; expected 1 per side`);
          }
          
          side.audio_links.forEach((link, linkIdx) => {
            const linkPath = `${sidePath}.audio_links[${linkIdx}]`;
            
            if (!link.url || typeof link.url !== 'string' || link.url.trim() === '') {
              addError(tape.id, `${linkPath}.url`, 'Audio link URL is missing or empty', 'Add a valid URL');
            } else {
              validateDropboxUrl(link.url, tape.id, `${linkPath}.url`);
            }
          });
        }
        
        // Validate side.image
        if (side.image) {
          validateMediaPath(side.image, tape.id, `${sidePath}.image`);
        }
        
        // Validate side.djs (if present)
        if (side.djs !== undefined) {
          if (!Array.isArray(side.djs) || side.djs.length === 0) {
            addError(tape.id, `${sidePath}.djs`, 'Side DJs array is present but empty', 'Remove the djs field or add at least one DJ');
          } else {
            side.djs.forEach((dj, djIdx) => {
              const djPath = `${sidePath}.djs[${djIdx}]`;
              
              if (!dj.slug) {
                addError(tape.id, `${djPath}.slug`, 'Side DJ slug is missing', 'Add a slug for this DJ');
              } else if (!tapeDjSlugs.has(dj.slug)) {
                addError(
                  tape.id, 
                  `${djPath}.slug`, 
                  `Side DJ slug "${dj.slug}" not found in tape-level DJs`,
                  'Ensure this DJ is listed in the tape-level djs array'
                );
              }
            });
          }
        }
      });
    }
  });

  // Check for DJ slug consistency across tapes
  djSlugToNames.forEach((names, slug) => {
    if (names.size > 1) {
      addError(
        '(global)', 
        `dj.slug="${slug}"`, 
        `Same slug has different names: ${Array.from(names).join(', ')}`,
        'Use a consistent name for this DJ across all tapes'
      );
    }
  });

  return { tapes, errors, warnings };
}

// Run validation and output results
const result = validateTapes();
const tapes = result.tapes;

// Print warnings
if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:\n');
  warnings.forEach(w => {
    console.log(`  [${w.tapeId}] ${w.path}`);
    console.log(`    ${w.message}`);
  });
}

// Print errors
if (errors.length > 0) {
  console.log('\n❌ Validation failed with errors:\n');
  errors.forEach(e => {
    console.log(`  [${e.tapeId}] ${e.path}`);
    console.log(`    ${e.message}`);
    if (e.hint) {
      console.log(`    💡 ${e.hint}`);
    }
  });
  console.log(`\nTotal: ${errors.length} error(s), ${warnings.length} warning(s)\n`);
  process.exit(1);
}

// Success!
const djSlugs = new Set();
tapes.forEach(tape => {
  (tape.djs || []).forEach(dj => djSlugs.add(dj.slug));
});

console.log('\n✅ Validation passed!\n');
console.log(`  Tapes: ${tapes.length}`);
console.log(`  DJs: ${djSlugs.size}`);
console.log(`  Warnings: ${warnings.length}\n`);

process.exit(0);
