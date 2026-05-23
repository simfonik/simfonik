'use client';

import { useId } from 'react';
import {
  buildTapeRing,
  CASSETTE_DEFAULTS,
} from '../scripts/lib/cassette-svg.mjs';
import { CassetteSvg } from './cassette/CassetteSvg';
import { useAnyAudioPlaying } from '../hooks/useAnyAudioPlaying';
import { useCurrentTrackTime } from '../hooks/useCurrentTrackTime';

// Live SVG placeholder cassette for tape detail pages. Wraps the
// shared <CassetteSvg> with audio-reactive behavior:
//   - reels spin while any audio is playing (CCW; right faster than
//     left because the empty takeup reel rotates faster at the start)
//   - the wound-tape pancake on the left shrinks while the right grows
//     over the track's duration, with tape area conserved
//   - banding gradient on the pancakes makes the rotation legible
// Listing pages keep using the static AVIF since they have no audio
// context to drive these behaviors.

interface PlaceholderCassetteLiveProps {
  tapeId: string;
  // Inlined base64 data URI for the shader label. Passed from the page
  // server component so the label renders atomically with the SVG
  // housing — no second HTTP request, no pop-in.
  labelDataUri: string;
  className?: string;
}

const c = CASSETTE_DEFAULTS;
const HUB_R = c.reelSize * 1.05;
const R_MAX = c.circleRadius;
// Area conservation: as one reel's tape area decreases, the other's
// increases. outerR(t) = sqrt(hub² + t × (Rmax² − hub²)). The sqrt
// is what makes the radius shrink fast at the start and slow at the
// end — matches real wound-tape physics.
const TAPE_AREA = R_MAX * R_MAX - HUB_R * HUB_R;

function tapeRadii(progress: number): { leftR: number; rightR: number } {
  const t = Math.max(0, Math.min(1, progress));
  return {
    leftR: Math.sqrt(HUB_R * HUB_R + (1 - t) * TAPE_AREA),
    rightR: Math.sqrt(HUB_R * HUB_R + t * TAPE_AREA),
  };
}

// Deterministic per-tape grain seed so cassettes don't all share a
// noise pattern. Mirrors the bake script's hashString-driven seeding.
function hashTapeId(tapeId: string): number {
  return (
    Array.from(tapeId).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 0) %
    100
  );
}

export function PlaceholderCassetteLive({
  tapeId,
  labelDataUri,
  className,
}: PlaceholderCassetteLiveProps) {
  const uid = useId().replace(/:/g, '');
  const isPlaying = useAnyAudioPlaying();
  const { currentTime, duration } = useCurrentTrackTime();
  const progress = duration > 0 ? currentTime / duration : 0;
  const { leftR, rightR } = tapeRadii(progress);

  const leftSpinClass = isPlaying ? 'cassette-reel-spin-left' : '';
  const rightSpinClass = isPlaying ? 'cassette-reel-spin-right' : '';

  return (
    <CassetteSvg
      params={c}
      uid={uid}
      grainSeed={hashTapeId(tapeId)}
      leftRingPath={buildTapeRing(c.leftReelX, c.leftReelY, leftR, HUB_R)}
      rightRingPath={buildTapeRing(c.rightReelX, c.rightReelY, rightR, HUB_R)}
      hubSpinClassLeft={leftSpinClass}
      hubSpinClassRight={rightSpinClass}
      ringSpinClassLeft={leftSpinClass}
      ringSpinClassRight={rightSpinClass}
      enableTapeBanding
      className={className}
    >
      <image
        href={labelDataUri}
        x="18"
        y="14"
        width="337"
        height="161"
        preserveAspectRatio="xMidYMid slice"
      />
    </CassetteSvg>
  );
}
