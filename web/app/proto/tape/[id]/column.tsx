"use client";

// PROTOTYPE (SIM-43), direction 1: "Column". The page as it is today, unchanged: the images lead, large on
// the left, and everything else sits in a 500px column on the right. The measure for the others.
import { AudioPlayer } from "../../../../components/AudioPlayer";
import { PlaylistPlayer } from "../../../../components/PlaylistPlayer";
import { Pictures, Words, type TapeView } from "./shared";

export function Player({ tape }: { tape: TapeView }) {
  if (tape.tracks.length >= 2) return <PlaylistPlayer tracks={tape.tracks} tapeId={tape.id} sideCount={tape.sideCount} />;
  const track = tape.tracks[0];
  if (!track) return null;
  return (
    <div>
      {!tape.unlabelled && <h2 className="font-display text-xl leading-tight text-[var(--text)] mb-2">{track.title}</h2>}
      <AudioPlayer src={track.url} title={tape.unlabelled ? undefined : track.title} tapeId={tape.id} sidePosition={track.position} sideIndex={track.index} sideCount={tape.sideCount} wave={track.wave} length={track.length} />
    </div>
  );
}

export function Column({ tape }: { tape: TapeView }) {
  return (
    <>
      <div className="mb-8 lg:hidden">
        <Words tape={tape} />
      </div>
      <div className="mb-12 grid lg:grid-cols-[1fr_500px] gap-8 items-start">
        <div className="hidden lg:block">
          <Pictures tape={tape} />
        </div>
        <div>
          <div className="mb-8 hidden lg:block">
            <Words tape={tape} />
          </div>
          <Player tape={tape} />
        </div>
      </div>
      <div className="mb-12 lg:hidden">
        <Pictures tape={tape} />
      </div>
    </>
  );
}
