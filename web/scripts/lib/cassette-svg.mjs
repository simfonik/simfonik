// Shared cassette SVG path constants. Imported by both the build-time
// bake script (scripts/generate-placeholder-shaders.mjs) and the dev
// playground (app/dev/placeholders/_placeholders-mock.tsx) so the
// cassette outline only has to be edited in one place.
//
//   OUTER_BODY_D   — the cassette outline (no cutouts)
//   REEL_D         — toothed/notched reel gear in its own 0..36 viewBox;
//                    callers translate to position it (subtract 18 from
//                    the desired center to align the path's bbox).
//   DRIVE_HOLES_D  — four sprocket holes at the bottom (drive pins)
//   buildRaisedPlate(w, h)       — trapezoidal plateau over the drive
//                    holes; mimics the raised plastic on real
//                    cassettes. Combine with DRIVE_HOLES_D using
//                    evenodd so the holes still punch through.
//   buildTapeRing(cx, cy, outerR, hubR) — annulus path for a reel's
//                    wound-tape pancake. Outer/inner radii are inputs
//                    so the live cassette can animate them as the
//                    track plays (left shrinks, right grows).
//   buildRaisedPlateBorder(w, h) — open polyline along the plate's
//                    left/top/right edges, for stroking a tunable
//                    shadow/highlight.
//   buildScrewInner(lightness) — inner markup for one Phillips screw,
//                    intended to be wrapped in
//                    <symbol id="..." viewBox="0 0 24 24"> and
//                    instanced via <use> at each corner + plate.
//   buildScrewPositions(...) — returns the five {x,y} positions used
//                    when placing screw instances.
//   LABEL_CLIP_D   — rounded label rect with the spool window cut out
//
// Natural viewBox: 0 0 373 233 (for body + drive holes + label clip).
//
// CASSETTE_DEFAULTS — single source of truth for the values the bake
// script, the live placeholder component, and the dev playground all
// use. Tuned interactively in /dev/placeholders; when those defaults
// are updated, every consumer picks them up.

export const CASSETTE_DEFAULTS = {
  circleRadius: 68,
  reelSize: 25,
  bodyLightness: 8,
  grainStrength: 0.04,
  vignetteStrength: 0.23,
  recessStrength: 0.5,
  circleColor: '#303030',
  teethColor: '#303030',
  leftReelX: 111,
  leftReelY: 107,
  rightReelX: 266,
  rightReelY: 107,
  plateLightness: 10,
  plateWidth: 276,
  plateHeight: 44,
  plateBorderWidth: 2,
  plateBorderLightness: 26,
  screwSize: 13.5,
  screwInsetX: 13,
  screwTopY: 10,
  screwBottomY: 224,
  screwCenterX: 186.5,
  screwCenterY: 204,
  screwLightness: 21,
  screwOuterLightness: 13,
  artStrokeWidth: 1.5,
  artStrokeLightness: 26,
};

export const OUTER_BODY_D =
  'M370.507 152.092V9.9323C370.507 4.44728 366.043 0 360.538 0H12.4608C6.95557 0 2.49188 4.44728 2.49188 9.9323V152.092L0 154.575V213.756L2.49188 215.839V223.068C2.49188 228.553 6.95557 233 12.4608 233H360.538C366.043 233 370.507 228.553 370.507 223.068V215.839L372.999 213.756L373 154.575L370.507 152.092Z';

// Toothed reel gear, perfectly round, viewBox 0..36. The path's bbox
// is (0,0)–(36,36); translate by (centerX - 18, centerY - 18) at the
// use site to position it.
export const REEL_D =
  'M31.1403 30.3097C27.9931 33.6714 23.5937 35.7977 18.7745 36L19.0841 32.6736L14.2306 32.2219L13.9218 35.5474C9.21996 34.457 5.29009 31.5543 2.81664 27.67L5.91683 26.244L3.94941 21.7783L0.777278 23.2379C0.117862 21.0653 -0.14495 18.7314 0.0776845 16.3293C0.301583 13.9273 0.988987 11.6831 2.03905 9.66834L5.01997 11.7829L7.89372 7.83897L4.86062 5.6893C8.00838 2.32764 12.4069 0.200834 17.2261 0L16.8731 3.78909L21.7267 4.24101L22.0797 0.451921C26.7797 1.54082 30.7106 4.4433 33.1825 8.32881L29.8051 9.88169L31.9032 14.2883L35.2219 12.7608C35.8828 14.9342 36.1455 17.2673 35.9216 19.6693C35.6977 22.0713 35.0116 24.3164 33.9598 26.3311L31.1123 24.311L28.356 28.3367L31.1403 30.3097Z';

// Trapezoid covering the bottom drive-hole region: top narrower than
// bottom (sides chamfer outward going down). The taper ratio matches
// plate.svg (~0.825 top:bottom). Bottom edge runs slightly past the
// cassette bottom; clip the path to OUTER_BODY_D at the use site so
// the bottom follows the body's rounded shell. Drive holes (y=206–228)
// sit inside.
export const PLATE_DEFAULTS = {
  width: 276,           // bottom-edge width
  height: 44,           // top-to-bottom
  taper: 0.825,         // top width / bottom width
  cx: 190,              // horizontal centerline (matches plate.svg's center)
  bottomY: 233.5,       // bottom edge y (clipped to body bottom)
};

