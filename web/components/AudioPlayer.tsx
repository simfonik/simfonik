'use client';

import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { PlayerControls } from './PlayerControls';

interface AudioPlayerProps {
  src: string;
  title?: string;
  tapeId?: string;
  sidePosition?: string;
}

export function AudioPlayer({ src, title, tapeId, sidePosition }: AudioPlayerProps) {
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
        onPlay={controls.play}
        onPause={controls.pause}
        onSeek={controls.seek}
      />
    </>
  );
}
