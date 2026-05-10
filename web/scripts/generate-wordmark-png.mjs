#!/usr/bin/env node
/**
 * Generate a static PNG of the riso wordmark mark for use in email.
 *
 * Why this exists: inline SVG works in most modern email clients but
 * is stripped by Gmail. A static PNG renders everywhere. Sharp's
 * librsvg backend supports the full riso filter chain (feGaussianBlur
 * + feTurbulence + feDisplacementMap + feComposite), so the baked PNG
 * has the same grain/dissolution as the live wordmark on the site.
 *
 * Filter values + per-circle softness MUST stay in sync with
 * web/components/Wordmark.tsx. If you tune the wordmark there, re-run
 * this script and commit the regenerated PNG.
 *
 * Usage:
 *   node web/scripts/generate-wordmark-png.mjs
 */

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'public', 'media', 'site', 'wordmark-mark.png');

// 4× the 44px display size so the email <img> can render crisply on
// retina (2×) and ultra-retina (3×) screens. PNG file is small (~10–15 KB).
const SIZE = 176;

// Keep these in sync with web/components/Wordmark.tsx.
const CIRCLES = [
  { cx: 245, cy: 220, fill: '#1A84C4', soft: 67 },
  { cx: 120, cy: 220, fill: '#FB5FB6', soft: 75 },
  { cx: 190, cy: 120, fill: '#FDEB44', soft: 88 },
];

const fadeId = (fill) => `fade-${fill.slice(1)}`;

const gradients = CIRCLES.map(
  (c) => `<radialGradient id="${fadeId(c.fill)}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="white" stop-opacity="1" />
    <stop offset="${c.soft}%" stop-color="white" stop-opacity="1" />
    <stop offset="100%" stop-color="white" stop-opacity="0" />
  </radialGradient>`,
).join('\n');

const sourceCircles = CIRCLES.map(
  (c) => `<circle cx="${c.cx}" cy="${c.cy}" r="100" fill="url(#${fadeId(c.fill)})" />`,
).join('\n');

const visibleCircles = CIRCLES.map(
  (c) => `<circle cx="${c.cx}" cy="${c.cy}" r="100" fill="${c.fill}" style="mix-blend-mode:multiply" />`,
).join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="${SIZE}" height="${SIZE}">
  <defs>
    <filter id="riso-grain" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="40" result="blur" />
      <feTurbulence type="turbulence" baseFrequency="1.565 0.771" numOctaves="2" seed="42" result="waves1" />
      <feTurbulence type="turbulence" baseFrequency="1.495 0.965" numOctaves="2" seed="11" result="waves2" />
      <feDisplacementMap in="blur" in2="waves1" scale="15" xChannelSelector="R" yChannelSelector="B" result="ripples1" />
      <feDisplacementMap in="ripples1" in2="waves2" scale="40" xChannelSelector="R" yChannelSelector="B" result="ripples" />
      <feComposite in="waves1" in2="ripples" operator="arithmetic" k1="1" k2="0" k3="1" k4="0" />
    </filter>
    ${gradients}
    <mask id="riso-mask" maskUnits="userSpaceOnUse" x="-100" y="-100" width="600" height="600">
      <rect x="-100" y="-100" width="600" height="600" fill="black" />
      <g filter="url(#riso-grain)">
        ${sourceCircles}
      </g>
    </mask>
  </defs>
  <g mask="url(#riso-mask)">
    ${visibleCircles}
  </g>
</svg>`;

await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(OUTPUT);

console.log(`✅ Wrote ${path.relative(ROOT, OUTPUT)} (${SIZE}×${SIZE})`);
