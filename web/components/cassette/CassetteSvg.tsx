'use client';

import type { ReactNode } from 'react';
import {
  OUTER_BODY_D,
  REEL_D,
  DRIVE_HOLES_D,
  LABEL_CLIP_D,
  buildRaisedPlate,
  buildRaisedPlateBorder,
  buildScrewPositions,
  CASSETTE_DEFAULTS,
} from '../../scripts/lib/cassette-svg.mjs';

// Shared cassette SVG markup. Single source of truth for the runtime
// React renderers: the live placeholder on tape pages
// (PlaceholderCassetteLive) and the dev playground
// (_placeholders-mock.tsx) both wrap this with thin adapters that
// supply their respective params + slot the label content. The bake
// script (generate-placeholder-shaders.mjs) duplicates the structure
// in a string template — it stays separate because sharing would need
// JSX-in-Node, not worth the build complexity. Structural parity with
// the bake script is maintained via shared CASSETTE_DEFAULTS + path
// helpers in cassette-svg.mjs.

type CassetteParams = typeof CASSETTE_DEFAULTS;

interface CassetteSvgProps {
  params: CassetteParams;
  /** Per-instance uid so def IDs don't collide across multiple cassettes. */
  uid: string;
  /** feTurbulence seed (0..99). Caller hashes its own input. */
  grainSeed: number;
  /** Wound-tape pancake path on the left reel. */
  leftRingPath: string;
  /** Wound-tape pancake on the right reel. Omit for the at-rest state
   * (dev page renders only the left). */
  rightRingPath?: string;
  /** CSS class applied to each REEL_D path inside the masks. Toggling
   * a spin class here rotates the gear-teeth cutouts. */
  hubSpinClassLeft?: string;
  hubSpinClassRight?: string;
  /** CSS class applied to the pancake's wrapping <g>. Use the same
   * spin class as the hub to keep wound tape and reel in sync. */
  ringSpinClassLeft?: string;
  ringSpinClassRight?: string;
  /** When true, fills the pancakes with a diagonal banding gradient
   * instead of flat circleColor — visible banding makes rotation
   * easier to read. */
  enableTapeBanding?: boolean;
  /** Label area contents — shader pattern from dev page or baked
   * label PNG from the live placeholder. */
  children: ReactNode;
  className?: string;
}

