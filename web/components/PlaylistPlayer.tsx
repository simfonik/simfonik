'use client';

import { useState, useCallback } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { PlayerControls } from './PlayerControls';

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

      {/*
        Detection-only audio elements for the non-active sides. Brave's Playlist
        feature enumerates the page's <audio> elements one by one; because the
        controlled player above swaps a single element's src, Brave could only
        ever see (and save) the currently-selected side. Exposing each side as
        its own element lets Brave save every side individually. These are inert:
        no `controls` (invisible), `preload="none"` (fetch nothing — no impact on
        Safari/Chrome), and never driven by the player hook.
      */}
      {tracks.map((track, index) =>
        index === currentTrackIndex ? null : (
          <audio
            key={track.position}
            src={track.url}
            preload="none"
            playsInline
            aria-hidden="true"
            tabIndex={-1}
          />
        )
      )}

      <PlayerControls
        isPlaying={state.isPlaying}
        currentTime={state.currentTime}
        duration={state.duration}
        isLoading={state.isLoading}
        title={currentTrack.title}
        onPlay={controls.play}
        onPause={controls.pause}
        onSeek={controls.seek}
      />

      {/* Track List */}
      <div className="border-t-[1.5px] border-[var(--border)] pt-3">
        <div className="space-y-0">
          {tracks.map((track, index) => {
            const isCurrent = index === currentTrackIndex;
            return (
              <button
                key={track.position}
                onClick={() => selectTrack(index)}
                className={`w-full text-left px-3 py-2.5 transition-colors cursor-pointer focus:outline-none flex items-center gap-3 text-[var(--text)] ${
                  isCurrent ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'
                }`}
              >
                <span className="flex-shrink-0 text-[var(--text)]">
                  {isCurrent && state.isPlaying ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg
                      className={`w-3.5 h-3.5 ${isCurrent ? '' : 'text-[var(--muted)]'}`}
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-display text-base leading-tight">
                    {track.title}
                  </span>
                  {track.djs && track.djs.length > 0 && (
                    <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mt-0.5">
                      {track.djs.map((dj) => dj.name).join(', ')}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
