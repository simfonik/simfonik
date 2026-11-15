"use client";

// PROTOTYPE (SIM-43), direction 4: "Sheet". The IDs are the body of the page. Under one full-width bar the
// loaded side's tracks are written out as a running order, like liner notes: the time, the track, who said
// so. The one playing is marked, any row can be pressed to hear it, and the unknown ones ask. The sides are
// tabs over the bar.
import { PlayerControls, formatTime } from "../../../../components/PlayerControls";
import { TrackIds } from "../../../../components/TrackIds";
import { clock, idAt, idLabel } from "../../../../lib/track-ids/compose";
import { Cover, Words, failed, useTapePlayer, type TapeView } from "./shared";

export function Sheet({ tape }: { tape: TapeView }) {
  const player = useTapePlayer(tape);
  const { current, track, state, controls, goTo } = player;
  if (state.error) return failed(state.error);
  const ids = player.ids[track.index] ?? [];
  const playing = idAt(ids, state.currentTime);

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
        {tape.tracks.length > 1 && (
          // Up to four across, in even columns, so eight sides make two tidy rows and not a ragged wrap.
          <div className="mb-3 grid grid-cols-2 gap-x-8 pl-14 lg:grid-cols-[repeat(var(--across),minmax(0,1fr))]" style={{ "--across": Math.min(tape.tracks.length, 4) } as React.CSSProperties}>
            {tape.tracks.map((t, i) => (
              <button key={t.position} type="button" onClick={() => i !== current && goTo(i, 0)} aria-pressed={i === current} className="proto-tab">
                <span className="min-w-0 font-display text-xl leading-tight text-balance">{t.title}</span>
                {t.length ? <span className="flex-none font-mono text-[12px] tabular-nums text-[var(--muted)]">{formatTime(t.length)}</span> : null}
              </button>
            ))}
          </div>
        )}
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
        </PlayerControls>

        <div className="mt-6 pl-14">
          <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Running order, from the comments</h2>
          {ids.length === 0 ? (
            <p className="border-t border-[var(--border)] py-3 font-mono text-[12px] text-[var(--muted)]">Nobody has ID’d a track on this side yet.</p>
          ) : (
            <ol className="border-t border-[var(--border)] lg:columns-2 lg:gap-10">
              {ids.map((id) => (
                <li key={id.start} className="break-inside-avoid">
                  <button type="button" onClick={() => goTo(current, id.start)} aria-current={id === playing ? "true" : undefined} className="proto-row">
                    <span className="font-mono text-[12px] tabular-nums text-[var(--muted)]">{clock(id.start)}</span>
                    <span className={`min-w-0 truncate font-mono text-[13px] ${id.known ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>{idLabel(id)}</span>
                    <span className={`font-mono text-[10px] uppercase tracking-[0.22em] ${id.known ? "text-[var(--muted)]" : "text-[var(--text)]"}`}>{id.known ? id.by : "ID it"}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="mb-12 lg:hidden">
        <Cover tape={tape} />
      </div>
    </>
  );
}