// Annulus for one reel's wound tape — outer circle minus inner hub
// circle, even-odd fill. The bake script renders the static start
// state (full left reel); the live placeholder animates outerR.
export function buildTapeRing(cx, cy, outerR, hubR) {
  return [
    `M ${cx - outerR} ${cy}`,
    `A ${outerR} ${outerR} 0 1 0 ${cx + outerR} ${cy}`,
    `A ${outerR} ${outerR} 0 1 0 ${cx - outerR} ${cy}`,
    'Z',
    `M ${cx - hubR} ${cy}`,
    `A ${hubR} ${hubR} 0 1 0 ${cx + hubR} ${cy}`,
    `A ${hubR} ${hubR} 0 1 0 ${cx - hubR} ${cy}`,
    'Z',
  ].join(' ');
}

export function buildRaisedPlate(width = PLATE_DEFAULTS.width, height = PLATE_DEFAULTS.height) {
  const { taper, cx, bottomY } = PLATE_DEFAULTS;
  const topW = width * taper;
  const topY = bottomY - height;
  const tl = (cx - topW / 2).toFixed(2);
  const tr = (cx + topW / 2).toFixed(2);
  const bl = (cx - width / 2).toFixed(2);
  const br = (cx + width / 2).toFixed(2);
  return `M${tl},${topY} H${tr} L${br},${bottomY} H${bl} Z`;
}

// Phillips screw inner markup. Render inside a <symbol> with
// viewBox 0 0 24 24, then <use> the symbol at each position.
// outerLightness controls the recessed-socket ring; innerLightness
// controls the screw head face; slot strokes stay pure black.
export function buildScrewInner(innerLightness = 27, outerLightness = 4) {
  return `<circle cx="12" cy="12" r="12" fill="rgb(${outerLightness}, ${outerLightness}, ${outerLightness})"/>
  <circle cx="12" cy="12" r="10" fill="rgb(${innerLightness}, ${innerLightness}, ${innerLightness})"/>
  <path d="M12 5V19" stroke="black" stroke-width="2" stroke-linecap="round"/>
  <line x1="5" y1="12" x2="19" y2="12" stroke="black" stroke-width="2" stroke-linecap="round"/>`;
}

// Compute the five screw center positions: four corners (mirrored
// horizontally via insetX from the cassette sides) plus one in the
// middle of the raised plate.
export function buildScrewPositions({
  insetX,
  topY,
  bottomY,
  centerX,
  centerY,
}) {
  return [
    { x: insetX, y: topY },
    { x: 373 - insetX, y: topY },
    { x: insetX, y: bottomY },
    { x: 373 - insetX, y: bottomY },
    { x: centerX, y: centerY },
  ];
}

// Open polyline along the plate's left, top, and right edges (no
// bottom). Stroked separately from the plate fill to give a tunable
// shadow/highlight along the raised edges for depth.
export function buildRaisedPlateBorder(width = PLATE_DEFAULTS.width, height = PLATE_DEFAULTS.height) {
  const { taper, cx, bottomY } = PLATE_DEFAULTS;
  const topW = width * taper;
  const topY = bottomY - height;
  const tl = (cx - topW / 2).toFixed(2);
  const tr = (cx + topW / 2).toFixed(2);
  const bl = (cx - width / 2).toFixed(2);
  const br = (cx + width / 2).toFixed(2);
  return `M${bl},${bottomY} L${tl},${topY} L${tr},${topY} L${br},${bottomY}`;
}

export const DRIVE_HOLES_D =
  'M100.506 228.125C95.3445 228.125 91.1599 223.956 91.1599 218.813C91.1599 213.671 95.3445 209.501 100.506 209.501C105.668 209.501 109.852 213.671 109.852 218.813C109.852 223.956 105.668 228.125 100.506 228.125ZM137.608 221.917C133.224 221.917 129.67 218.377 129.67 214.009C129.67 209.641 133.224 206.1 137.608 206.1C141.992 206.100 145.546 209.641 145.546 214.009C145.545 218.377 141.991 221.917 137.608 221.917ZM242.111 221.917C237.727 221.917 234.173 218.377 234.173 214.009C234.173 209.641 237.727 206.100 242.111 206.100C246.495 206.100 250.048 209.641 250.048 214.009C250.048 218.377 246.496 221.917 242.111 221.917ZM278.671 228.125C273.509 228.125 269.325 223.956 269.325 218.813C269.325 213.671 273.508 209.501 278.671 209.501C283.832 209.501 288.017 213.671 288.017 218.813C288.017 223.956 283.832 228.125 278.671 228.125Z';

export const LABEL_CLIP_D =
  'M339 14C347.837 14 355 21.1634 355 30V159C355 167.837 347.837 175 339 175H34C25.1634 175 18 167.837 18 159V30C18 21.1634 25.1634 14 34 14H339ZM105 81C94.0132 81 85 90.0132 85 101V113C85 123.987 94.0132 133 105 133H274C284.987 133 294 123.987 294 113V101C294 90.0132 284.097 81 274 81H105Z';
