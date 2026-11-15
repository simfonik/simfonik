'use client';

import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useTrackIds } from '../hooks/useTrackIds';
import { PlayerControls } from './PlayerControls';
import { TrackIds } from './TrackIds';

interface AudioPlayerProps {
  src: string;
  title?: string;
  tapeId?: string;
  sidePosition?: string;
  wave?: number[] | null;
  length?: number | null;
  /** The side's place among all the tape's sides, and how many there are: for the track IDs. */
  sideIndex?: number;
  sideCount?: number;
}

export function AudioPlayer({ src, title, tapeId, sidePosition, wave, length, sideIndex = 0, sideCount = 1 }: AudioPlayerProps) {
  const trackIds = useTrackIds(tapeId);
  const ids = trackIds.sides[sideIndex] ?? [];
  const { ref, state, controls } = useAudioPlayer({ 
    src, 
    tapeId, 
    sidePosition 
  });

  if (state.error) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-red-500 border-[1.5px] border-red-500 px-3 py-2">
        {state.error}
      </p>
    );
  }

  return (
    <>
      <audio ref={ref} src={src} preload="none" playsInline />
      <PlayerControls
        isPlaying={state.isPlaying}
        currentTime={state.currentTime}
        duration={state.duration}
        isLoading={state.isLoading}
        title={title}
        wave={wave}
        length={length}
        ids={ids}
        onPlay={controls.play}
        onPause={controls.pause}
        onSeek={controls.seek}
      >
        {tapeId && (
          <TrackIds
            tapeId={tapeId}
            position={sideCount > 1 ? sidePosition ?? null : null}
            ids={ids}
            time={state.currentTime}
            onPosted={trackIds.refresh}
          />
        )}
      </PlayerControls>
    </>
  );
}
