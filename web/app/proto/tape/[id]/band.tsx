"use client";

// PROTOTYPE (SIM-43), direction 2: "Band". The player leads. The words sit on the left, on the page's left
// edge with everything under them, the images on the right and smaller; the waveform then runs the full
// width of the page, with the track line and the sides beneath it.
import { Player } from "./column";
import { Pictures, Words, type TapeView } from "./shared";

export function Band({ tape }: { tape: TapeView }) {
  return (
    <>
      <div className="mb-8 lg:mb-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)] lg:gap-10">
        <Words tape={tape} big />
        <div className="hidden lg:block">
          <Pictures tape={tape} />
        </div>
      </div>
      <div className="proto-wide mb-12">
        <Player tape={tape} />
      </div>
      <div className="mb-12 lg:hidden">
        <Pictures tape={tape} />
      </div>
    </>
  );
}
