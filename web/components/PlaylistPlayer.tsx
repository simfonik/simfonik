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
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200 text-sm">{state.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Player */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-2.5">
        <audio
          ref={ref}
          src={currentTrack.url}
          preload="metadata"
          playsInline
        />

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
      </div>

      {/* Track List */}
      <div>
        <div className="space-y-0.5">
          {tracks.map((track, index) => (
            <button
              key={track.position}
              onClick={() => selectTrack(index)}
              className={`w-full text-left px-3 py-3 rounded transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 ${
                index === currentTrackIndex
                  ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                  : 'hover:bg-[var(--bg-secondary)] text-[var(--text)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {index === currentTrackIndex && state.isPlaying ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-sm">
                  <div>{track.title}</div>
                  {track.djs && track.djs.length > 0 && (
                    <div className="text-xs opacity-60 mt-0.5">
                      {track.djs.map(dj => dj.name).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
