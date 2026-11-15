"use client";

// PROTOTYPE (SIM-43), round 2: "Contents". Band's weak spot is its top: the cover floats on the right over an
// empty lower left, and the sides then run the full width under the bar with their names and lengths a
// thousand pixels apart. Here the sides move up into the left column, under the tape's details and beside
// the cover, like a list of contents. The bar closes the block, with nothing under it but the track line.
import { PlayerControls, formatTime } from "../../../../components/PlayerControls";
import { TrackIds } from "../../../../components/TrackIds";
import { Cover, Words, failed, useTapePlayer, type TapeView } from "./shared";

export function Contents({ tape }: { tape: TapeView }) {
  const player = useTapePlayer(tape);
  const { current, track, state, controls, goTo } = player;
  if (state.error) return failed(state.error);
  const ids = player.ids[track.index] ?? [];
  const started = state.isPlaying || state.isLoading || state.currentTime > 0;
  const listed = tape.tracks.length > 1;

  return (
    <>
      <div className={`mb-8 lg:mb-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)] lg:gap-10 ${listed ? "lg:items-start" : ""}`}>
        <div>
          {/* One recording has no list to share the column with, so its words are spread over the cover's height. */}
          <Words tape={tape} big spread={!listed} />
          {listed && (
            // Past four sides the list runs in two columns, so a set of eight is four rows tall and not eight.
            <div className={`mt-8 border-t border-[var(--border)] ${tape.tracks.length > 4 ? "lg:columns-2 lg:gap-10" : ""}`}>
              {tape.tracks.map((t, i) => {
                const on = i === current;
                const length = on && state.duration > 0 ? state.duration : t.length;
                return (
                  <button
                    key={t.position}
                    type="button"
                    onClick={() => (on ? (state.isPlaying ? controls.pause() : controls.play()) : goTo(i, 0))}
                    aria-current={on ? "true" : undefined}
                    className={`player-side grid w-full break-inside-avoid grid-cols-[2.75rem_1fr_auto] items-center gap-x-3 border-b border-[var(--border)] py-2.5 text-left cursor-pointer ${on ? "text-[var(--text)]" : "text-[var(--muted)]"}`}
                  >
                    <svg className="h-3.5 w-3" viewBox="0 0 12 14" fill="currentColor" aria-hidden>
                      {on && state.isPlaying ? <path d="M0 0h4v14H0zM8 0h4v14H8z" /> : <path d="M0 0v14l11-7z" />}
                    </svg>
                    <span className="min-w-0 text-balance">
                      <span className="font-display text-base leading-tight">{t.title}</span>
                      {t.djs && t.djs.length > 0 && <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">{t.djs.map((dj) => dj.name).join(", ")}</span>}
                    </span>
                    <span className="font-mono text-[12px] tabular-nums text-[var(--muted)]">
                      {on && started && (
                        <span aria-hidden>
                          <span className="text-[var(--text)]">{formatTime(state.currentTime)}</span> /{" "}
                        </span>
                      )}
                      {length ? formatTime(length) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="hidden lg:block">
          <Cover tape={tape} />
        </div>
      </div>

      <div className="proto-wide mb-12">
        {player.audio}
        <PlayerControls
          isPlaying={state.isPlaying}
          currentTime={state.currentTime}
          duration={state.duration}
          isLoading={state.isLoading}
          title={track.title}
          wave={track.wave}
          length={track.length}
          showTimes={!listed}
          ids={ids}
          onPlay={controls.play}
          onPause={controls.pause}
          onSeek={controls.seek}
        >
          <TrackIds key={track.position} tapeId={tape.id} position={tape.sideCount > 1 ? track.position : null} ids={ids} time={state.currentTime} onPosted={player.refresh} />
        </PlayerControls>
      </div>

      <div className="mb-12 lg:hidden">
        <Cover tape={tape} />
      </div>
    </>
  );
}
