// Pure-JS port of the placeholder shaders that previously ran via
// WebGL2 in the browser. Same math, no GPU. Designed to run in Node
// at build time and emit a raw RGBA Uint8Array; Sharp encodes the
// final PNG. Same code can also drive a <canvas> in the browser.
//
// Sources of truth this file replaces:
//   - web/app/dev/placeholders/_shader-gradient.tsx (WebGL gradient)
//   - web/app/dev/placeholders/_ascii-shader.tsx (WebGL ASCII)
//
// The GLSL was lifted from huegrid.app and trimmed; this port follows
// it line-for-line so output is visually equivalent.

// ─── Hash + PRNG ─────────────────────────────────────────────────────

export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 2246822507) >>> 0;
    s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0;
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296;
  };
}

// ─── Simplex 2D noise (Ashima/Stefan Gustavson, ported from GLSL) ───

function mod289(x) {
  return x - Math.floor(x * (1.0 / 289.0)) * 289.0;
}

function permute(x) {
  return mod289((x * 34.0 + 1.0) * x);
}

function fract(x) {
  return x - Math.floor(x);
}

function snoise(vx, vy) {
  const C0 = 0.211324865405187;
  const C1 = 0.366025403784439;
  const C2 = -0.577350269189626;
  const C3 = 0.024390243902439;

  const ix = Math.floor(vx + (vx + vy) * C1);
  const iy = Math.floor(vy + (vx + vy) * C1);

  const x0x = vx - ix + (ix + iy) * C0;
  const x0y = vy - iy + (ix + iy) * C0;

  const i1x = x0x > x0y ? 1.0 : 0.0;
  const i1y = x0x > x0y ? 0.0 : 1.0;

  // x12.xy = x0.xy + C.xx - i1
  // x12.zw = x0.xy + C.zz
  const x12_0x = x0x + C0 - i1x;
  const x12_0y = x0y + C0 - i1y;
  const x12_1x = x0x + C2;
  const x12_1y = x0y + C2;

  const ixm = mod289(ix);
  const iym = mod289(iy);

  const py0 = permute(iym + 0.0);
  const py1 = permute(iym + i1y);
  const py2 = permute(iym + 1.0);

  const p0 = permute(py0 + ixm + 0.0);
  const p1 = permute(py1 + ixm + i1x);
  const p2 = permute(py2 + ixm + 1.0);

  const m0 = Math.max(0.5 - (x0x * x0x + x0y * x0y), 0.0);
  const m1 = Math.max(0.5 - (x12_0x * x12_0x + x12_0y * x12_0y), 0.0);
  const m2 = Math.max(0.5 - (x12_1x * x12_1x + x12_1y * x12_1y), 0.0);

  let mm0 = m0 * m0; mm0 = mm0 * mm0;
  let mm1 = m1 * m1; mm1 = mm1 * mm1;
  let mm2 = m2 * m2; mm2 = mm2 * mm2;

  const x_0 = 2.0 * fract(p0 * C3) - 1.0;
  const x_1 = 2.0 * fract(p1 * C3) - 1.0;
  const x_2 = 2.0 * fract(p2 * C3) - 1.0;

  const h0 = Math.abs(x_0) - 0.5;
  const h1 = Math.abs(x_1) - 0.5;
  const h2 = Math.abs(x_2) - 0.5;

  const ox0 = Math.floor(x_0 + 0.5);
  const ox1 = Math.floor(x_1 + 0.5);
  const ox2 = Math.floor(x_2 + 0.5);

  const a0 = x_0 - ox0;
  const a1 = x_1 - ox1;
  const a2 = x_2 - ox2;

  mm0 *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h0 * h0);
  mm1 *= 1.79284291400159 - 0.85373472095314 * (a1 * a1 + h1 * h1);
  mm2 *= 1.79284291400159 - 0.85373472095314 * (a2 * a2 + h2 * h2);

  const g0 = a0 * x0x + h0 * x0y;
  const g1 = a1 * x12_0x + h1 * x12_0y;
  const g2 = a2 * x12_1x + h2 * x12_1y;

  return 130.0 * (mm0 * g0 + mm1 * g1 + mm2 * g2);
}

