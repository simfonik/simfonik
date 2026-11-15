"use client";

// PROTOTYPE (SIM-43), direction 3: "Sides". The whole tape is on the page at once: every side has its own
// waveform, one under the other, and there is no list of sides to switch between. Pressing any bar plays
// that side from there. The track line sits under the side that is loaded; the others say how far their IDs
// have got.
import { useEffect, useRef } from "react";
import { PlayerControls, formatTime } from "../../../../components/PlayerControls";
import { TrackIds } from "../../../../components/TrackIds";
import { Pictures, Words, failed, useTapePlayer, type TapeView } from "./shared";

export function Sides({ tape }: { tape: TapeView }) {
  const player = useTapePlayer(tape);
  const { current, state, controls, goTo } = player;
  // A press on another side's bar says where to go and then says "play": the first is enough.
  const asked = useRef<number | null>(null);
  useEffect(() => {
    asked.current = null;
  }, [current]);

  if (state.error) return failed(state.error);
  const started = state.isPlaying || state.isLoading || state.currentTime > 0;

  return (
    <>
      <div className="mb-8 lg:mb-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)] lg:gap-10">
        <Words tape={tape} big />
        <div className="hidden lg:block">
          <Pictures tape={tape} />
        </div>
      </div>

      <div className="proto-wide mb-12 space-y-6">
        {player.audio}
        {tape.tracks.map((track, i) => {
          const on = i === current;
          const ids = player.ids[track.index] ?? [];
          const known = ids.filter((id) => id.known).length;
          const length = on && state.duration > 0 ? state.duration : track.length;
          return (
            <section key={track.position} aria-label={track.title}>
              <div className="mb-1 flex items-baseline justify-between gap-4 pl-14">
                {tape.unlabelled ? (
                  <span />
                ) : (
                  <h2 className={`min-w-0 font-display text-xl leading-tight text-balance ${on ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>
                    {track.title}
                    {track.djs && track.djs.length > 0 && (
                      <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">{track.djs.map((dj) => dj.name).join(", ")}</span>
                    )}
                  </h2>
                )}
                <span className="flex-none font-mono text-[12px] tabular-nums text-[var(--muted)]">
                  {on && started && (
                    <>
                      <span className="text-[var(--text)]">{formatTime(state.currentTime)}</span> /{" "}
                    </>
                  )}
                  {length ? formatTime(length) : null}
                </span>
              </div>
              <PlayerControls
                isPlaying={on && state.isPlaying}
                currentTime={on ? state.currentTime : 0}
                duration={on ? state.duration : 0}
                isLoading={on && state.isLoading}
                title={track.title}
                wave={track.wave}
                length={track.length}
                showTimes={false}
                ids={ids}
                onPlay={() => {
                  if (on) controls.play();
                  else if (asked.current !== i) goTo(i, 0);
                }}
                onPause={controls.pause}
                onSeek={(time) => {
                  if (on) return controls.seek(time);
                  asked.current = i;
                  goTo(i, time);
                }}
              >
                {on ? (
                  <TrackIds tapeId={tape.id} position={tape.sideCount > 1 ? track.position : null} ids={ids} time={state.currentTime} onPosted={player.refresh} />
                ) : (
                  // The same height as the track line, so nothing moves when another side takes it over.
                  <p className="mt-2 flex min-h-11 items-center font-mono text-[12px] text-[var(--muted)]">
                    {ids.length === 0 ? "No tracks ID’d yet" : `${known} of ${ids.length} marked tracks ID’d`}
                  </p>
                )}
              </PlayerControls>
            </section>
          );
        })}
      </div>

      <div className="mb-12 lg:hidden">
        <Pictures tape={tape} />
      </div>
    </>
  );
}
