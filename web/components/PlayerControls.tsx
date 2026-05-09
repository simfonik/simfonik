import React from 'react';

export interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  title?: string; // Optional context for ARIA labels
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

  return (
    <div className="flex items-center gap-4">
      {/* Play/Pause Button — outline circle with line-system aesthetic */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        disabled={isLoading}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="flex-shrink-0 w-10 h-10 flex items-center justify-center border-[1.5px] border-[var(--text)] text-[var(--text)] hover:bg-[var(--text)] hover:text-[var(--bg)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors focus:outline-none"
      >
        {isLoading ? (
          <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : isPlaying ? (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Scrubber + time */}
      <div className="flex-1 flex items-center gap-3 min-w-0 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
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
    </div>
  );
}