// ─── Bayer dither matrices ───────────────────────────────────────────

const BAYER4 = [
  0.0, 8.0, 2.0, 10.0,
  12.0, 4.0, 14.0, 6.0,
  3.0, 11.0, 1.0, 9.0,
  15.0, 7.0, 13.0, 5.0,
];

function bayer4(x, y) {
  const ix = Math.floor(x) % 4;
  const iy = Math.floor(y) % 4;
  return BAYER4[iy * 4 + ix] / 16.0;
}

// 8×8 Bayer for the retro variant — visibly chunkier pattern, more
// classic "1-bit/2-bit early-Mac" dither aesthetic.
const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];

function bayer8(x, y) {
  const ix = Math.floor(x) % 8;
  const iy = Math.floor(y) % 8;
  return BAYER8[iy * 8 + ix] / 64.0;
}

// ─── Color pipeline (sRGB ↔ linear ↔ OKLAB) ──────────────────────────

function srgbToLinearComponent(c) {
  c = Math.max(0, Math.min(1, c));
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function srgbToLinear([r, g, b]) {
  return [srgbToLinearComponent(r), srgbToLinearComponent(g), srgbToLinearComponent(b)];
}

function linearToSrgbComponent(c) {
  c = Math.max(0, c);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055;
}

function linearToOklab(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}

function oklabToLinear(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

// Multi-stop gradient with smoothstep interpolation in OKLAB.
function mixColors(colors, positions, count, t) {
  if (count <= 1) return srgbToLinear(colors[0]);
  if (t <= positions[0]) return srgbToLinear(colors[0]);
  if (t >= positions[count - 1]) return srgbToLinear(colors[count - 1]);
  for (let i = 0; i < count - 1; i++) {
    if (t >= positions[i] && t <= positions[i + 1]) {
      const range = positions[i + 1] - positions[i];
      let local = range > 0.001 ? (t - positions[i]) / range : 0.0;
      // smoothstep
      local = local * local * (3.0 - 2.0 * local);
      const c0 = srgbToLinear(colors[i]);
      const c1 = srgbToLinear(colors[i + 1]);
      const ok0 = linearToOklab(c0[0], c0[1], c0[2]);
      const ok1 = linearToOklab(c1[0], c1[1], c1[2]);
      return oklabToLinear(
        ok0[0] + (ok1[0] - ok0[0]) * local,
        ok0[1] + (ok1[1] - ok0[1]) * local,
        ok0[2] + (ok1[2] - ok0[2]) * local,
      );
    }
  }
  return srgbToLinear(colors[count - 1]);
}

function acesTonemapComponent(x) {
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  const v = (x * (a * x + b)) / (x * (c * x + d) + e);
  return Math.max(0, Math.min(1, v));
}

function sgLuminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ─── Variant F: Dithered grayscale gradient ──────────────────────────

const SHADER_GRAY_RAMPS = [
  [[0.05, 0.05, 0.05], [0.30, 0.30, 0.30], [0.65, 0.65, 0.65], [0.95, 0.95, 0.95]],
  [[0.00, 0.00, 0.00], [0.20, 0.20, 0.20], [0.75, 0.75, 0.75], [1.00, 1.00, 1.00]],
  [[0.20, 0.20, 0.20], [0.40, 0.40, 0.40], [0.62, 0.62, 0.62], [0.85, 0.85, 0.85]],
  [[0.04, 0.04, 0.04], [0.18, 0.18, 0.18], [0.40, 0.40, 0.40], [0.70, 0.70, 0.70]],
];

// Drives all params from a single seed integer. Build script picks
// seeds however it wants (random for variety, or stable per-tape).
export function paramsFromSeed(seed) {
  const rng = makeRng(seed);
  const ramp = SHADER_GRAY_RAMPS[Math.floor(rng() * SHADER_GRAY_RAMPS.length)];
  return {
    colors: ramp,
    positions: ramp.map((_, i) => (ramp.length === 1 ? 0 : i / (ramp.length - 1))),
    colorCount: ramp.length,
    direction: rng() * 360,
    quantizationLevels: 3 + Math.floor(rng() * 3), // 3..5
    patternScale: 0.6 + rng() * 0.6, // 0.6..1.2
    waveFrequency: 2.0 + rng() * 3.0, // 2..5
    warpIntensity: 0.25 + rng() * 0.35, // 0.25..0.6
    grainIntensity: 0.1 + rng() * 0.2, // 0.1..0.3
  };
}

// Back-compat shim — derives the seed from the tape ID hash.
export function paramsFromTapeId(id) {
  return paramsFromSeed(hashString(id));
}

export function renderShaderGradient(params, width, height) {
  const buffer = new Uint8Array(width * height * 4);
  const aspect = width / height;
  const angle = (params.direction * Math.PI) / 180;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const u = px / width;
      const v = py / height;

      // p (aspect-corrected); domain warp.
      let pX = u * aspect;
      let pY = v;
      const warp = snoise(pX * 2.0, pY * 2.0);
      pX += warp * params.warpIntensity * 0.3;
      pY += warp * params.warpIntensity * 0.3;

      // Wave (uses warped p).
      const wave =
        Math.sin(pX * params.waveFrequency) * 0.1 +
        Math.cos(pY * params.waveFrequency * 0.7) * 0.05;

      // Direction gradient (uses uv + wave on both axes — matches GLSL).
      let t = (u - 0.5 + wave) * dirX + (v - 0.5 + wave) * dirY + 0.5;
      t += snoise(pX * 3.0, pY * 3.0) * 0.2;
      t = Math.max(0, Math.min(1, t));

      let [r, g, b] = mixColors(params.colors, params.positions, params.colorCount, t);

      // Bayer dither using fragment pixel center coords (px+0.5, py+0.5).
      const fx = (px + 0.5) / params.patternScale;
      const fy = (py + 0.5) / params.patternScale;
      const threshold = bayer4(fx, fy);
      const levels = params.quantizationLevels;
      const dr = Math.floor(r * levels + threshold) / levels;
      const dg = Math.floor(g * levels + threshold) / levels;
      const db = Math.floor(b * levels + threshold) / levels;

      // mix(color, dithered, 0.85 + grain*0.15)
      const ditherMix = 0.85 + params.grainIntensity * 0.15;
      r = r + (dr - r) * ditherMix;
      g = g + (dg - g) * ditherMix;
      b = b + (db - b) * ditherMix;

      // Subtle additive grain (uses uv).
      const gn = snoise(u * 400.0, v * 400.0) * params.grainIntensity * 0.05;
      r += gn; g += gn; b += gn;

      // ACES tonemap, then sRGB encode, then to byte.
      r = linearToSrgbComponent(acesTonemapComponent(Math.max(0, r)));
      g = linearToSrgbComponent(acesTonemapComponent(Math.max(0, g)));
      b = linearToSrgbComponent(acesTonemapComponent(Math.max(0, b)));

      const idx = (py * width + px) * 4;
      buffer[idx + 0] = Math.round(Math.max(0, Math.min(1, r)) * 255);
      buffer[idx + 1] = Math.round(Math.max(0, Math.min(1, g)) * 255);
      buffer[idx + 2] = Math.round(Math.max(0, Math.min(1, b)) * 255);
      buffer[idx + 3] = 255;
    }
  }
  return buffer;
}