export function CassetteSvg({
  params: c,
  uid,
  grainSeed,
  leftRingPath,
  rightRingPath,
  hubSpinClassLeft = '',
  hubSpinClassRight = '',
  ringSpinClassLeft = '',
  ringSpinClassRight = '',
  enableTapeBanding = false,
  children,
  className = 'block w-full h-auto',
}: CassetteSvgProps) {
  const clipId = `cs-clip-${uid}`;
  const bodyClipId = `cs-body-clip-${uid}`;
  const grainId = `cs-grain-${uid}`;
  const recessId = `cs-recess-${uid}`;
  const formId = `cs-form-${uid}`;
  const teethMaskId = `cs-teeth-${uid}`;
  const bodyMaskId = `cs-body-${uid}`;
  const screwId = `cs-screw-${uid}`;
  const tapeBandId = `cs-tapeband-${uid}`;

  // REEL_D bbox is (0,0)–(36,36); translate by (cx − 18, cy − 18) so
  // the path's center lands at the reel's natural position.
  const leftReelTx = c.leftReelX - 18;
  const leftReelTy = c.leftReelY - 18;
  const rightReelTx = c.rightReelX - 18;
  const rightReelTy = c.rightReelY - 18;
  const bodyFill = `rgb(${c.bodyLightness}, ${c.bodyLightness}, ${c.bodyLightness})`;
  const rs = c.recessStrength;
  const ringFill = enableTapeBanding ? `url(#${tapeBandId})` : c.circleColor;

  const platePath = buildRaisedPlate(c.plateWidth, c.plateHeight);
  const plateBorderPath = buildRaisedPlateBorder(c.plateWidth, c.plateHeight);
  const screwPositions = buildScrewPositions({
    insetX: c.screwInsetX,
    topY: c.screwTopY,
    bottomY: c.screwBottomY,
    centerX: c.screwCenterX,
    centerY: c.screwCenterY,
  });

  return (
    <svg
      viewBox="0 0 373 233"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}>
          <path d={LABEL_CLIP_D} />
        </clipPath>
        <clipPath id={bodyClipId}>
          <path d={OUTER_BODY_D} />
        </clipPath>
        <filter id={grainId} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="1.6"
            numOctaves={2}
            seed={grainSeed}
            result="noise"
          />
          <feComposite
            in="SourceGraphic"
            in2="noise"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3={c.grainStrength}
            k4="0"
            result="grained"
          />
          {/* Clip noise to source alpha — without this, transparent
              pixels pick up faint k3·noise and produce a rectangular
              halo around the cassette on dark bg. */}
          <feComposite in="grained" in2="SourceGraphic" operator="in" />
        </filter>
        <linearGradient id={recessId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="black" stopOpacity={Math.min(1, 0.55 * rs)} />
          <stop offset="0.06" stopColor="black" stopOpacity={Math.min(1, 0.18 * rs)} />
          <stop offset="0.14" stopColor="black" stopOpacity="0" />
          <stop offset="0.86" stopColor="black" stopOpacity="0" />
          <stop offset="0.95" stopColor="black" stopOpacity={Math.min(1, 0.1 * rs)} />
          <stop offset="1" stopColor="black" stopOpacity={Math.min(1, 0.22 * rs)} />
        </linearGradient>
        <radialGradient id={formId} cx="50%" cy="50%" r="75%">
          <stop offset="0" stopColor="white" stopOpacity={c.vignetteStrength * 0.2} />
          <stop offset="0.65" stopColor="black" stopOpacity="0" />
          <stop offset="1" stopColor="black" stopOpacity={c.vignetteStrength} />
        </radialGradient>
        {enableTapeBanding && (
          <linearGradient id={tapeBandId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2D2D2D" />
            <stop offset="0.25" stopColor="#333333" />
            <stop offset="0.5" stopColor="#2D2D2D" />
            <stop offset="0.75" stopColor="#333333" />
            <stop offset="1" stopColor="#2D2D2D" />
          </linearGradient>
        )}
        <mask id={teethMaskId}>
          <circle cx={c.leftReelX} cy={c.leftReelY} r="20" fill="white" />
          <circle cx={c.rightReelX} cy={c.rightReelY} r="20" fill="white" />
          <g transform={`translate(${leftReelTx} ${leftReelTy})`}>
            <path d={REEL_D} fill="black" className={hubSpinClassLeft} />
          </g>
          <g transform={`translate(${rightReelTx} ${rightReelTy})`}>
            <path d={REEL_D} fill="black" className={hubSpinClassRight} />
          </g>
        </mask>
        <mask id={bodyMaskId}>
          <rect x="0" y="0" width="373" height="233" fill="white" />
          <g transform={`translate(${leftReelTx} ${leftReelTy})`}>
            <path d={REEL_D} fill="black" className={hubSpinClassLeft} />
          </g>
          <g transform={`translate(${rightReelTx} ${rightReelTy})`}>
            <path d={REEL_D} fill="black" className={hubSpinClassRight} />
          </g>
          <rect x="152" y="96.5" width="75" height="21" fill="black" />
        </mask>
        <symbol id={screwId} viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="12"
            fill={`rgb(${c.screwOuterLightness}, ${c.screwOuterLightness}, ${c.screwOuterLightness})`}
          />
          <circle
            cx="12"
            cy="12"
            r="10"
            fill={`rgb(${c.screwLightness}, ${c.screwLightness}, ${c.screwLightness})`}
          />
          <path d="M12 5V19" stroke="black" strokeWidth="2" strokeLinecap="round" />
          <line x1="5" y1="12" x2="19" y2="12" stroke="black" strokeWidth="2" strokeLinecap="round" />
        </symbol>
      </defs>

      <g className={ringSpinClassLeft}>
        <path d={leftRingPath} fill={ringFill} fillRule="evenodd" />
      </g>
      {rightRingPath && (
        <g className={ringSpinClassRight}>
          <path d={rightRingPath} fill={ringFill} fillRule="evenodd" />
        </g>
      )}
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
      <path
        d={`${platePath}${DRIVE_HOLES_D}`}
        fill={`rgb(${c.plateLightness}, ${c.plateLightness}, ${c.plateLightness})`}
        fillRule="evenodd"
        filter={`url(#${grainId})`}
        clipPath={`url(#${bodyClipId})`}
      />
      <path
        d={plateBorderPath}
        fill="none"
        stroke={`rgb(${c.plateBorderLightness}, ${c.plateBorderLightness}, ${c.plateBorderLightness})`}
        strokeWidth={c.plateBorderWidth}
        strokeLinejoin="miter"
        clipPath={`url(#${bodyClipId})`}
      />
      <rect
        x="0"
        y="0"
        width="373"
        height="233"
        fill={c.teethColor}
        filter={`url(#${grainId})`}
        mask={`url(#${teethMaskId})`}
      />
      <g clipPath={`url(#${clipId})`}>
        {children}
        <rect
          x="18"
          y="14"
          width="337"
          height="161"
          fill={`url(#${recessId})`}
          style={{ mixBlendMode: 'multiply' }}
        />
      </g>
      <path
        d={LABEL_CLIP_D}
        fill="none"
        stroke={`rgb(${c.artStrokeLightness}, ${c.artStrokeLightness}, ${c.artStrokeLightness})`}
        strokeWidth={c.artStrokeWidth}
        fillRule="evenodd"
      />
      {screwPositions.map((p, i) => (
        <use
          key={i}
          href={`#${screwId}`}
          x={p.x - c.screwSize / 2}
          y={p.y - c.screwSize / 2}
          width={c.screwSize}
          height={c.screwSize}
        />
      ))}
    </svg>
  );
}
