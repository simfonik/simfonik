// Shared read-merge-write for web/lib/asset-manifest.json. Both bake
// scripts call mergeIntoManifest() after they finish to add their keys
// without clobbering keys owned by the other script.
//
// Manifest shape: flat keys → 8-char hex hash (md5 of source content,
// truncated). The loader (lib/imageLoader.ts) uses these as `?v={hash}`
// for surgical cache invalidation per source file.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(__dirname, '..', '..', 'lib', 'asset-manifest.json');

export function shortHashOfFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

export function shortHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return {};
  }
}

// Merge `entries` (key → hash) into the on-disk manifest. Only keys
// present in `entries` are touched, so the other script's keys
// survive. Sorted output for stable diffs.
export function mergeIntoManifest(entries) {
  const existing = readManifest();
  const merged = { ...existing, ...entries };
  const sorted = Object.fromEntries(
    Object.keys(merged).sort().map((k) => [k, merged[k]]),
  );
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + '\n');
}
