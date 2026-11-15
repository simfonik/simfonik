"use client";

// PROTOTYPE (SIM-43), round 3: "Today". The live page as it is, images included: the live gallery with its
// strip of thumbnails down the side and each picture at its own shape, and the live player. Only the split
// between the two columns is different. The live page gives the words 500px and the image the rest (about
// 700px); here the image column's width is `--image-column`, which the panel in harness.tsx sets.
import { AudioPlayer } from "../../../../components/AudioPlayer";
import { PlaceholderCassetteLive } from "../../../../components/PlaceholderCassetteLive";
import { PlaylistPlayer } from "../../../../components/PlaylistPlayer";
import { TapeGallery } from "../../../../components/TapeGallery";
import { Words, type TapeView } from "./shared";

function Player({ tape }: { tape: TapeView }) {
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

export function Today({ tape }: { tape: TapeView }) {
  const images = tape.placeholderLabel ? <PlaceholderCassetteLive tapeId={tape.id} labelDataUri={tape.placeholderLabel} /> : <TapeGallery allImages={tape.images} />;
  return (
    <>
      <div className="mb-12 lg:grid lg:grid-cols-[var(--image-column)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="hidden lg:block">{images}</div>
        <div data-proto-words>
          <Words tape={tape} />
          <div className="mt-8">
            <Player tape={tape} />
          </div>
        </div>
      </div>
      <div className="mb-12 lg:hidden">{images}</div>
    </>
  );
}
