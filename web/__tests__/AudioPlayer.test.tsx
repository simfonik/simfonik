// The one-side player's part in a tape page (components/AudioPlayer.tsx): a time pressed down the page takes
// the tape there. It is what a tape gets when only one of its sides can be played.
import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioPlayer } from '../components/AudioPlayer';
import { TapeTrackIdsProvider, useTapeTrackIds } from '../components/TapeTrackIds';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a time pressed in the tracklist, on a tape with one side that can be played', () => {
  it('takes the tape there on that side, and does nothing for a time on a side the player hasn’t got', () => {
    document.body.innerHTML = '';
    // The comments are never read here: the player's part doesn't wait on them.
    global.fetch = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const page = { now: null as unknown as ReturnType<typeof useTapeTrackIds> };
    function Deck() {
      page.now = useTapeTrackIds();
      return null;
    }
    render(
      <TapeTrackIdsProvider tapeId="tape-1" sides={[{ position: 'A' }, { position: 'B', silent: true }]}>
        <Deck />
        <AudioPlayer src="a.mp3" title="Side A" tapeId="tape-1" sidePosition="A" sideIndex={0} sideCount={2} />
      </TapeTrackIdsProvider>,
    );
    const audio = document.querySelector('audio') as HTMLAudioElement;
    // happy-dom plays nothing: the call is what is looked for.
    audio.play = vi.fn(() => Promise.resolve());

    act(() => page.now.goTo('B', 120));
    expect(audio.play).not.toHaveBeenCalled();
    expect(page.now.playhead()).toMatchObject({ side: 0, time: 0 });

    act(() => page.now.goTo('A', 120));
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(page.now.playhead()).toMatchObject({ side: 0, time: 120 });
  });
});