// ─── Variant G: ASCII characters via 5×5 packed bitmaps ──────────────

const CHAR_PATTERNS = [
  0,            // ' ' empty
  0x4000,       // .
  0x4010040,    // :
  0xa8000,      // -
  0xa80a8,      // =
  0x4a904,      // +
  0x4ae04,      // *
  0xea5ae,      // #
  0x155d57,     // %
  0x1f7fbe,     // @
];

function getCharPixel(charIndex, x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= 5 || iy < 0 || iy >= 5) return 0;
  const idx = Math.min(charIndex, 9);
  const bit = iy * 5 + ix;
  return (CHAR_PATTERNS[idx] >> bit) & 1;
}

const ASCII_GRAY_RAMPS = [
  [[0.10, 0.10, 0.10], [0.45, 0.45, 0.45], [0.78, 0.78, 0.78], [0.97, 0.97, 0.97]],
  [[0.05, 0.05, 0.05], [0.35, 0.35, 0.35], [0.70, 0.70, 0.70], [1.00, 1.00, 1.00]],
  [[0.15, 0.15, 0.15], [0.40, 0.40, 0.40], [0.65, 0.65, 0.65], [0.92, 0.92, 0.92]],
];

export function asciiParamsFromSeed(seed) {
  const rng = makeRng(seed);
  const ramp = ASCII_GRAY_RAMPS[Math.floor(rng() * ASCII_GRAY_RAMPS.length)];
  return {
    colors: ramp,
    positions: [0, 0.33, 0.67, 1.0],
    colorCount: 4,
    direction: rng() * 360,
    fontSize: 11 + rng() * 5, // 11..16
    density: 0.75 + rng() * 0.25, // 0.75..1.0
    characterSet: Math.floor(rng() * 3), // 0..2
    invert: rng() > 0.7 ? 1 : 0, // 30% chance
  };
}

