'use client';

import { createContext, useContext, useState } from 'react';
import {
  OUTER_BODY_D,
  REEL_D,
  buildRaisedPlate,
  buildRaisedPlateBorder,
  buildScrewPositions,
  DRIVE_HOLES_D,
  LABEL_CLIP_D,
} from '../../../scripts/lib/cassette-svg.mjs';

// Shared cassette mechanism params, controlled by sliders at the top
// of the playground. Values cascade into every CassetteSvg instance
// without prop-drilling.
type CassetteParams = {
  circleRadius: number;
  reelSize: number;
  bodyLightness: number;     // 0..60 — brightness of the body color (rgb(v,v,v))
  grainStrength: number;     // 0..0.2 — feComposite k3 for plastic grain
  vignetteStrength: number;  // 0..0.30 — outer-stop opacity of the radial form
  recessStrength: number;    // 0..1.5 — multiplier on the recess shadow stops
  circleColor: string;       // hex — wound-tape ring color
  teethColor: string;        // hex — color of the reel teeth (body tabs in the gear cutout)
  leftReelX: number;         // x-center of left reel (path natural center: 111)
  leftReelY: number;         // y-center of left reel (path natural center: 107)
  rightReelX: number;        // x-center of right reel (path natural center: 266)
  rightReelY: number;        // y-center of right reel (path natural center: 107)
  plateWidth: number;        // raised-plate bottom width
  plateHeight: number;       // raised-plate height (anchored at body bottom)
  plateLightness: number;    // 0..60 — brightness of the plate color (rgb(v,v,v))
  plateBorderWidth: number;  // 0..5 — stroke width of the left/top/right border
  plateBorderLightness: number; // 0..60 — brightness of the border color
  screwSize: number;         // diameter of the screw <use> instances (in 373-wide viewBox units)
  screwInsetX: number;       // horizontal inset of corner screws from the cassette sides
  screwTopY: number;         // y position of top-left/top-right corner screws
  screwBottomY: number;      // y position of bottom-left/bottom-right corner screws
  screwCenterX: number;      // x position of the central plate screw
  screwCenterY: number;      // y position of the central plate screw
  screwLightness: number;    // 0..120 — brightness of the screw's inner face
  screwOuterLightness: number; // 0..60 — brightness of the recessed-socket ring
  artStrokeWidth: number;    // 0..3 — stroke width around the label/spool boundary
  artStrokeLightness: number; // 0..60 — brightness of the boundary stroke
};
const DEFAULT_CASSETTE_PARAMS: CassetteParams = {
  circleRadius: 68,
  reelSize: 25,
  bodyLightness: 8,
  grainStrength: 0.04,
  vignetteStrength: 0.23,
  recessStrength: 0.5,
  circleColor: '#363535',
  teethColor: '#363535',
  leftReelX: 111,
  leftReelY: 107,
  rightReelX: 266,
  rightReelY: 107,
  plateWidth: 276,
  plateHeight: 44,
  plateLightness: 10,
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
const CassetteContext = createContext<CassetteParams>(DEFAULT_CASSETTE_PARAMS);

const PLACEHOLDER_TAPES = [
  'chris-brownie-live-at-nectar',
  'derrick-carter-moods-version-iv-second-take',
  'dj-trance-the-real-oldskool',
  'juan-nunez-rhythms-melodic',
  'scott-hardkiss-ernie-munson-untitled-1993',
  'scott-hardkiss-untitled',
  'steve-loria-cybersonic-technotronic',
];

// Muted riso palette — desaturated tones that read as "printed paper"
// rather than highlighter saturation. Wider than CMY for variety.
const MUTED = [
  { name: 'paper-cyan',     value: '#7FB3C4' },
  { name: 'paper-pink',     value: '#E0A4C5' },
  { name: 'paper-yellow',   value: '#D9C470' },
  { name: 'sage',           value: '#A8BFA0' },
  { name: 'cornflower',     value: '#8FA0C4' },
  { name: 'butter',         value: '#E5D6A8' },
  { name: 'dusty-rose',     value: '#C99A98' },
  { name: 'mint',           value: '#9CC4B8' },
];

/* eslint-disable @typescript-eslint/no-unused-vars --
 * Dev playground: alternate cassette designs and palettes are kept here
 * as in-progress reference even when not currently rendered. */

const CREAM = '#EFE6D2';

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function pickColor(id: string, palette = MUTED) {
  return palette[hashString(id) % palette.length];
}

function pickPair(id: string) {
  const h = hashString(id);
  const i = h % MUTED.length;
  // Step around the palette by a co-prime offset for distinct second pick.
  const j = (h + 3) % MUTED.length;
  const adjusted = j === i ? (j + 1) % MUTED.length : j;
  return [MUTED[i], MUTED[adjusted]] as const;
}

// ─── Variant D: Paper-grain solid ────────────────────────────────────
// One muted color + a faint riso ink grain overlay. Reads like a
// printed label, not a poster.
function PaperGrainCassette({ id }: { id: string }) {
  const labelColor = pickColor(id).value;
  const seed = hashString(id) % 1000;
  return (
    <CassetteSvg uid={`d-${id}`}>
      <CassetteLabelGrain labelColor={labelColor} seed={seed} />
    </CassetteSvg>
  );
}

function CassetteLabelGrain({
  labelColor,
  seed,
}: {
  labelColor: string;
  seed: number;
}) {
  const grainId = `grain-${seed}`;
  return (
    <>
      <defs>
        <filter id={grainId} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="1.4"
            numOctaves="2"
            seed={seed}
            result="noise"
          />
          {/* Bias the noise dark and low-alpha so it reads as paper
              grain when multiplied over the label color. */}
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0.18 0"
          />
        </filter>
      </defs>
      <rect x="18" y="14" width="337" height="161" fill={labelColor} />
      <rect
        x="18"
        y="14"
        width="337"
        height="161"
        filter={`url(#${grainId})`}
        style={{ mixBlendMode: 'multiply' }}
      />
    </>
  );
}

// ─── Variant E: Two-tone stripe ──────────────────────────────────────
// Top header band + bottom body band in different muted tones. The
// spool window cuts through the middle, so the split reads naturally.
function TwoToneCassette({ id }: { id: string }) {
  const [top, bottom] = pickPair(id);
  return (
    <CassetteSvg uid={`e-${id}`}>
      {/* Full label in top color */}
      <rect x="18" y="14" width="337" height="161" fill={top.value} />
      {/* Bottom band overrides below the spool */}
      <rect x="18" y="133" width="337" height="42" fill={bottom.value} />
    </CassetteSvg>
  );
}

// ─── Placeholder cassette — static AVIF baked at build time ──────────
// Build script (web/scripts/generate-placeholder-shaders.mjs) randomly
// picks shader-gradient or ASCII per tape, saves as {tapeId}.avif so
// callers don't need to know which style won. Re-run the script to
// re-roll the look.
function PlaceholderCassette({ id }: { id: string }) {
  // Live cassette frame (controlled by the dev page's sliders) with
  // the bare shader artwork inside its label area. The artwork-only
  // PNG is emitted alongside the full-cassette AVIF by
  // scripts/generate-placeholder-shaders.mjs so the dev page doesn't
  // double up on reels.
  return (
    <CassetteSvg uid={`p-${id}`}>
      <image
        href={`/generated/placeholders/${id}-label.png`}
        x="18"
        y="14"
        width="337"
        height="161"
        preserveAspectRatio="xMidYMid slice"
      />
    </CassetteSvg>
  );
}

// ─── Cassette container ──────────────────────────────────────────────
function CassetteSvg({
  uid,
  children,
}: {
  uid: string;
  children: React.ReactNode;
}) {
  const clipId = `clip-${uid}`;
  const bodyClipId = `body-clip-${uid}`;
  const grainId = `grain-${uid}`;
  const recessId = `recess-${uid}`;
  const formId = `form-${uid}`;
  // Per-cassette seed so each tape's plastic grain pattern is unique
  // but stays in the [0, 100] range that feTurbulence accepts well.
  const grainSeed = hashString(uid) % 100;

  // Big-circle ring behind the left reel. Outer = wound tape body,
  // inner cutout = 105% of the reel size so the reel fits with margin.
  // Path is a single subpath with even-odd fill rule (outer ring,
  // counter-wound inner circle = hole).
  const {
    circleRadius,
    reelSize,
    bodyLightness,
    grainStrength,
    vignetteStrength,
    recessStrength,
    circleColor,
    teethColor,
    leftReelX,
    leftReelY,
    rightReelX,
    rightReelY,
    plateWidth,
    plateHeight,
    plateLightness,
    plateBorderWidth,
    plateBorderLightness,
    screwSize,
    screwInsetX,
    screwTopY,
    screwBottomY,
    screwCenterX,
    screwCenterY,
    screwLightness,
    screwOuterLightness,
    artStrokeWidth,
    artStrokeLightness,
  } = useContext(CassetteContext);
  const platePath = buildRaisedPlate(plateWidth, plateHeight);
  const plateBorderPath = buildRaisedPlateBorder(plateWidth, plateHeight);
  const screwPositions = buildScrewPositions({
    insetX: screwInsetX,
    topY: screwTopY,
    bottomY: screwBottomY,
    centerX: screwCenterX,
    centerY: screwCenterY,
  });
  const teethMaskId = `teeth-${uid}`;
  const bodyMaskId = `body-${uid}`;
  const screwId = `screw-${uid}`;
  // REEL_D has its bbox at (0,0)–(36,36). Subtract 18 from the reel
  // center to translate the path so its center lands at (cx, cy).
  const leftTx = leftReelX - 18;
  const leftTy = leftReelY - 18;
  const rightTx = rightReelX - 18;
  const rightTy = rightReelY - 18;
  const cx = leftReelX;
  const cy = leftReelY;
  const R = circleRadius;
  const rIn = reelSize * 1.05;
  const bodyFill = `rgb(${bodyLightness}, ${bodyLightness}, ${bodyLightness})`;
  // Recess shadow opacities scale with the recess slider so a single
  // knob controls the whole effect.
  const rs = recessStrength;
  const ringPath = [
    `M ${cx - R} ${cy}`,
    `A ${R} ${R} 0 1 0 ${cx + R} ${cy}`,
    `A ${R} ${R} 0 1 0 ${cx - R} ${cy}`,
    'Z',
    `M ${cx - rIn} ${cy}`,
    `A ${rIn} ${rIn} 0 1 0 ${cx + rIn} ${cy}`,
    `A ${rIn} ${rIn} 0 1 0 ${cx - rIn} ${cy}`,
    'Z',
  ].join(' ');
  return (
    <svg
      viewBox="0 0 373 233"
      xmlns="http://www.w3.org/2000/svg"
      className="block w-full h-auto"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={LABEL_CLIP_D} />
        </clipPath>
        <clipPath id={bodyClipId}>
          <path d={OUTER_BODY_D} />
        </clipPath>
        {/* Plastic grain: fractal noise added to whatever the body
            color is. Low intensity (k3=0.06) = subtle highlight specks
            on the dark cassette plastic. */}
        <filter
          id={grainId}
          x="0%"
          y="0%"
          width="100%"
          height="100%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="1.6"
            numOctaves="2"
            seed={grainSeed}
            result="noise"
          />
          <feComposite
            in="SourceGraphic"
            in2="noise"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3={grainStrength}
            k4="0"
            result="grained"
          />
          {/* Clip the grain-tinted output to SourceGraphic alpha.
              Without this, feComposite arithmetic leaves a faint
              k3·noise tint in transparent pixels, producing a
              rectangular halo around the cassette on dark bg. */}
          <feComposite in="grained" in2="SourceGraphic" operator="in" />
        </filter>
        {/* Recess shadow: dark gradient at the top edge (overhang
            shadow) and a softer one at the bottom (lower lip). Multiply
            blend over the label content sells the "sits in a recess"
            illusion without needing 3D. */}
        <linearGradient id={recessId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="black" stopOpacity={Math.min(1, 0.55 * rs)} />
          <stop offset="0.06" stopColor="black" stopOpacity={Math.min(1, 0.18 * rs)} />
          <stop offset="0.14" stopColor="black" stopOpacity="0" />
          <stop offset="0.86" stopColor="black" stopOpacity="0" />
          <stop offset="0.95" stopColor="black" stopOpacity={Math.min(1, 0.10 * rs)} />
          <stop offset="1" stopColor="black" stopOpacity={Math.min(1, 0.22 * rs)} />
        </linearGradient>
        {/* Form-light vignette: subtle highlight in the middle, soft
            darken on all four edges. Radial so no single edge gets
            preferential treatment — avoids the "curved top" misread
            of a top-to-bottom gradient. */}
        <radialGradient id={formId} cx="50%" cy="50%" r="75%">
          <stop offset="0" stopColor="white" stopOpacity={vignetteStrength * 0.2} />
          <stop offset="0.65" stopColor="black" stopOpacity="0" />
          <stop offset="1" stopColor="black" stopOpacity={vignetteStrength} />
        </radialGradient>
        {/* Teeth mask: white inside each reel's bounding circle (r=20),
            minus the gear-shape interior. Result = the triangular tabs
            that project from the body into the reel cutout (the "teeth"). */}
        <mask id={teethMaskId}>
          <circle cx={leftReelX} cy={leftReelY} r="20" fill="white" />
          <circle cx={rightReelX} cy={rightReelY} r="20" fill="white" />
          <path d={REEL_D} fill="black" transform={`translate(${leftTx}, ${leftTy})`} />
          <path d={REEL_D} fill="black" transform={`translate(${rightTx}, ${rightTy})`} />
        </mask>
        {/* Body mask: white everywhere, with black cutouts for the
            (movable) reel gears and the tape window rect. Replaces the
            even-odd cutouts in TAPE_BODY_D so the gears can take SVG
            transforms. Drive holes stay in the body path itself. */}
        <mask id={bodyMaskId}>
          <rect x="0" y="0" width="373" height="233" fill="white" />
          <path d={REEL_D} fill="black" transform={`translate(${leftTx}, ${leftTy})`} />
          <path d={REEL_D} fill="black" transform={`translate(${rightTx}, ${rightTy})`} />
          <rect x="152" y="96.5" width="75" height="21" fill="black" />
        </mask>
        {/* Phillips screw: instanced via <use> at four corners + plate
            center. Kept in defs so the per-cassette uid scopes the id. */}
        <symbol id={screwId} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="12" fill={`rgb(${screwOuterLightness}, ${screwOuterLightness}, ${screwOuterLightness})`} />
          <circle cx="12" cy="12" r="10" fill={`rgb(${screwLightness}, ${screwLightness}, ${screwLightness})`} />
          <path d="M12 5V19" stroke="black" strokeWidth="2" strokeLinecap="round" />
          <line x1="5" y1="12" x2="19" y2="12" stroke="black" strokeWidth="2" strokeLinecap="round" />
        </symbol>
      </defs>
      {/* Big circle ring behind the reel, with center cutout sized
          at 105% of the reel size. */}
      <path d={ringPath} fill={circleColor} fillRule="evenodd" />
      {/* Tape body — with the tape window rect as a cutout subpath
          in the body path itself (even-odd fill rule). Where the rect
          was, the body is transparent and the tape ribbon below
          shows through. Body color comes from the bodyLightness slider. */}
      <g mask={`url(#${bodyMaskId})`}>
        <path
          d={`${OUTER_BODY_D}${DRIVE_HOLES_D}`}
          fill={bodyFill}
          fillRule="evenodd"
          filter={`url(#${grainId})`}
        />
        <path
          d={`${OUTER_BODY_D}${DRIVE_HOLES_D}`}
          fill={`url(#${formId})`}
          fillRule="evenodd"
        />
      </g>
      {/* Teeth-color overlay: a teethColor rect on top of the body,
          masked to ONLY the teeth tabs. Body color elsewhere stays
          unchanged; only the projecting reel teeth pick up this color. */}
      {/* Raised plate over the bottom drive-hole region. Slightly
          lighter than the body so it reads as a plateau catching
          ambient light; drive holes punch through via evenodd;
          clipped to the body so corners follow the rounded shell. */}
      <path
        d={`${platePath}${DRIVE_HOLES_D}`}
        fill={`rgb(${plateLightness}, ${plateLightness}, ${plateLightness})`}
        fillRule="evenodd"
        filter={`url(#${grainId})`}
        clipPath={`url(#${bodyClipId})`}
      />
      {/* Border along the plate's left/top/right edges (no bottom) for
          tunable shadow/highlight depth. */}
      <path
        d={plateBorderPath}
        fill="none"
        stroke={`rgb(${plateBorderLightness}, ${plateBorderLightness}, ${plateBorderLightness})`}
        strokeWidth={plateBorderWidth}
        strokeLinejoin="miter"
        clipPath={`url(#${bodyClipId})`}
      />
      <rect
        x="0"
        y="0"
        width="373"
        height="233"
        fill={teethColor}
        filter={`url(#${grainId})`}
        mask={`url(#${teethMaskId})`}
      />
      <g clipPath={`url(#${clipId})`}>
        {children}
        {/* Inner shadow on top of the label content — makes the
            sticker read as recessed into the cassette shell. */}
        <rect
          x="18"
          y="14"
          width="337"
          height="161"
          fill={`url(#${recessId})`}
          style={{ mixBlendMode: 'multiply' }}
        />
      </g>
      {/* Outline around the label area + spool window for inset depth. */}
      <path
        d={LABEL_CLIP_D}
        fill="none"
        stroke={`rgb(${artStrokeLightness}, ${artStrokeLightness}, ${artStrokeLightness})`}
        strokeWidth={artStrokeWidth}
        fillRule="evenodd"
      />
      {/* Phillips screws (four corners + center of the raised plate). */}
      {screwPositions.map((p, i) => (
        <use
          key={i}
          href={`#${screwId}`}
          x={p.x - screwSize / 2}
          y={p.y - screwSize / 2}
          width={screwSize}
          height={screwSize}
        />
      ))}
    </svg>
  );
}

function VariantBlock({
  title,
  description,
  render,
}: {
  title: string;
  description: string;
  render: (id: string) => React.ReactNode;
}) {
  return (
    <section className="mb-16">
      <h2 className="font-display text-3xl mb-1 text-[var(--text)]">{title}</h2>
      <p className="text-xs font-mono opacity-60 mb-6 text-[var(--text)] max-w-2xl">
        {description}
      </p>
      <div className="grid grid-cols-1 gap-6 max-w-2xl">
        {PLACEHOLDER_TAPES.map((id) => (
          <div key={id}>
            {render(id)}
            <p className="mt-2 text-[10px] font-mono opacity-50 text-[var(--text)] truncate">
              {id}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PlaceholdersMock() {
  const [circleRadius, setCircleRadius] = useState(DEFAULT_CASSETTE_PARAMS.circleRadius);
  const [reelSize, setReelSize] = useState(DEFAULT_CASSETTE_PARAMS.reelSize);
  const [bodyLightness, setBodyLightness] = useState(DEFAULT_CASSETTE_PARAMS.bodyLightness);
  const [grainStrength, setGrainStrength] = useState(DEFAULT_CASSETTE_PARAMS.grainStrength);
  const [vignetteStrength, setVignetteStrength] = useState(DEFAULT_CASSETTE_PARAMS.vignetteStrength);
  const [recessStrength, setRecessStrength] = useState(DEFAULT_CASSETTE_PARAMS.recessStrength);
  const [circleColor, setCircleColor] = useState(DEFAULT_CASSETTE_PARAMS.circleColor);
  const [teethColor, setTeethColor] = useState(DEFAULT_CASSETTE_PARAMS.teethColor);
  const [leftReelX, setLeftReelX] = useState(DEFAULT_CASSETTE_PARAMS.leftReelX);
  const [leftReelY, setLeftReelY] = useState(DEFAULT_CASSETTE_PARAMS.leftReelY);
  const [rightReelX, setRightReelX] = useState(DEFAULT_CASSETTE_PARAMS.rightReelX);
  const [rightReelY, setRightReelY] = useState(DEFAULT_CASSETTE_PARAMS.rightReelY);
  const [plateWidth, setPlateWidth] = useState(DEFAULT_CASSETTE_PARAMS.plateWidth);
  const [plateHeight, setPlateHeight] = useState(DEFAULT_CASSETTE_PARAMS.plateHeight);
  const [plateLightness, setPlateLightness] = useState(DEFAULT_CASSETTE_PARAMS.plateLightness);
  const [plateBorderWidth, setPlateBorderWidth] = useState(DEFAULT_CASSETTE_PARAMS.plateBorderWidth);
  const [plateBorderLightness, setPlateBorderLightness] = useState(DEFAULT_CASSETTE_PARAMS.plateBorderLightness);
  const [screwSize, setScrewSize] = useState(DEFAULT_CASSETTE_PARAMS.screwSize);
  const [screwInsetX, setScrewInsetX] = useState(DEFAULT_CASSETTE_PARAMS.screwInsetX);
  const [screwTopY, setScrewTopY] = useState(DEFAULT_CASSETTE_PARAMS.screwTopY);
  const [screwBottomY, setScrewBottomY] = useState(DEFAULT_CASSETTE_PARAMS.screwBottomY);
  const [screwCenterX, setScrewCenterX] = useState(DEFAULT_CASSETTE_PARAMS.screwCenterX);
  const [screwCenterY, setScrewCenterY] = useState(DEFAULT_CASSETTE_PARAMS.screwCenterY);
  const [screwLightness, setScrewLightness] = useState(DEFAULT_CASSETTE_PARAMS.screwLightness);
  const [screwOuterLightness, setScrewOuterLightness] = useState(DEFAULT_CASSETTE_PARAMS.screwOuterLightness);
  const [artStrokeWidth, setArtStrokeWidth] = useState(DEFAULT_CASSETTE_PARAMS.artStrokeWidth);
  const [artStrokeLightness, setArtStrokeLightness] = useState(DEFAULT_CASSETTE_PARAMS.artStrokeLightness);

  const reset = () => {
    setCircleRadius(DEFAULT_CASSETTE_PARAMS.circleRadius);
    setReelSize(DEFAULT_CASSETTE_PARAMS.reelSize);
    setBodyLightness(DEFAULT_CASSETTE_PARAMS.bodyLightness);
    setGrainStrength(DEFAULT_CASSETTE_PARAMS.grainStrength);
    setVignetteStrength(DEFAULT_CASSETTE_PARAMS.vignetteStrength);
    setRecessStrength(DEFAULT_CASSETTE_PARAMS.recessStrength);
    setCircleColor(DEFAULT_CASSETTE_PARAMS.circleColor);
    setTeethColor(DEFAULT_CASSETTE_PARAMS.teethColor);
    setLeftReelX(DEFAULT_CASSETTE_PARAMS.leftReelX);
    setLeftReelY(DEFAULT_CASSETTE_PARAMS.leftReelY);
    setRightReelX(DEFAULT_CASSETTE_PARAMS.rightReelX);
    setRightReelY(DEFAULT_CASSETTE_PARAMS.rightReelY);
    setPlateWidth(DEFAULT_CASSETTE_PARAMS.plateWidth);
    setPlateHeight(DEFAULT_CASSETTE_PARAMS.plateHeight);
    setPlateLightness(DEFAULT_CASSETTE_PARAMS.plateLightness);
    setPlateBorderWidth(DEFAULT_CASSETTE_PARAMS.plateBorderWidth);
    setPlateBorderLightness(DEFAULT_CASSETTE_PARAMS.plateBorderLightness);
    setScrewSize(DEFAULT_CASSETTE_PARAMS.screwSize);
    setScrewInsetX(DEFAULT_CASSETTE_PARAMS.screwInsetX);
    setScrewTopY(DEFAULT_CASSETTE_PARAMS.screwTopY);
    setScrewBottomY(DEFAULT_CASSETTE_PARAMS.screwBottomY);
    setScrewCenterX(DEFAULT_CASSETTE_PARAMS.screwCenterX);
    setScrewCenterY(DEFAULT_CASSETTE_PARAMS.screwCenterY);
    setScrewLightness(DEFAULT_CASSETTE_PARAMS.screwLightness);
    setScrewOuterLightness(DEFAULT_CASSETTE_PARAMS.screwOuterLightness);
    setArtStrokeWidth(DEFAULT_CASSETTE_PARAMS.artStrokeWidth);
    setArtStrokeLightness(DEFAULT_CASSETTE_PARAMS.artStrokeLightness);
  };

  return (
    <CassetteContext.Provider
      value={{
        circleRadius,
        reelSize,
        bodyLightness,
        grainStrength,
        vignetteStrength,
        recessStrength,
        circleColor,
        teethColor,
        leftReelX,
        leftReelY,
        rightReelX,
        rightReelY,
        plateWidth,
        plateHeight,
        plateLightness,
        plateBorderWidth,
        plateBorderLightness,
        screwSize,
        screwInsetX,
        screwTopY,
        screwBottomY,
        screwCenterX,
        screwCenterY,
        screwLightness,
        screwOuterLightness,
        artStrokeWidth,
        artStrokeLightness,
      }}
    >
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex">
          <main className="flex-1 min-w-0 py-12 pr-8">
            <h1 className="font-display text-5xl mb-2 text-[var(--text)]">
              Placeholders
            </h1>
            <p className="text-sm font-mono opacity-60 mb-12 text-[var(--text)]">
              Live cassette mechanism controls. Label content (variants F
              &amp; G) is now baked into static PNGs at build time.
            </p>

            <VariantBlock
              title="Placeholders"
              description="Each tape gets ONE placeholder, randomly assigned at build time between dithered-gradient (F) and ASCII (G). Re-run scripts/generate-placeholder-shaders.mjs to re-roll. Per-tape style + seed are baked into the static AVIF/PNG."
              render={(id) => <PlaceholderCassette id={id} />}
            />
          </main>

          <aside className="w-80 shrink-0 border-l border-[var(--border)] overflow-y-auto pl-6 py-6 max-h-screen sticky top-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text)]">
              Cassette mechanism
            </h2>
            <button
              type="button"
              onClick={reset}
              className="text-[10px] font-mono uppercase tracking-wider text-[var(--text)] opacity-60 hover:opacity-100 underline"
            >
              reset
            </button>
          </div>

          <div className="space-y-3">
            <ControlSlider
              label="Circle radius"
              value={circleRadius}
              min={20}
              max={130}
              step={1}
              onChange={setCircleRadius}
            />
            <ControlSlider
              label="Reel size"
              value={reelSize}
              min={3}
              max={40}
              step={0.5}
              onChange={setReelSize}
              hint={`cutout = ${(reelSize * 1.05).toFixed(2)}`}
            />
            <ControlSlider
              label="Body darkness"
              value={bodyLightness}
              min={0}
              max={60}
              step={1}
              onChange={setBodyLightness}
              hint={`#${bodyLightness.toString(16).padStart(2, '0').repeat(3)}`}
            />
            <ControlSlider
              label="Grain strength"
              value={grainStrength}
              min={0}
              max={0.2}
              step={0.005}
              onChange={setGrainStrength}
            />
            <ControlSlider
              label="Vignette strength"
              value={vignetteStrength}
              min={0}
              max={0.3}
              step={0.005}
              onChange={setVignetteStrength}
            />
            <ControlSlider
              label="Recess strength"
              value={recessStrength}
              min={0}
              max={1.5}
              step={0.05}
              onChange={setRecessStrength}
            />
            <label className="block">
              <div className="flex justify-between items-baseline text-[11px] font-mono text-[var(--text)]">
                <span>Wound-tape color</span>
                <span className="opacity-60 tabular-nums">{circleColor}</span>
              </div>
              <input
                type="color"
                value={circleColor}
                onChange={(e) => setCircleColor(e.target.value)}
                className="w-full h-7 cursor-pointer bg-transparent border border-[var(--border)] mt-1"
              />
            </label>
            <label className="block">
              <div className="flex justify-between items-baseline text-[11px] font-mono text-[var(--text)]">
                <span>Teeth color</span>
                <span className="opacity-60 tabular-nums">{teethColor}</span>
              </div>
              <input
                type="color"
                value={teethColor}
                onChange={(e) => setTeethColor(e.target.value)}
                className="w-full h-7 cursor-pointer bg-transparent border border-[var(--border)] mt-1"
              />
            </label>
            <div className="pt-3 border-t border-[var(--border)]">
              <p className="text-[10px] font-mono uppercase tracking-wider opacity-60 text-[var(--text)] mb-2">
                Reel positions
              </p>
              <div className="space-y-3">
                <ControlSlider
                  label="Left reel X"
                  value={leftReelX}
                  min={50}
                  max={170}
                  step={1}
                  onChange={setLeftReelX}
                />
                <ControlSlider
                  label="Left reel Y"
                  value={leftReelY}
                  min={50}
                  max={160}
                  step={1}
                  onChange={setLeftReelY}
                />
                <ControlSlider
                  label="Right reel X"
                  value={rightReelX}
                  min={210}
                  max={330}
                  step={1}
                  onChange={setRightReelX}
                />
                <ControlSlider
                  label="Right reel Y"
                  value={rightReelY}
                  min={50}
                  max={160}
                  step={1}
                  onChange={setRightReelY}
                />
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-[var(--border)]">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-[var(--text)] opacity-60 mb-3">
                Raised plate
              </h3>
              <div className="space-y-3">
                <ControlSlider
                  label="Plate width"
                  value={plateWidth}
                  min={120}
                  max={360}
                  step={1}
                  onChange={setPlateWidth}
                />
                <ControlSlider
                  label="Plate height"
                  value={plateHeight}
                  min={20}
                  max={80}
                  step={1}
                  onChange={setPlateHeight}
                />
                <ControlSlider
                  label="Plate lightness"
                  value={plateLightness}
                  min={0}
                  max={60}
                  step={1}
                  onChange={setPlateLightness}
                  hint={`#${plateLightness.toString(16).padStart(2, '0').repeat(3)}`}
                />
                <ControlSlider
                  label="Border width"
                  value={plateBorderWidth}
                  min={0}
                  max={5}
                  step={0.25}
                  onChange={setPlateBorderWidth}
                />
                <ControlSlider
                  label="Border lightness"
                  value={plateBorderLightness}
                  min={0}
                  max={60}
                  step={1}
                  onChange={setPlateBorderLightness}
                  hint={`#${plateBorderLightness.toString(16).padStart(2, '0').repeat(3)}`}
                />
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-[var(--border)]">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-[var(--text)] opacity-60 mb-3">
                Screws
              </h3>
              <div className="space-y-3">
                <ControlSlider
                  label="Screw size"
                  value={screwSize}
                  min={4}
                  max={30}
                  step={0.5}
                  onChange={setScrewSize}
                />
                <ControlSlider
                  label="Corner inset X"
                  value={screwInsetX}
                  min={4}
                  max={40}
                  step={1}
                  onChange={setScrewInsetX}
                />
                <ControlSlider
                  label="Top corners Y"
                  value={screwTopY}
                  min={4}
                  max={40}
                  step={1}
                  onChange={setScrewTopY}
                />
                <ControlSlider
                  label="Bottom corners Y"
                  value={screwBottomY}
                  min={180}
                  max={228}
                  step={1}
                  onChange={setScrewBottomY}
                />
                <ControlSlider
                  label="Center screw X"
                  value={screwCenterX}
                  min={120}
                  max={260}
                  step={0.5}
                  onChange={setScrewCenterX}
                />
                <ControlSlider
                  label="Center screw Y"
                  value={screwCenterY}
                  min={180}
                  max={228}
                  step={0.5}
                  onChange={setScrewCenterY}
                />
                <ControlSlider
                  label="Screw lightness"
                  value={screwLightness}
                  min={0}
                  max={120}
                  step={1}
                  onChange={setScrewLightness}
                  hint={`#${screwLightness.toString(16).padStart(2, '0').repeat(3)}`}
                />
                <ControlSlider
                  label="Screw ring lightness"
                  value={screwOuterLightness}
                  min={0}
                  max={60}
                  step={1}
                  onChange={setScrewOuterLightness}
                  hint={`#${screwOuterLightness.toString(16).padStart(2, '0').repeat(3)}`}
                />
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-[var(--border)]">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-[var(--text)] opacity-60 mb-3">
                Art stroke
              </h3>
              <div className="space-y-3">
                <ControlSlider
                  label="Stroke width"
                  value={artStrokeWidth}
                  min={0}
                  max={3}
                  step={0.25}
                  onChange={setArtStrokeWidth}
                />
                <ControlSlider
                  label="Stroke lightness"
                  value={artStrokeLightness}
                  min={0}
                  max={60}
                  step={1}
                  onChange={setArtStrokeLightness}
                  hint={`#${artStrokeLightness.toString(16).padStart(2, '0').repeat(3)}`}
                />
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-[var(--border)]">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-[10px] font-mono uppercase tracking-wider text-[var(--text)] opacity-60">
                  Params JSON
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const json = JSON.stringify(
                      {
                        circleRadius,
                        reelSize,
                        bodyLightness,
                        grainStrength,
                        vignetteStrength,
                        recessStrength,
                        circleColor,
                        teethColor,
                        leftReelX,
                        leftReelY,
                        rightReelX,
                        rightReelY,
                        plateWidth,
                        plateHeight,
                        plateLightness,
                        plateBorderWidth,
                        plateBorderLightness,
                        screwSize,
                        screwInsetX,
                        screwTopY,
                        screwBottomY,
                        screwCenterX,
                        screwCenterY,
                        screwLightness,
                        screwOuterLightness,
                        artStrokeWidth,
                        artStrokeLightness,
                      },
                      null,
                      2,
                    );
                    navigator.clipboard.writeText(json);
                  }}
                  className="text-[10px] font-mono uppercase tracking-wider text-[var(--text)] opacity-60 hover:opacity-100 underline cursor-pointer"
                >
                  copy
                </button>
              </div>
              <textarea
                readOnly
                value={JSON.stringify(
                  {
                    circleRadius,
                    reelSize,
                    bodyLightness,
                    grainStrength,
                    vignetteStrength,
                    recessStrength,
                    circleColor,
                    teethColor,
                    leftReelX,
                    leftReelY,
                    rightReelX,
                    rightReelY,
                    plateWidth,
                    plateHeight,
                    plateLightness,
                    plateBorderWidth,
                    plateBorderLightness,
                    screwSize,
                    screwInsetX,
                    screwTopY,
                    screwBottomY,
                    screwCenterX,
                    screwCenterY,
                    screwLightness,
                    screwOuterLightness,
                    artStrokeWidth,
                    artStrokeLightness,
                  },
                  null,
                  2,
                )}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full h-72 font-mono text-[10px] bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] p-2 resize-y"
              />
            </div>
          </div>
        </aside>
        </div>
      </div>
    </CassetteContext.Provider>
  );
}

function ControlSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex justify-between items-baseline text-[11px] font-mono text-[var(--text)]">
        <span>{label}</span>
        <span className="opacity-60 tabular-nums">
          {value}
          {hint ? ` · ${hint}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </label>
  );
}
