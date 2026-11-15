import React, { useMemo } from 'react';
import { outline } from '../lib/waveform';

export interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  title?: string; // Optional context for ARIA labels
  /** The side's loudness along its length (see lib/waveform). With it the scrub bar is drawn as the sound. */
  wave?: number[] | null;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
}

export function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  isLoading,
  title,
  wave,
  onPlay,
  onPause,
  onSeek
}: PlayerControlsProps) {
  
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '0:00:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const shape = useMemo(() => (wave ? outline(wave) : null), [wave]);
  const played = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className={`flex gap-3 ${shape ? 'items-start' : 'items-center'}`}>
      {/* Play/Pause. The glyph starts at the button's left edge, which is the content's left edge: the title,
          the DJ and the side's name all start there. The tap area runs on to the right of it. */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        disabled={isLoading}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="player-play flex-shrink-0 w-11 h-11 flex items-center justify-start text-[var(--text)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]"
      >
        {isLoading ? (
          <svg className="w-8 h-8 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : isPlaying ? (
          // Both glyphs are drawn from the left edge of their box, so the edge doesn't move between them.
          <svg className="h-7 w-6" viewBox="0 0 12 14" fill="currentColor" aria-hidden>
            <path d="M0 0h4v14H0zM8 0h4v14H8z" />
          </svg>
        ) : (
          <svg className="h-7 w-6" viewBox="0 0 12 14" fill="currentColor" aria-hidden>
            <path d="M0 0v14l11-7z" />
          </svg>
        )}
      </button>

      {shape ? (
        // The bar is the side's sound, as wide as the player allows: the part played is bright, the rest dim.
        // The times sit under its two ends. Over the bar lies the same slider as before, unseen, so the mouse,
        // a finger, the keyboard and a screen reader all still work it.
        <div className="flex-1 min-w-0 font-mono text-[12px] tabular-nums text-[var(--muted)]">
          <div className="player-wave" style={{ '--played': `${played}%` } as React.CSSProperties}>
            <div className="player-wave-shape" style={{ maskImage: shape, WebkitMaskImage: shape }} />
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              disabled={isLoading || !duration}
              aria-label={`Seek audio${title ? `: ${title}` : ''}`}
            />
          </div>
          <div className="mt-1 flex justify-between">
            <span>{formatTime(currentTime)}</span>
            <span>{duration > 0 ? formatTime(duration) : '--:--:--'}</span>
          </div>
        </div>
      ) : (
        // No measured sound for this side: the plain line, with the times beside it.
        <div className="flex-1 flex items-center gap-3 min-w-0 font-mono text-[12px] tabular-nums text-[var(--muted)]">
          <span className="tabular-nums flex-shrink-0">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            disabled={isLoading || !duration}
            aria-label={`Seek audio${title ? `: ${title}` : ''}`}
            className="flex-1 h-[2px] bg-[var(--border)] appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[var(--text)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:rounded-none
              [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-[var(--text)] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-none"
          />
          <span className="tabular-nums flex-shrink-0">
            {duration > 0 ? formatTime(duration) : '--:--:--'}
          </span>
        </div>
      )}
    </div>
  );
}
