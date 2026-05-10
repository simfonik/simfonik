'use client';

import { createContext, useContext, useState } from 'react';
import {
  OUTER_BODY_D,
  RIGHT_REEL_D,
  LEFT_REEL_D,
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
};
const DEFAULT_CASSETTE_PARAMS: CassetteParams = {
  circleRadius: 68,
  reelSize: 25,
  bodyLightness: 4,
  grainStrength: 0.04,
  vignetteStrength: 0.235,
  recessStrength: 0.5,
  circleColor: '#363535',
  teethColor: '#5e5a5a',
  leftReelX: 111,
  leftReelY: 107,
  rightReelX: 266,
  rightReelY: 107,
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
  const url = `/generated/placeholders/${id}.avif`;
  return (
    <CassetteSvg uid={`p-${id}`}>
      <image
        href={url}
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
  } = useContext(CassetteContext);
  const teethMaskId = `teeth-${uid}`;
  const bodyMaskId = `body-${uid}`;
  // Reel paths are positioned naturally at (111, 107) / (266, 107).
  // Compute translation deltas so SVG transforms move them.
  const leftDx = leftReelX - 111;
  const leftDy = leftReelY - 107;
  const rightDx = rightReelX - 266;
  const rightDy = rightReelY - 107;
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
          />
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
          <path d={LEFT_REEL_D} fill="black" transform={`translate(${leftDx}, ${leftDy})`} />
          <path d={RIGHT_REEL_D} fill="black" transform={`translate(${rightDx}, ${rightDy})`} />
        </mask>
        {/* Body mask: white everywhere, with black cutouts for the
            (movable) reel gears and the tape window rect. Replaces the
            even-odd cutouts in TAPE_BODY_D so the gears can take SVG
            transforms. Drive holes stay in the body path itself. */}
        <mask id={bodyMaskId}>
          <rect x="0" y="0" width="373" height="233" fill="white" />
          <path d={LEFT_REEL_D} fill="black" transform={`translate(${leftDx}, ${leftDy})`} />
          <path d={RIGHT_REEL_D} fill="black" transform={`translate(${rightDx}, ${rightDy})`} />
          <rect x="152" y="96.5" width="75" height="21" fill="black" />
        </mask>
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
      <rect
        x="0"
        y="0"
        width="373"
        height="233"
        fill={teethColor}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
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
