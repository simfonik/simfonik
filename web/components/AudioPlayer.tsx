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
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200 text-sm">{state.error}</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-2.5">
      <audio
        ref={ref}
        src={src}
        preload="none"
        playsInline
      />
      
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
    </div>
  );
}
