import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  // The audio isn't fetched until it is played, so before that its length isn't known. A press on the bar
  // then starts the tape, and the place pressed (a share of the bar, 0 to 1) is gone to once the length is in.
  const [wanted, setWanted] = useState<number | null>(null);
  useEffect(() => {
    if (wanted === null || !(duration > 0)) return;
    onSeek(wanted * duration);
    setWanted(null);
  }, [wanted, duration, onSeek]);
  // A phone lets audio start only from inside a finished tap, click or key press. The slider reports its new
  // value the moment a finger lands, which is too early: started from there, an iPhone refuses to play. So
  // before the audio has loaded, the tape is started when the press ends, at the place pressed.
  const press = useRef<{ x: number; y: number } | null>(null);
  const startAt = (x: number, bar: DOMRect) => {
    if (duration || isPlaying || isLoading) return;
    setWanted(wanted ?? Math.max(0, Math.min(1, (x - bar.left) / bar.width)));
    onPlay();
  };
  const played = wanted !== null ? wanted * 100 : duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  // Under a mouse: a line where a click would land and, once the side's length is known, the time there.
  // Written straight to the element; a pointer moves far more often than the page needs to re-render.
  const ghost = useRef<HTMLDivElement>(null);
  const preview = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ghost.current;
    if (!el || e.pointerType !== 'mouse') return;
    const bar = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(bar.width, e.clientX - bar.left));
    el.style.setProperty('--at', `${x}px`);
    // The label stays inside the bar's ends.
    el.style.setProperty('--label', `${Math.max(30, Math.min(bar.width - 30, x))}px`);
    el.firstElementChild!.textContent = duration > 0 ? formatTime((x / bar.width) * duration) : '';
    el.setAttribute('data-on', '');
  };

  return (
    <div className="flex items-start gap-3">
      {/* Play/Pause. The glyph starts at the button's left edge, which is the content's left edge: the title,
          the DJ and the side's name all start there. The tap area runs on to the right of it. */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        disabled={isLoading}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="player-play flex-shrink-0 w-11 h-11 flex items-center justify-start text-[var(--text)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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

      {/* The bar. With the side's sound measured it is drawn as that sound; without, as a plain line. Either
          way the part played is bright and the rest dim, the times sit under its two ends, and over it lies
          an ordinary slider, unseen, so the mouse, a finger, the keyboard and a screen reader all work it. */}
      <div className="flex-1 min-w-0 font-mono text-[12px] tabular-nums text-[var(--muted)]">
        <div
          className="player-wave"
          style={{ '--played': `${played}%` } as React.CSSProperties}
          onPointerMove={preview}
          onPointerLeave={() => ghost.current?.removeAttribute('data-on')}
        >
          {shape ? (
            <div className="player-wave-shape" style={{ maskImage: shape, WebkitMaskImage: shape }} />
          ) : (
            <div className="player-wave-shape" data-flat="" />
          )}
          {/* Where a click would land, and what time that is, under a mouse. */}
          <div ref={ghost} className="player-wave-ghost" aria-hidden>
            <span />
          </div>
          <input
            type="range"
            min="0"
            max={duration || 1}
            step={duration ? 1 : 0.001}
            value={duration ? currentTime : wanted ?? 0}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (duration) return onSeek(value);
              setWanted(value);
            }}
            onTouchStart={(e) => {
              press.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }}
            onTouchEnd={(e) => {
              const from = press.current;
              const to = e.changedTouches[0];
              press.current = null;
              if (!from || !to) return;
              // A finger that travelled up or down was scrolling the page past the bar, not pressing it.
              const across = Math.abs(to.clientX - from.x);
              const down = Math.abs(to.clientY - from.y);
              if (down > 10 && down > across) return setWanted(null);
              startAt(to.clientX, e.currentTarget.getBoundingClientRect());
            }}
            onClick={(e) => startAt(e.clientX, e.currentTarget.getBoundingClientRect())}
            onKeyUp={() => {
              if (wanted !== null && !duration && !isPlaying && !isLoading) onPlay();
            }}
            aria-label={`Seek audio${title ? `: ${title}` : ''}`}
            aria-valuetext={duration ? `${formatTime(currentTime)} of ${formatTime(duration)}` : 'Not loaded yet'}
          />
        </div>
        <div className="mt-1 flex justify-between">
          <span>{formatTime(currentTime)}</span>
          <span>{duration > 0 ? formatTime(duration) : '--:--:--'}</span>
        </div>
      </div>
    </div>
  );
}
