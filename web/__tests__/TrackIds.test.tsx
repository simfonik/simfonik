import React, { useEffect } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TapeTrackIdsProvider, useSideIds, useTapeTrackIds } from '../components/TapeTrackIds';
import { TrackIds } from '../components/TrackIds';
import type { TrackId } from '../lib/track-ids/compose';

const ids: TrackId[] = [
  { start: 0, end: 120, artist: 'Moby', title: 'Go', known: true, by: 'Rents' },
  { start: 300, end: 420, artist: '', title: '', known: false, by: 'Josh' },
];

describe('the track line under the player', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let posted: ReturnType<typeof vi.fn<() => void>>;
  const toggled = vi.fn<() => void>();

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
    const { rerender } = render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={60} onPosted={posted} />);
    const line = screen.getByRole('button', { name: 'Now playing: Moby — Go. Correct this ID' });
    expect(line).toHaveAttribute('title', 'ID by Rents. Press to correct it.');

    rerender(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={200} onPosted={posted} />);
    expect(screen.getByRole('button', { name: 'Know this track? ID it' })).toBeInTheDocument();

    rerender(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={310} onPosted={posted} />);
    expect(screen.getByRole('button', { name: 'Unknown track. Know it? ID it' })).toBeInTheDocument();
  });

  it('turns into two fields, asks a first-time visitor’s name as a second step, and posts a comment carrying the side and the moment it was opened', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="B" ids={ids} time={754.6} onPosted={posted} />);

    await user.click(screen.getByRole('button', { name: 'Know this track? ID it' }));
    expect(artist()).toHaveFocus();
    // The tape plays on; the fields stay on the moment they were opened for.
    rerender(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="B" ids={ids} time={790} onPosted={posted} />);

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
    render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position={null} ids={ids} time={95} onPosted={posted} />);

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
    render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={350} onPosted={posted} />);
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
      render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={[]} time={200} order={order} length={960} onPosted={posted} />);
      await user.click(screen.getByRole('button', { name: 'Know this track? ID it' }));
      expect(screen.getByRole('group', { name: 'From Josh’s list' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '1 Orbital — Chime' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Altern 8/ })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '2 Joey Beltram — Energy Flash' }));
      expect(artist()).toHaveValue('Joey Beltram');
      expect(title()).toHaveValue('Energy Flash');
      await user.type(title(), '{Enter}');
      expect(body().content).toBe('[A 3:20] Joey Beltram - Energy Flash');
    });

    it('offers none for an ID being put right', async () => {
      const user = userEvent.setup();
      render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={60} order={order} length={960} onPosted={posted} />);
      await user.click(screen.getByRole('button', { name: /Correct this ID/ }));
      expect(screen.queryByRole('group', { name: 'From Josh’s list' })).not.toBeInTheDocument();
    });
  });

  describe('on a phone', () => {
    beforeEach(() => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: query === '(max-width: 39.99rem)', media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList);
      // The test's DOM has no animations to wait for.
      Element.prototype.getAnimations = () => [];
    });

    it('takes the ID in a sheet over the page, asks a first-time visitor’s name in the same sheet, and posts', async () => {
      const user = userEvent.setup();
      render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={200} onPosted={posted} />);
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
      render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={200} onPosted={posted} />);
      await user.click(screen.getByRole('button', { name: 'Know this track? ID it' }));
      expect(screen.getByText('Dana')).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Your name' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Change' }));
      expect(yourName()).toHaveValue('Dana');
      expect(yourName()).toHaveFocus();
    });

    it('goes away when it is cancelled, and the keyboard is back on the line', async () => {
      const user = userEvent.setup();
      render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={200} onPosted={posted} />);
      await user.click(screen.getByRole('button', { name: 'Know this track? ID it' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Know this track? ID it' })).toHaveFocus();
    });
  });

  it('takes a new track inside one that is ID’d, at this moment and with empty blanks, once that track’s first moments have passed', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('simfonik:id-name', 'Dana');
    // Moby — Go runs from 0:00. Four seconds in, an ID would be read as that same ID said again.
    const { rerender } = render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={4} onPosted={posted} />);
    expect(screen.queryByRole('button', { name: 'New ID: a track starts here, and you know what it is' })).not.toBeInTheDocument();
    rerender(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={6} onPosted={posted} />);
    expect(screen.getByRole('button', { name: 'New ID: a track starts here, and you know what it is' })).toBeInTheDocument();
    rerender(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={4} onPosted={posted} />);
    expect(screen.queryByRole('button', { name: 'New ID: a track starts here, and you know what it is' })).not.toBeInTheDocument();

    rerender(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={95.4} onPosted={posted} />);
    await user.click(screen.getByRole('button', { name: 'New ID: a track starts here, and you know what it is' }));
    expect(screen.getByRole('form', { name: 'ID the track at A 0:01:35' })).toBeInTheDocument();
    expect(artist()).toHaveValue('');
    await user.type(artist(), 'Orbital');
    await user.type(title(), 'Chime{Enter}');
    expect(body().content).toBe('[A 1:35] Orbital - Chime');
  });

  describe('a mark already on the tape', () => {
    beforeEach(() => window.localStorage.setItem('simfonik:id-name', 'Dana'));

    it('can be taken away: one line that says no track starts there, and nothing asked about the names', async () => {
      const user = userEvent.setup();
      render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={3} onPosted={posted} />);
      await user.click(screen.getByRole('button', { name: 'Now playing: Moby — Go. Correct this ID' }));
      await user.clear(artist());
      await user.clear(title());
      await user.click(screen.getByRole('button', { name: 'Remove this ID' }));

      expect(body()).toMatchObject({ authorName: 'Dana', content: '[A 0:00] no track starts here' });
      expect(posted).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('status')).toHaveTextContent('Removed.');
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });

    it('says "mark" of a spot nobody has named, and offers nothing of the kind where the tape has no mark', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={310} onPosted={posted} />);
      await user.click(screen.getByRole('button', { name: 'Unknown track. Know it? ID it' }));
      await user.click(screen.getByRole('button', { name: 'Remove this mark' }));
      expect(body().content).toBe('[A 5:00] no track starts here');

      rerender(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={200} onPosted={posted} />);
      await user.click(screen.getByRole('button', { name: 'Know this track? ID it' }));
      expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
    });

    it('can be moved to where the tape is, when that is later and in the same track: the old mark goes and the ID is made again, in one post', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={3} onPosted={posted} />);
      // In the track's first moments there is nowhere later to move it to.
      await user.click(screen.getByRole('button', { name: 'Now playing: Moby — Go. Correct this ID' }));
      expect(screen.queryByRole('button', { name: /instead$/ })).not.toBeInTheDocument();
      await user.keyboard('{Escape}');

      rerender(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={41.8} onPosted={posted} />);
      await user.click(screen.getByRole('button', { name: 'Now playing: Moby — Go. Correct this ID' }));
      await user.click(screen.getByRole('button', { name: 'Starts at 0:00:41 instead' }));
      expect(body().content).toBe('[A 0:00] no track starts here\n[A 0:41] Moby - Go');
      expect(screen.getByRole('status')).toHaveTextContent('Moved. Thanks.');
    });

    it('asks a first-time visitor’s name before taking it away, and then takes it away', async () => {
      const user = userEvent.setup();
      window.localStorage.clear();
      render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={3} onPosted={posted} />);
      await user.click(screen.getByRole('button', { name: 'Now playing: Moby — Go. Correct this ID' }));
      await user.click(screen.getByRole('button', { name: 'Remove this ID' }));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(yourName()).toHaveFocus();
      // The step ends in what was being done, and its one button says so.
      expect(screen.getByRole('button', { name: /^Remove/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /post/i })).not.toBeInTheDocument();

      await user.type(yourName(), 'Dana{Enter}');
      expect(body()).toMatchObject({ authorName: 'Dana', content: '[A 0:00] no track starts here' });
    });
  });

  describe('New unknown: a track starts here, and the visitor doesn’t know what it is', () => {
    // The line as the player gives it: the side's IDs with the visitor's own unposted marks among them.
    function Line({ time }: { time: number }) {
      return <TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={useSideIds(0)} time={time} onPosted={posted} />;
    }
    let shared: ReturnType<typeof useTapeTrackIds>;
    function Shared() {
      const all = useTapeTrackIds();
      useEffect(() => {
        shared = all;
      });
      return null;
    }
    const tape = (time: number) => (
      <TapeTrackIdsProvider tapeId="tape-1">
        <Shared />
        <Line time={time} />
      </TapeTrackIdsProvider>
    );
    const mark = () => screen.getByRole('button', { name: 'New unknown: a track starts here, and you don’t know what it is' });
    const submits = () => fetchMock.mock.calls.filter(([url]) => String(url) === '/api/comments/submit');

    beforeEach(() => {
      window.localStorage.setItem('simfonik:id-name', 'Dana');
      fetchMock.mockImplementation((url: RequestInfo | URL) =>
        Promise.resolve(new Response(JSON.stringify(String(url).includes('/api/track-ids/') ? { sides: [ids], orders: [null], complete: true } : String(url) === '/api/comments/submit' ? { success: true } : []), { status: 200 })),
      );
    });

    it('is there once the tape has been played, and not within a moment of a track’s start', async () => {
      const { rerender } = render(tape(0));
      await screen.findByRole('button', { name: 'Now playing: Moby — Go. Correct this ID' });
      expect(screen.queryByRole('button', { name: /^New unknown/ })).not.toBeInTheDocument();
      rerender(tape(3));
      expect(screen.queryByRole('button', { name: /^New unknown/ })).not.toBeInTheDocument();
      rerender(tape(297));
      expect(screen.queryByRole('button', { name: /^New unknown/ })).not.toBeInTheDocument();
      rerender(tape(200));
      expect(mark()).toBeInTheDocument();
    });

    it('sets a point with one press and nothing posted: the line then has an unknown track there, the visitor’s own', async () => {
      const user = userEvent.setup();
      const { rerender } = render(tape(200.7));
      await screen.findByRole('button', { name: 'Know this track? ID it' });
      await user.click(mark());

      expect(shared.marks).toEqual([{ side: 0, n: null, artist: '', title: '', known: false, time: 200 }]);
      expect(screen.getByRole('status')).toHaveTextContent('Marked A 0:03:20. Not posted yet.');
      expect(screen.getByRole('button', { name: 'Unknown track. Know it? ID it' })).toBeInTheDocument();
      expect(submits()).toHaveLength(0);
      // The next can be marked once the tape has moved on a moment.
      expect(screen.queryByRole('button', { name: /^New unknown/ })).not.toBeInTheDocument();
      rerender(tape(215));
      await user.click(mark());
      expect(shared.marks.map((m) => m.time)).toEqual([200, 215]);
    });

    it('is taken back from the blanks without a post, and when ID’d is posted at once from where it was marked', async () => {
      const user = userEvent.setup();
      const { rerender } = render(tape(200));
      await screen.findByRole('button', { name: 'Know this track? ID it' });
      await user.click(mark());
      rerender(tape(230));
      await user.click(screen.getByRole('button', { name: 'Unknown track. Know it? ID it' }));
      // The mark is the visitor's own: there is nowhere later to move it to, only taking it back.
      expect(screen.queryByRole('button', { name: /instead$/ })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Remove this mark' }));
      expect(shared.marks).toEqual([]);
      expect(submits()).toHaveLength(0);

      await user.click(mark());
      rerender(tape(260));
      await user.click(screen.getByRole('button', { name: 'Unknown track. Know it? ID it' }));
      await user.type(artist(), 'Orbital');
      await user.type(title(), 'Chime{Enter}');
      expect(JSON.parse(submits()[0][1].body).content).toBe('[A 3:50] Orbital - Chime');
      await waitFor(() => expect(shared.marks).toEqual([]));
    });
  });

  describe('the tray, on a phone, once the tape has been played', () => {
    let shared: ReturnType<typeof useTapeTrackIds>;
    function Shared() {
      const all = useTapeTrackIds();
      useEffect(() => {
        shared = all;
      });
      return null;
    }
    function Line({ time, isPlaying }: { time: number; isPlaying: boolean }) {
      return <TrackIds tapeId="tape-1" side={0} position="A" ids={useSideIds(0)} time={time} isPlaying={isPlaying} onToggle={toggled} onPosted={posted} />;
    }
    const tape = (time: number, isPlaying = true) => (
      <TapeTrackIdsProvider tapeId="tape-1">
        <Shared />
        <Line time={time} isPlaying={isPlaying} />
      </TapeTrackIdsProvider>
    );
    const phone = (is: boolean) =>
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: is && query === '(max-width: 39.99rem)', media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList);
    const played = (time: number) => act(() => shared.report(0, time, true));
    const tray = () => screen.getByRole('group', { name: 'Now playing' });

    beforeEach(() => {
      toggled.mockClear();
      Element.prototype.getAnimations = () => [];
      window.localStorage.setItem('simfonik:id-name', 'Dana');
      fetchMock.mockImplementation((url: RequestInfo | URL) =>
        Promise.resolve(new Response(JSON.stringify(String(url).includes('/api/track-ids/') ? { sides: [ids], orders: [null], complete: true } : String(url) === '/api/comments/submit' ? { success: true } : []), { status: 200 })),
      );
    });

    it('is not there before the tape is played, nor on a wide screen', async () => {
      phone(true);
      const first = render(tape(0, false));
      await screen.findByRole('button', { name: 'Now playing: Moby — Go. Correct this ID' });
      expect(screen.queryByRole('group', { name: 'Now playing' })).not.toBeInTheDocument();
      first.unmount();

      phone(false);
      render(tape(60));
      await screen.findByRole('button', { name: 'Now playing: Moby — Go. Correct this ID' });
      await played(60);
      expect(screen.queryByRole('group', { name: 'Now playing' })).not.toBeInTheDocument();
    });

    it('says what is playing on two lines with where the tape is, and stays once the tape has been played', async () => {
      phone(true);
      const { rerender } = render(tape(60.4));
      await screen.findByRole('button', { name: 'Now playing: Moby — Go. Correct this ID' });
      await played(60.4);
      expect(tray()).toHaveTextContent('MobyA 0:01:00Go');
      expect(within(tray()).getByRole('button', { name: 'Fix ID' })).toBeInTheDocument();

      // Paused and back at its start, the tape is still one the visitor is listening to.
      rerender(tape(0, false));
      await act(() => shared.report(0, 0, false));
      expect(tray()).toBeInTheDocument();
      rerender(tape(200, false));
      expect(tray()).toHaveTextContent('Nothing ID’d here yetA 0:03:20Know this track? ID it.');
      expect(within(tray()).getByRole('button', { name: 'ID it' })).toBeInTheDocument();
    });

    it('plays and pauses, and opens the sheet for the track playing, with the keyboard back on its button after', async () => {
      const user = userEvent.setup();
      phone(true);
      render(tape(60));
      await screen.findByRole('button', { name: 'Now playing: Moby — Go. Correct this ID' });
      await played(60);
      await user.click(within(tray()).getByRole('button', { name: 'Pause' }));
      expect(toggled).toHaveBeenCalledTimes(1);

      await user.click(within(tray()).getByRole('button', { name: 'Fix ID' }));
      const sheet = screen.getByRole('dialog', { name: 'ID the track at A 0:00:00' });
      expect(within(sheet).getByRole('textbox', { name: 'Artist' })).toHaveValue('Moby');
      await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(within(tray()).getByRole('button', { name: 'Fix ID' })).toHaveFocus();
    });

    it('keeps New unknown in its place: marked unavailable in a track’s first moments, and setting a point otherwise', async () => {
      const user = userEvent.setup();
      phone(true);
      const { rerender } = render(tape(3));
      await screen.findByRole('button', { name: 'Now playing: Moby — Go. Correct this ID' });
      await played(3);
      const unknown = () => within(tray()).getByRole('button', { name: /^New unknown/ });
      expect(unknown()).toHaveAttribute('aria-disabled', 'true');
      await user.click(unknown());
      expect(shared.marks).toEqual([]);

      rerender(tape(200));
      expect(unknown()).toHaveAttribute('aria-disabled', 'false');
      await user.click(unknown());
      expect(shared.marks.map((m) => m.time)).toEqual([200]);
      expect(tray()).toHaveTextContent('Unknown trackA 0:03:20Marked by you, not posted yet');
      expect(within(tray()).getByRole('button', { name: 'ID it' })).toBeInTheDocument();
      expect(unknown()).toHaveAttribute('aria-disabled', 'true');
    });
  });

  it('opens for a line of the tracklist when the tracklist asks, on the side the line is on', async () => {
    const user = userEvent.setup();
    function Asker() {
      const { ask } = useTapeTrackIds();
      return (
        <button type="button" onClick={() => ask('A', 300)}>
          ask
        </button>
      );
    }
    function Line({ position }: { position: string }) {
      return <TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position={position} ids={ids} time={12} onPosted={posted} />;
    }
    const { rerender } = render(
      <TapeTrackIdsProvider tapeId="tape-1">
        <Asker />
        <Line position="B" />
      </TapeTrackIdsProvider>,
    );
    // The blanks belong to the side loaded. Side B's are not the ones asked for.
    await user.click(screen.getByRole('button', { name: 'ask' }));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();

    // The player loads side A, and its blanks open for the unknown track at 5:00, wherever the tape is.
    rerender(
      <TapeTrackIdsProvider tapeId="tape-1">
        <Asker />
        <Line position="A" />
      </TapeTrackIdsProvider>,
    );
    expect(await screen.findByRole('form', { name: 'ID the track at A 0:05:00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove this mark' })).toBeInTheDocument();
  });

  it('asks for what is missing on its own line, drops the complaint once it is being put right, and shuts on Escape', async () => {
    const user = userEvent.setup();
    render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={200} onPosted={posted} />);

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
    render(<TrackIds tapeId="tape-1" side={0} isPlaying={false} onToggle={toggled} position="A" ids={ids} time={200} onPosted={posted} />);

    await user.click(screen.getByRole('button', { name: 'Know this track? ID it' }));
    await user.type(artist(), 'Moby{Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent('Too many requests. Please try again later.');
    expect(artist()).toHaveValue('Moby');
    expect(artist()).toHaveFocus();
    expect(posted).not.toHaveBeenCalled();
  });
});
