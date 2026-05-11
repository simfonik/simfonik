#!/usr/bin/env node
/**
 * Generate static PNGs of the brand lockup for use in email.
 *
 * Why this exists: inline SVG works in most modern email clients but
 * is stripped by Gmail. A static PNG renders everywhere. Sharp's
 * librsvg backend supports the full riso filter chain so the baked
 * PNGs have the same grain/dissolution as the live lockup on the site.
 *
 * Two variants are emitted to handle email theming:
 *   lockup-dark.png   — white wordmark, for dark-mode email (default)
 *   lockup-light.png  — black wordmark, for prefers-color-scheme: light
 * The email template stacks both and shows one via media query.
 *
 * Geometry MUST stay in sync with web/components/SimfonikLockup.tsx.
 * If you tune the lockup there, re-run this script and commit the PNGs.
 *
 * Usage:
 *   node web/scripts/generate-lockup-pngs.mjs
 */

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'media', 'site');

// 4× the 44px display height so the email <img> stays crisp on retina
// (2×) and ultra-retina (3×) screens. Aspect ratio 1350.16/400 = 3.375.
const DISPLAY_HEIGHT = 44;
const SOURCE_SCALE = 4;
const SOURCE_HEIGHT = DISPLAY_HEIGHT * SOURCE_SCALE; // 176
const SOURCE_WIDTH = Math.round((1350.16 / 400) * SOURCE_HEIGHT); // 594

// Keep these in sync with SimfonikLockup.tsx.
const VERTICAL_NUDGE = 30;

const CIRCLES = [
  { cx: 245, cy: 220 + VERTICAL_NUDGE, fill: '#1A84C4', soft: 67 }, // cyan
  { cx: 120, cy: 220 + VERTICAL_NUDGE, fill: '#FB5FB6', soft: 75 }, // magenta
  { cx: 190, cy: 120 + VERTICAL_NUDGE, fill: '#FDEB44', soft: 88 }, // yellow
];

const WORDMARK_X = 454.5;
const WORDMARK_Y = 45.48 + VERTICAL_NUDGE;
const WORDMARK_SCALE = 0.968;

