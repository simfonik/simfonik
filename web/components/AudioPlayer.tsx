'use client';

import { useEffect, useMemo } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { PlayerControls } from './PlayerControls';
import { timeline } from '../lib/track-ids/side';
import { useSide, useTapeTrackIds } from './TapeTrackIds';
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
  const trackIds = useTapeTrackIds();
  const { rows } = useSide(sideIndex);
  const ids = useMemo(() => timeline(rows), [rows]);
  const { ref, state, controls } = useAudioPlayer({ 
    src, 
    tapeId, 
    sidePosition 
  });

  // A time pressed in a comment takes the tape there and plays it.
  const { play, seek } = controls;
  const { isPlaying } = state;
  const { setPlayer } = trackIds;
  useEffect(() => {
    setPlayer((_position, time) => {
      seek(time);
      if (!isPlaying) play();
    });
    return () => setPlayer(null);
  }, [setPlayer, isPlaying, play, seek]);

  // The tracklist, down the page, lights the track playing and can time one that starts now.
  const { report } = trackIds;
  const { currentTime } = state;
  useEffect(() => {
    report(sideIndex, currentTime, isPlaying || currentTime > 0);
  }, [report, sideIndex, currentTime, isPlaying]);

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
            side={sideIndex}
            position={sideCount > 1 ? sidePosition ?? null : null}
            time={state.currentTime}
            isPlaying={state.isPlaying}
            onToggle={state.isPlaying ? controls.pause : controls.play}
            length={state.duration > 0 ? state.duration : length}
          />
        )}
      </PlayerControls>
    </>
  );
}
