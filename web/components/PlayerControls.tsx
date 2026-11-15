import React, { ReactNode, useMemo, useRef } from 'react';
import { idAt, idLabel, type TrackId } from '../lib/track-ids/compose';
import { outline } from '../lib/waveform';

export interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  title?: string; // Optional context for ARIA labels
  /** The side's loudness along its length (see lib/waveform). With it the scrub bar is drawn as the sound. */
  wave?: number[] | null;
  /** The side's length in seconds, known ahead of time, for before the audio has said so itself. */
  length?: number | null;
  /** The time played and the side's length, under the bar's two ends. Off where a list of sides says them. */
  showTimes?: boolean;
  /** The track IDs the comments give for this side, in order of time. Each is marked on the bar. */
  ids?: TrackId[];
  /** Whatever goes under the bar, in line with it. */
  children?: ReactNode;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
}

/** A time on a side, always h:mm:ss. */
export const formatTime = (seconds: number): string => {
  if (!isFinite(seconds)) return '0:00:00';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  isLoading,
  title,
  wave,
  length,
  showTimes = true,
  ids,
  children,
  onPlay,
  onPause,
  onSeek
}: PlayerControlsProps) {

  const shape = useMemo(() => (wave ? outline(wave) : null), [wave]);
  // The side's length: what the audio says once it has loaded, and before that what was read ahead of time.
  const whole = duration > 0 ? duration : length ?? 0;
  const played = whole > 0 ? Math.min(100, (currentTime / whole) * 100) : 0;
  const playing = ids ? idAt(ids, currentTime) : null;
  /** Nothing has been asked of the audio yet, so the first press on the bar is also what starts the tape. */
  const unstarted = !duration && !isPlaying && !isLoading;

  /** The time at a place across the bar, or null while the side's length isn't known. */
  const timeAt = (x: number, bar: DOMRect) =>
    whole > 0 ? Math.max(0, Math.min(1, (x - bar.left) / bar.width)) * whole : null;

  // A press on the bar goes to that place, and before the tape has been started it starts it too. A phone
  // lets audio start only from inside a finished tap or click, so that is where this is called from: not
  // from the slider's own change, which comes as the finger lands, and not from the end of a drag, which an
  // iPhone doesn't count as a tap. A drag only chooses the place; play starts the tape from it.
  const pressAt = (x: number, bar: DOMRect) => {
    const time = timeAt(x, bar);
    if (time !== null) onSeek(time);
    if (unstarted) onPlay();
  };

  // A finger on the bar is followed here, not by the slider underneath. An iPhone's slider only follows a
  // drag that starts on its handle, which on this bar can't be seen; and a slider that did follow would give
  // a second, slightly different answer. So while a finger is down, and for a moment after it lifts (when a
  // phone sends its imitation of a mouse click), what the slider reports is left alone.
  const press = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const lifted = useRef(0);
  const fingerJustHere = () => press.current !== null || performance.now() - lifted.current < 700;

  // A line on the bar with a time over it, written straight to the element: a pointer moves far more often
  // than the page needs to re-render. Under a mouse it is where a click would land. Under a finger dragging
  // the bar it is where the tape is being taken, said beside the finger because the times may be rows away.
  const ghost = useRef<HTMLDivElement>(null);
  const point = (x: number, bar: DOMRect) => {
    const el = ghost.current;
    if (!el) return;
    const at = Math.max(0, Math.min(bar.width, x - bar.left));
    el.style.setProperty('--at', `${at}px`);
    // The time there and, where the comments have ID'd it, the track playing there.
    const time = timeAt(x, bar);
    const id = time !== null && ids ? idAt(ids, time) : null;
    const label = el.firstElementChild as HTMLElement;
    label.textContent = time === null ? '' : `${formatTime(time)}${id ? ` · ${idLabel(id)}` : ''}`;
    // The label stays inside the bar's ends, however long the name makes it.
    const half = label.offsetWidth / 2;
    el.style.setProperty('--label', `${Math.max(half, Math.min(bar.width - half, at))}px`);
  };
  const preview = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    point(e.clientX, e.currentTarget.getBoundingClientRect());
    ghost.current?.setAttribute('data-on', '');
  };
  const endTouch = () => {
    press.current = null;
    lifted.current = performance.now();
    ghost.current?.removeAttribute('data-drag');
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
          way the part played is bright and the rest dim, and over it lies an ordinary slider, unseen, so the
          mouse, a finger, the keyboard and a screen reader all work it. */}
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
          {/* Where each ID'd track starts: a cut through the bar. One at the very start would cut nothing. */}
          {whole > 0 &&
            ids?.map((id) =>
              id.start > 0 && id.start < whole ? (
                <span key={id.start} className="player-wave-mark" style={{ left: `${(id.start / whole) * 100}%` }} />
              ) : null,
            )}
          <div ref={ghost} className="player-wave-ghost" aria-hidden>
            <span />
          </div>
          <input
            type="range"
            min="0"
            max={whole || 1}
            step="1"
            value={whole ? currentTime : 0}
            onChange={(e) => {
              if (whole && !fingerJustHere()) onSeek(parseFloat(e.target.value));
            }}
            onTouchStart={(e) => {
              press.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dragging: false };
            }}
            onTouchMove={(e) => {
              const from = press.current;
              const to = e.touches[0];
              if (!from || !to) return;
              if (!from.dragging) {
                // A finger that has set off along the bar is dragging it. One going up or down is scrolling
                // the page past it.
                const across = Math.abs(to.clientX - from.x);
                if (across <= 6 || across <= Math.abs(to.clientY - from.y)) return;
                from.dragging = true;
              }
              const bar = e.currentTarget.getBoundingClientRect();
              const time = timeAt(to.clientX, bar);
              if (time === null) return;
              onSeek(time);
              point(to.clientX, bar);
              ghost.current?.setAttribute('data-drag', '');
            }}
            onTouchCancel={endTouch}
            onTouchEnd={(e) => {
              const from = press.current;
              const to = e.changedTouches[0];
              endTouch();
              // The end of a drag has nothing left to do, and a finger that wandered wasn't pressing the bar.
              if (!from || !to || from.dragging) return;
              if (Math.hypot(to.clientX - from.x, to.clientY - from.y) > 10) return;
              pressAt(to.clientX, e.currentTarget.getBoundingClientRect());
            }}
            // With a mouse the slider has already gone to the place; what is left is starting the tape.
            onClick={(e) => {
              if (unstarted && !fingerJustHere()) pressAt(e.clientX, e.currentTarget.getBoundingClientRect());
            }}
            onKeyUp={(e) => {
              if (unstarted && currentTime > 0 && /^(Arrow|Page|Home|End)/.test(e.key)) onPlay();
            }}
            aria-label={`Seek audio${title ? `: ${title}` : ''}`}
            aria-valuetext={whole ? `${formatTime(currentTime)} of ${formatTime(whole)}${playing ? `, ${idLabel(playing)}` : ''}` : 'Not loaded yet'}
          />
        </div>
        {showTimes && (
          <div className="mt-1 flex justify-between">
            <span>{formatTime(currentTime)}</span>
            <span>{whole > 0 ? formatTime(whole) : '--:--:--'}</span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