// Wordmark path data — mirrors SimfonikLockup.tsx.
const WORDMARK_PATHS = `
  <path d="M307.85,97.69v163.05s-48.5.01-48.5.01V101.47c-.64-3.19-2.35-5.29-5.43-5.71-5.04-.69-10.1.06-14.71,1.97v163.03s-48.47,0-48.47,0V55.03s47.7-.02,47.7-.02l.09,13.56c11.13-8.99,20.49-15.46,34.94-15.68s25.9,2.95,31.85,17.67c11.24-10.93,21.58-17.7,37.14-17.65,5.72-.18,11.22.22,16.53,2.16,12.62,4.62,17.13,15.91,17.59,29.19v176.5s-48.5,0-48.5,0V101.78c-.96-8.36-11.47-7.1-20.23-4.09Z" />
  <path d="M899.02,155.56l25.35,105.17-51.41.04-20.19-96.74-.07,96.74-48.47-.02V.02s48.48-.01,48.48-.01l.05,151.7,22.45-96.72,49.27.02c.4,0,.89.49.79.88l-26.25,99.66Z" />
  <path d="M590.68,237.22c-5.42,18.02-21.77,25.69-39.92,25.71l-32.16.03c-16.78.02-32.79-5.94-39.46-22.04-2.62-6.32-3.99-12.98-3.99-20.08v-125.44c0-18.68,8.29-35.18,26.87-40.24,5.41-1.47,10.77-2.26,16.47-2.26l32.46.03c17.18.02,33.41,7.27,39.17,24.05,1.98,5.77,3.19,11.58,3.19,17.92l.02,125.02c0,6.12-.94,11.62-2.65,17.29ZM538.88,220.21c3.15-.01,5.94-2.95,5.94-6.3v-111.96c0-3.64-3.13-6.34-6.26-6.34h-8.62c-3.47.02-6.33,2.91-6.33,6.67l.02,111.63c0,3.59,3.15,6.36,6.16,6.34l9.09-.04Z" />
  <path d="M676.73,102.44c-.95-8.92-12.23-7.89-20.53-4.71v163.02s-48.47,0-48.47,0V55.03s47.71-.02,47.71-.02l.06,13.6,13.62-9.83c6.55-3.94,13.65-5.8,21.36-5.88,4.78-.05,9.4,0,14.01,1.15,14.42,3.61,20.47,15.52,20.72,30.21v176.5s-48.48,0-48.48,0V102.44Z" />
  <path d="M107.82,242.95c-7.02,14.28-22.13,19.96-37.56,19.98l-26.68.04c-18.17.03-34.66-6.91-40.63-24.87C.86,231.66,0,225.06,0,218.1v-32.22s46.68,0,46.68,0l.07,29.38c0,3.65,2.84,6.06,6.12,6.5l8.12-.1c3.12-.04,5.77-2.96,5.78-6.18l.04-18.83c0-3.61-1.96-6.92-5.1-8.88l-41.14-25.71c-6.18-3.86-11.54-8.78-15.37-14.89-3.2-5.12-4.74-11.11-4.74-17.15l-.04-32.9c-.02-18.22,6.27-34.69,24.1-41.05,6.07-2.16,12.38-3.17,18.97-3.16l26.97.04c7.3.01,14.25,1.45,20.78,4.34,8.17,3.62,14.01,9.94,17.42,18.19,2.61,6.76,3.76,13.75,3.78,21.15l.06,31.86h-46.61s-.12-27.61-.12-27.61c-.02-3.8-2.78-6.41-6.24-6.82l-7.04.09c-3.31.04-6.06,3.03-6.07,6.45l-.06,17.03c-.01,3.91,1.86,7.29,5.29,9.43l40.85,25.49c6.47,4.04,12,9.13,15.9,15.61,3.38,5.62,4.36,12.23,4.37,18.74l.03,32c0,8.39-1.29,16.57-4.95,24.02Z" />
  <path d="M446.46,95.54v165.21s-48.5,0-48.5,0V95.57s-11.5-.08-11.5-.08v-40.46s11.5-.02,11.5-.02l.02-18.87c1.03-14.42,5.69-26.17,19.17-32.38,5.49-2.17,11.22-3.66,17.34-3.67l35.48-.08v39.62s-17.48.03-17.48.03c-3.32.1-5.65,2.19-6.02,5.5v9.86s22.38.01,22.38.01v40.46s-22.39.06-22.39.06Z" />
  <polygon points="788.85 260.7 740.34 260.78 740.34 55.03 788.85 54.99 788.85 260.7" />
  <polygon points="175.2 260.71 126.73 260.78 126.73 55.02 175.2 55.01 175.2 260.71" />
  <polygon points="175.97 42.24 126.08 42.26 126.08 .01 175.96 0 175.97 42.24" />
  <polygon points="789.59 42.24 739.58 42.26 739.58 .01 789.58 0 789.59 42.24" />
`;

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

function buildSvg(wordmarkColor) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1350.16 400" width="${SOURCE_WIDTH}" height="${SOURCE_HEIGHT}">
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
  <g transform="translate(${WORDMARK_X} ${WORDMARK_Y}) scale(${WORDMARK_SCALE})" fill="${wordmarkColor}">
    ${WORDMARK_PATHS}
  </g>
</svg>`;
}

async function emit(variant, wordmarkColor) {
  const svg = buildSvg(wordmarkColor);
  const outPath = path.join(OUTPUT_DIR, `lockup-${variant}.png`);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outPath);
  console.log(`✅ Wrote ${path.relative(ROOT, outPath)} (${SOURCE_WIDTH}×${SOURCE_HEIGHT})`);
}

await emit('dark', '#f5f5f5'); // off-white wordmark for dark email
await emit('light', '#0a0a0a'); // near-black wordmark for light email
