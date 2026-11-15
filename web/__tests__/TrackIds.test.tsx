import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TrackIds } from '../components/TrackIds';
import type { TrackId } from '../lib/track-ids/compose';

const ids: TrackId[] = [
  { start: 0, end: 120, artist: 'Moby', title: 'Go', known: true, by: 'Rents' },
  { start: 300, end: 420, artist: '', title: '', known: false, by: 'Josh' },
];

describe('the track line under the player', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let posted: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    posted = vi.fn<() => void>();
    fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ success: true, message: 'Comment posted' }), { status: 200 })));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const body = (call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body);
  const artist = () => screen.getByRole('textbox', { name: 'Artist' });
  const title = () => screen.getByRole('textbox', { name: 'Title' });
  const yourName = () => screen.getByRole('textbox', { name: 'Your name' });

  it('says the track playing now, and asks where nobody has ID’d it', () => {
    const { rerender } = render(<TrackIds tapeId="tape-1" position="A" ids={ids} time={60} onPosted={posted} />);
    const line = screen.getByRole('button', { name: 'Now playing: Moby — Go. Correct this ID' });
    expect(line).toHaveAttribute('title', 'ID by Rents. Press to correct it.');

    rerender(<TrackIds tapeId="tape-1" position="A" ids={ids} time={200} onPosted={posted} />);
    expect(screen.getByRole('button', { name: 'Know this track? ID it' })).toBeInTheDocument();

    rerender(<TrackIds tapeId="tape-1" position="A" ids={ids} time={310} onPosted={posted} />);
    expect(screen.getByRole('button', { name: 'Unknown track. Know it? ID it' })).toBeInTheDocument();
  });

  it('turns into two fields, asks a first-time visitor’s name as a second step, and posts a comment carrying the side and the moment it was opened', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TrackIds tapeId="tape-1" position="B" ids={ids} time={754.6} onPosted={posted} />);

    await user.click(screen.getByRole('button', { name: 'Know this track? ID it' }));
    expect(artist()).toHaveFocus();
    // The tape plays on; the fields stay on the moment they were opened for.
    rerender(<TrackIds tapeId="tape-1" position="B" ids={ids} time={790} onPosted={posted} />);

    await user.type(artist(), '808 State');
    await user.type(title(), 'Cubik{Enter}');

    // Nothing is posted yet: the line now asks who is saying so.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(yourName()).toHaveFocus();
    await user.type(yourName(), 'Tester{Enter}');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/comments/submit');
    expect(body()).toEqual({ tapeId: 'tape-1', authorName: 'Tester', authorEmail: '', content: '[B 12:34] 808 State - Cubik', website: '' });
    expect(posted).toHaveBeenCalledTimes(1);

    // The fields have gone, the line has the keyboard again, and the thanks is said.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Know this track? ID it' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Posted. Thanks.');

    // Next time the name is remembered: two fields and one Enter.
    await user.click(screen.getByRole('button', { name: 'Know this track? ID it' }));
    await user.type(title(), 'Pacific State{Enter}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body(1)).toMatchObject({ authorName: 'Tester', content: '[B 13:10] ? - Pacific State' });
  });

  it('puts a known ID right from what it says, at the time that track starts, with no side on a tape that is one recording', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('simfonik:id-name', 'Tester');
    render(<TrackIds tapeId="tape-1" position={null} ids={ids} time={95} onPosted={posted} />);

    await user.click(screen.getByRole('button', { name: /Correct this ID/ }));
    expect(artist()).toHaveValue('Moby');
    expect(title()).toHaveValue('Go');
    await user.type(title(), ' (Woodtick Mix){Enter}');

    expect(body().content).toBe('[0:00] Moby - Go (Woodtick Mix)');
  });

  it('IDs a track marked unknown from where that track starts, not from the moment the visitor spoke up', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('simfonik:id-name', 'Dana');
    // The unknown runs from 5:00 to 7:00, and the tape is 50 seconds into it.
    render(<TrackIds tapeId="tape-1" position="A" ids={ids} time={350} onPosted={posted} />);
    await user.click(screen.getByRole('button', { name: 'Unknown track. Know it? ID it' }));
    expect(screen.getByRole('form', { name: 'ID the track at A 0:05:00' })).toBeInTheDocument();
    await user.type(artist(), 'Orbital');
    await user.type(title(), 'Chime{Enter}');
    expect(body().content).toBe('[A 5:00] Orbital - Chime');
  });

  describe('with a list of the side’s tracks that has no times', () => {
    const order = {
      by: 'Josh',
      tracks: [
        { n: 1, artist: 'Orbital', title: 'Chime', known: true },
        { n: 2, artist: 'Joey Beltram', title: 'Energy Flash', known: true },
        { n: 3, artist: 'Altern 8', title: 'Infiltrate 202', known: true },
        { n: 4, artist: 'The Prodigy', title: 'Charly', known: true },
      ],
    };

    it('offers the two likeliest names, and writes the one pressed into the blanks', async () => {
      const user = userEvent.setup();
      window.localStorage.setItem('simfonik:id-name', 'Dana');
      // Nothing is marked at 3:20 on a side of 16 minutes: the first quarter is over, so the second track.
      render(<TrackIds tapeId="tape-1" position="A" ids={[]} time={200} order={order} length={960} onPosted={posted} />);
      await user.click(screen.getByRole('button', { name: 'Know this track? ID it' }));
      expect(screen.getByText(/From Josh’s list/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Orbital — Chime' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Altern 8 — Infiltrate 202' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Joey Beltram — Energy Flash' }));
      expect(artist()).toHaveValue('Joey Beltram');
      expect(title()).toHaveValue('Energy Flash');
      await user.type(title(), '{Enter}');
      expect(body().content).toBe('[A 3:20] Joey Beltram - Energy Flash');
    });

    it('offers none for an ID being put right', async () => {
      const user = userEvent.setup();
      render(<TrackIds tapeId="tape-1" position="A" ids={ids} time={60} order={order} length={960} onPosted={posted} />);
      await user.click(screen.getByRole('button', { name: /Correct this ID/ }));
      expect(screen.queryByText(/From Josh’s list/)).not.toBeInTheDocument();
    });
  });

  describe('on a phone', () => {
    beforeEach(() => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: query === '(max-width: 39.99rem)', media: query }) as MediaQueryList);
      // The test's DOM has no animations to wait for.
      Element.prototype.getAnimations = () => [];
    });

    it('takes the ID in a sheet over the page, asks a first-time visitor’s name in the same sheet, and posts', async () => {
      const user = userEvent.setup();
      render(<TrackIds tapeId="tape-1" position="A" ids={ids} time={200} onPosted={posted} />);
      await user.click(screen.getByRole('button', { name: 'Know this track? ID it' }));

      const sheet = screen.getByRole('dialog', { name: 'ID the track at A 0:03:20' });
      expect((sheet as HTMLDialogElement).open).toBe(true);
      // The line stays where it was, under the sheet.
      expect(screen.getByText('Know this track?', { exact: false })).toBeInTheDocument();
      expect(artist()).toHaveFocus();

      await user.type(artist(), 'Orbital{Enter}');
      // The keyboard's Next key goes on to the next blank and posts nothing.
      expect(fetchMock).not.toHaveBeenCalled();
      expect(title()).toHaveFocus();
      await user.type(title(), 'Chime{Enter}');
      expect(yourName()).toHaveFocus();
      await user.type(yourName(), 'Dana{Enter}');

      expect(body()).toMatchObject({ authorName: 'Dana', content: '[A 3:20] Orbital - Chime' });
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(posted).toHaveBeenCalledTimes(1);
    });

    it('says who a returning visitor is posting as, and lets them change it', async () => {
      const user = userEvent.setup();
      window.localStorage.setItem('simfonik:id-name', 'Dana');
      render(<TrackIds tapeId="tape-1" position="A" ids={ids} time={200} onPosted={posted} />);
      await user.click(screen.getByRole('button', { name: 'Know this track? ID it' }));
      expect(screen.getByText('Dana')).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Your name' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Change' }));
      expect(yourName()).toHaveValue('Dana');
      expect(yourName()).toHaveFocus();
    });

    it('goes away when it is cancelled, and the keyboard is back on the line', async () => {
      const user = userEvent.setup();
      render(<TrackIds tapeId="tape-1" position="A" ids={ids} time={200} onPosted={posted} />);
      await user.click(screen.getByRole('button', { name: 'Know this track? ID it' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Know this track? ID it' })).toHaveFocus();
    });
  });

  it('asks for what is missing on its own line, drops the complaint once it is being put right, and shuts on Escape', async () => {
    const user = userEvent.setup();
    render(<TrackIds tapeId="tape-1" position="A" ids={ids} time={200} onPosted={posted} />);

    await user.click(screen.getByRole('button', { name: 'Know this track? ID it' }));
    await user.click(screen.getByRole('button', { name: /post/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the artist or the title.');
    expect(artist()).toHaveFocus();

    await user.type(artist(), 'Moby');
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your name.');
    expect(yourName()).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Know this track? ID it' })).toHaveFocus();
  });

  it('says what the server said when it refuses, and keeps what was typed', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('simfonik:id-name', 'Tester');
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), { status: 429 })));
    render(<TrackIds tapeId="tape-1" position="A" ids={ids} time={200} onPosted={posted} />);

    await user.click(screen.getByRole('button', { name: 'Know this track? ID it' }));
    await user.type(artist(), 'Moby{Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent('Too many requests. Please try again later.');
    expect(artist()).toHaveValue('Moby');
    expect(artist()).toHaveFocus();
    expect(posted).not.toHaveBeenCalled();
  });
});