export function asciiParamsFromTapeId(id) {
  return asciiParamsFromSeed(hashString(id));
}

export function renderAsciiShader(params, width, height) {
  const buffer = new Uint8Array(width * height * 4);
  const cellSize = params.fontSize * params.density;
  const angle = (params.direction * Math.PI) / 180;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const fx = px + 0.5;
      const fy = py + 0.5;

      const cellX = Math.floor(fx / cellSize);
      const cellY = Math.floor(fy / cellSize);
      const cellUVx = fract(fx / cellSize) * 5.0;
      const cellUVy = fract(fy / cellSize) * 5.0;

      const cellCx = ((cellX + 0.5) * cellSize) / width;
      const cellCy = ((cellY + 0.5) * cellSize) / height;

      let t = (cellCx - 0.5) * dirX + (cellCy - 0.5) * dirY + 0.5;
      t += snoise(cellCx * 3.0, cellCy * 3.0) * 0.15;
      t = Math.max(0, Math.min(1, t));

      const cellColor = mixColors(params.colors, params.positions, params.colorCount, t);
      let lum = sgLuminance(cellColor[0], cellColor[1], cellColor[2]);
      if (params.invert === 1) lum = 1.0 - lum;

      let charIdx = Math.floor(lum * 9.0);
      if (params.characterSet === 1) {
        charIdx = Math.floor(lum * 4.0) * 2;
      } else if (params.characterSet === 2) {
        charIdx = lum > 0.5 ? 9 : lum > 0.2 ? 4 : 0;
      }

      const pixel = getCharPixel(charIdx, cellUVx, cellUVy);

      // bg = cellColor * 0.18; ink = cellColor; mix(bg, ink, pixel)
      const bgScale = 0.18;
      const r = cellColor[0] * (bgScale + (1 - bgScale) * pixel);
      const g = cellColor[1] * (bgScale + (1 - bgScale) * pixel);
      const b = cellColor[2] * (bgScale + (1 - bgScale) * pixel);

      const idx = (py * width + px) * 4;
      buffer[idx + 0] = Math.round(Math.max(0, Math.min(1, linearToSrgbComponent(r))) * 255);
      buffer[idx + 1] = Math.round(Math.max(0, Math.min(1, linearToSrgbComponent(g))) * 255);
      buffer[idx + 2] = Math.round(Math.max(0, Math.min(1, linearToSrgbComponent(b))) * 255);
      buffer[idx + 3] = 255;
    }
  }
  return buffer;
}

// ─── Variant H: Perlin/fBm organic gradient ──────────────────────────
// Multi-octave simplex noise → smooth flowing blobs. No straight
// edges, no grid pattern. Like clouds, fog, or marbled paper.

export function paramsPerlinFromSeed(seed) {
  const rng = makeRng(seed);
  const ramp = SHADER_GRAY_RAMPS[Math.floor(rng() * SHADER_GRAY_RAMPS.length)];
  return {
    colors: ramp,
    positions: ramp.map((_, i) => (ramp.length === 1 ? 0 : i / (ramp.length - 1))),
    colorCount: ramp.length,
    baseFreq: 1.0 + rng() * 2.0, // 1..3 (lower = bigger blobs)
    octaves: 4 + Math.floor(rng() * 3), // 4..6
    contrast: 1.0 + rng() * 1.5, // 1..2.5
    seedOffset: rng() * 100, // shift sample position to vary the pattern
  };
}

