"use client";

// PROTOTYPE (SIM-43), round 2: "Spare". Band with as little as it can carry. No list of sides and no rules:
// the sides are one quiet line of names under the bar, the loaded one in full colour, and the times sit at
// the bar's two ends. For a tape with two sides that line is two words.
import { PlayerControls, formatTime } from "../../../../components/PlayerControls";
import { TrackIds } from "../../../../components/TrackIds";
import { Cover, Words, failed, useTapePlayer, type TapeView } from "./shared";

export function Spare({ tape }: { tape: TapeView }) {
  const player = useTapePlayer(tape);
  const { current, track, state, controls, goTo } = player;
  if (state.error) return failed(state.error);
  const ids = player.ids[track.index] ?? [];

  return (
    <>
      <div className="mb-8 lg:mb-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)] lg:items-start lg:gap-10">
        <Words tape={tape} big />
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
          ids={ids}
          onPlay={controls.play}
          onPause={controls.pause}
          onSeek={controls.seek}
        >
          <TrackIds key={track.position} tapeId={tape.id} position={tape.sideCount > 1 ? track.position : null} ids={ids} time={state.currentTime} onPosted={player.refresh} />
          {tape.tracks.length > 1 && (
            <div className="mt-3 flex flex-wrap items-baseline gap-x-7 gap-y-4">
              {tape.tracks.map((t, i) => (
                <button key={t.position} type="button" onClick={() => i !== current && goTo(i, 0)} aria-pressed={i === current} className="proto-side-link">
                  {t.title}
                  {t.length ? <span className="ml-2 tabular-nums tracking-normal opacity-70">{formatTime(t.length)}</span> : null}
                </button>
              ))}
            </div>
          )}
        </PlayerControls>
      </div>

      <div className="mb-12 lg:hidden">
        <Cover tape={tape} />
      </div>
    </>
  );
}
