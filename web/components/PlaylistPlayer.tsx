'use client';

import { useState, useCallback } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { PlayerControls, formatTime } from './PlayerControls';

interface DJ {
  name: string;
  slug: string;
  link?: boolean;
}

interface Track {
  title: string;
  url: string;
  position: string;
  djs?: DJ[];
  wave?: number[] | null;
  length?: number | null;
}

interface PlaylistPlayerProps {
  tracks: Track[];
  tapeId?: string;
}

export function PlaylistPlayer({ tracks, tapeId }: PlaylistPlayerProps) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const currentTrack = tracks[currentTrackIndex];

  const handleNextTrack = useCallback(() => {
    if (currentTrackIndex < tracks.length - 1) {
      setCurrentTrackIndex(prev => prev + 1);
    }
  }, [currentTrackIndex, tracks.length]);

  const { ref, state, controls } = useAudioPlayer({
    src: currentTrack.url,
    tapeId,
    sidePosition: currentTrack.position,
    onEnded: currentTrackIndex < tracks.length - 1 ? handleNextTrack : undefined
  });

  const selectTrack = (index: number) => {
    if (index === currentTrackIndex) {
      // If clicking current track, toggle play/pause
      if (state.isPlaying) {
        controls.pause();
      } else {
        controls.play();
      }
    } else {
      // Switch to new track
      setCurrentTrackIndex(index);
      // The hook will automatically play because isPlaying is preserved when tracking intent
      if (!state.isPlaying) {
        controls.play();
      }
    }
  };

  if (state.error) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-red-500 border-[1.5px] border-red-500 px-3 py-2">
        {state.error}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <audio ref={ref} src={currentTrack.url} preload="none" playsInline />

      <PlayerControls
        isPlaying={state.isPlaying}
        currentTime={state.currentTime}
        duration={state.duration}
        isLoading={state.isLoading}
        title={currentTrack.title}
        wave={currentTrack.wave}
        length={currentTrack.length}
        onPlay={controls.play}
        onPause={controls.pause}
        onSeek={controls.seek}
      />

      {/* The sides. Each row keeps to the player's two edges: its glyph under the play button, on the content's
          left edge, and its name under the start of the bar. The side that is loaded is the one in full
          colour; the others wait in grey. */}
      <div className="border-t border-[var(--border)]">
        {tracks.map((track, index) => {
          const isCurrent = index === currentTrackIndex;
          return (
            <button
              key={track.position}
              onClick={() => selectTrack(index)}
              aria-current={isCurrent ? 'true' : undefined}
              className={`player-side grid w-full grid-cols-[2.75rem_1fr_auto] items-center gap-x-3 border-b border-[var(--border)] py-3 text-left cursor-pointer ${
                isCurrent ? 'text-[var(--text)]' : 'text-[var(--muted)]'
              }`}
            >
              <svg className="h-3.5 w-3" viewBox="0 0 12 14" fill="currentColor" aria-hidden>
                {isCurrent && state.isPlaying ? <path d="M0 0h4v14H0zM8 0h4v14H8z" /> : <path d="M0 0v14l11-7z" />}
              </svg>
              <span className="min-w-0">
                <span className="font-display text-base leading-tight">{track.title}</span>
                {track.djs && track.djs.length > 0 && (
                  <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mt-0.5">
                    {track.djs.map((dj) => dj.name).join(', ')}
                  </span>
                )}
              </span>
              {/* How long the side is, said before it is played. */}
              {track.length ? <span className="font-mono text-[12px] tabular-nums text-[var(--muted)]">{formatTime(track.length)}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