export function renderPerlinOrganic(params, width, height) {
  const buffer = new Uint8Array(width * height * 4);
  const aspect = width / Math.max(height, 1);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const u = (px / width) * aspect + params.seedOffset;
      const v = py / height + params.seedOffset;

      let n = 0;
      let amp = 1.0;
      let totalAmp = 0;
      let freq = params.baseFreq;
      for (let i = 0; i < params.octaves; i++) {
        n += amp * snoise(u * freq, v * freq);
        totalAmp += amp;
        amp *= 0.5;
        freq *= 2.0;
      }
      n /= totalAmp;

      let t = (n + 1) * 0.5;
      t = Math.pow(Math.max(0, Math.min(1, t)), 1.0 / params.contrast);

      const [r, g, b] = mixColors(params.colors, params.positions, params.colorCount, t);

      const idx = (py * width + px) * 4;
      buffer[idx + 0] = Math.round(Math.max(0, Math.min(1, linearToSrgbComponent(r))) * 255);
      buffer[idx + 1] = Math.round(Math.max(0, Math.min(1, linearToSrgbComponent(g))) * 255);
      buffer[idx + 2] = Math.round(Math.max(0, Math.min(1, linearToSrgbComponent(b))) * 255);
      buffer[idx + 3] = 255;
    }
  }
  return buffer;
}

// ─── Variant I: Retro dithered gradient ──────────────────────────────
// Pixelated linear gradient + visible 8×8 Bayer dither + heavy
// quantization (2–3 levels). Early-Mac / NES / 1-bit feel.

export function paramsRetroFromSeed(seed) {
  const rng = makeRng(seed);
  const ramp = SHADER_GRAY_RAMPS[Math.floor(rng() * SHADER_GRAY_RAMPS.length)];
  return {
    colors: ramp,
    positions: ramp.map((_, i) => (ramp.length === 1 ? 0 : i / (ramp.length - 1))),
    colorCount: ramp.length,
    direction: rng() * 360,
    levels: 2 + Math.floor(rng() * 2), // 2 or 3 levels — chunky
    pixelScale: 2 + Math.floor(rng() * 4), // 2..5 — chunky pixels
  };
}

export function renderRetroDither(params, width, height) {
  const buffer = new Uint8Array(width * height * 4);
  const angle = (params.direction * Math.PI) / 180;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const scale = params.pixelScale;
  const lvls = params.levels - 1;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      // Sample gradient at the cell center to pixelate.
      const cellX = Math.floor(px / scale);
      const cellY = Math.floor(py / scale);
      const u = ((cellX * scale) + scale * 0.5) / width;
      const v = ((cellY * scale) + scale * 0.5) / height;

      let t = (u - 0.5) * dirX + (v - 0.5) * dirY + 0.5;
      t = Math.max(0, Math.min(1, t));

      // Dither at the chunky-cell level so the matrix aligns with the
      // pixelation grid (more "1-bit" feel).
      const threshold = bayer8(cellX, cellY);

      let [r, g, b] = mixColors(params.colors, params.positions, params.colorCount, t);
      r = Math.floor(r * lvls + threshold) / lvls;
      g = Math.floor(g * lvls + threshold) / lvls;
      b = Math.floor(b * lvls + threshold) / lvls;

      const idx = (py * width + px) * 4;
      buffer[idx + 0] = Math.round(Math.max(0, Math.min(1, linearToSrgbComponent(Math.max(0, r)))) * 255);
      buffer[idx + 1] = Math.round(Math.max(0, Math.min(1, linearToSrgbComponent(Math.max(0, g)))) * 255);
      buffer[idx + 2] = Math.round(Math.max(0, Math.min(1, linearToSrgbComponent(Math.max(0, b)))) * 255);
      buffer[idx + 3] = 255;
    }
  }
  return buffer;
}
