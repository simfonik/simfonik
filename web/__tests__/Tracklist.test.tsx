import React, { useEffect } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LiveComments } from '../components/LiveComments';
import { TapeTrackIdsProvider, useTapeTrackIds, type TapeComment } from '../components/TapeTrackIds';
import { Tracklist } from '../components/Tracklist';
import type { RunningOrder, TrackId } from '../lib/track-ids/compose';

const id = (start: number, artist: string, title: string, by = 'Rents'): TrackId => ({ start, end: start + 240, artist, title, known: Boolean(artist || title), by });
const comment = (n: number, author_name: string, content: string, created_at: string): TapeComment => ({ id: n, tape_id: 'tape-1', author_name, content, created_at });

const OWN = [
  { artist: 'The Prodigy', title: 'Hyperspeed (G-Force Part 2)', discogs_url: 'https://www.discogs.com/release/1' },
  { artist: 'Butsch', title: 'The Count', duration: '4:10' },
  { artist: 'Rhythm For Reasons', title: 'Grand National' },
];

describe('the tape page’s tracklist', () => {
  let sides: TrackId[][];
  let orders: (RunningOrder | null)[];
  let comments: TapeComment[];
  let fetchMock: ReturnType<typeof vi.fn>;
  let submit: () => Response;
  // The page's shared state, as the player has it: to say where the tape is, and to see what is asked of it.
  let deck: ReturnType<typeof useTapeTrackIds>;
  const went = vi.fn<(position: string | null, time: number) => void>();

  function Deck() {
    const shared = useTapeTrackIds();
    const { setPlayer } = shared;
    useEffect(() => {
      deck = shared;
    });
    useEffect(() => {
      setPlayer(went);
      return () => setPlayer(null);
    }, [setPlayer]);
    return null;
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    went.mockClear();
    sides = [[]];
    orders = [null];
    comments = [];
    submit = () => new Response(JSON.stringify({ success: true }), { status: 200 });
    fetchMock = vi.fn((url: RequestInfo | URL) => {
      const to = String(url);
      if (to === '/api/comments/submit') return Promise.resolve(submit());
      return Promise.resolve(new Response(JSON.stringify(to.includes('/api/track-ids/') ? { sides, orders, complete: true } : comments), { status: 200 }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const page = (tape: React.ComponentProps<typeof Tracklist>['sides'] = [{ position: 'A', tracks: OWN }]) =>
    render(
      <TapeTrackIdsProvider tapeId="tape-1">
        <Deck />
        <Tracklist tapeId="tape-1" sides={tape} />
        <div data-testid="comments">
          <LiveComments />
        </div>
      </TapeTrackIdsProvider>,
    );
  const rows = () => screen.getAllByRole('listitem').map((row) => row.textContent);
  const playing = (side: number, time: number) => act(() => deck.report(side, time, true));
  const posts = () => fetchMock.mock.calls.filter(([url]) => String(url) === '/api/comments/submit').map(([, init]) => JSON.parse(init.body));
  const read = () => waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/track-ids/'))).toBe(true)).then(() => act(async () => {}));

  describe('one list from all the page knows', () => {
    it('is the tape’s own tracklist from the start, each line with its number where its time will go', () => {
      render(<Tracklist tapeId="tape-1" sides={[{ position: 'A', tracks: OWN }]} />);
      expect(rows()).toEqual(['01The Prodigy — Hyperspeed (G-Force Part 2)', '02Butsch — The Count(4:10)', '03Rhythm For Reasons — Grand National']);
      expect(screen.getByRole('link', { name: /Hyperspeed/ })).toHaveAttribute('href', 'https://www.discogs.com/release/1');
      expect(screen.getByText('0 of 3 timed')).toBeInTheDocument();
    });

    it('gives a line the time of the ID that names the same record, and says how far along the side is', async () => {
      sides = [[id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)'), id(221, 'Butsch', 'The Count', 'Dana')]];
      page();
      await waitFor(() => expect(rows()).toEqual(['0:00:00The Prodigy — Hyperspeed (G-Force Part 2)', '0:03:41Butsch — The Count(4:10)', '03Rhythm For Reasons — Grand National']));
      expect(screen.getByText('2 of 3 timed')).toBeInTheDocument();
    });

    it('is a list someone kept in the comments, said to be theirs, where the tape has none of its own', async () => {
      orders = [{ by: 'Josh', tracks: [{ n: 1, artist: 'Orbital', title: 'Chime', known: true }, { n: 2, artist: '', title: '', known: false }] }];
      sides = [[id(0, 'Orbital', 'Chime', 'Softboiled')]];
      page([{ position: 'A' }]);
      await waitFor(() => expect(rows()).toEqual(['0:00:00Orbital — Chime', '02Unknown track']));
      expect(screen.getByText('1 of 2 timed · 1 unknown · Josh’s list')).toBeInTheDocument();
    });

    it('is the IDs in order of time where there is no list, with a way to ID a spot nobody has named', async () => {
      const user = userEvent.setup();
      sides = [[id(300, '', '', 'Josh'), id(0, 'Joey Beltram', 'Energy Flash')]];
      page([{ position: 'A' }]);
      await waitFor(() => expect(rows()).toEqual(['0:00:00Joey Beltram — Energy Flash', '0:05:00Unknown trackID it']));
      expect(screen.getByText('1 track ID’d · 1 unknown')).toBeInTheDocument();

      // An unknown track is ID'd by ear: the tape goes there, and the form by the player is asked to open.
      await user.click(screen.getByRole('button', { name: 'ID the unknown track at 0:05:00' }));
      expect(went).toHaveBeenCalledWith(null, 300);
      expect(deck.asked).toEqual({ position: null, time: 300 });
    });

    it('names each side of a tape with sides, and leaves out a side nothing is known of', async () => {
      sides = [[], [id(754, 'Moby', 'Go')]];
      orders = [null, null];
      page([{ position: 'A', title: 'Lone Wolf' }, { position: 'B' }]);
      expect(await screen.findByRole('heading', { name: 'Side B', level: 3 })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Lone Wolf' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Play from B 0:12:34' })).toBeInTheDocument();
    });

    it('is not there, heading and all, on a tape with no tracklist and no IDs', async () => {
      page([{ position: 'A' }]);
      await read();
      expect(screen.queryByRole('heading', { name: 'Tracklist' })).not.toBeInTheDocument();
    });

    it('says once, above the list, who it is owed to, and puts no name on a row', async () => {
      orders = [{ by: 'Josh', tracks: [{ n: 1, artist: 'Orbital', title: 'Chime', known: true }, { n: 2, artist: 'Altern 8', title: 'Infiltrate 202', known: true }] }];
      sides = [[id(0, 'Orbital', 'Chime', 'Softboiled')]];
      page([{ position: 'A' }]);
      expect(await screen.findByText('Josh and Softboiled')).toBeInTheDocument();
      expect(rows().join(' ')).not.toMatch(/Josh|Softboiled/);
    });

    it('lists three and more with a comma before the "and", and counts those past the third', async () => {
      sides = [[id(0, 'Orbital', 'Chime', 'Josh McClintock'), id(300, 'Joey Beltram', 'Energy Flash', 'Softboiled'), id(600, 'Altern 8', 'Infiltrate 202', 'Rents')]];
      const first = page([{ position: 'A' }]);
      expect(await screen.findByText('Josh McClintock, Rents, and Softboiled')).toBeInTheDocument();
      first.unmount();

      sides = [[...sides[0], id(900, 'LFO', 'LFO', 'Dana'), id(1200, 'Moby', 'Go', 'Cooper')]];
      page([{ position: 'A' }]);
      expect(await screen.findByText('Cooper, Dana, Josh McClintock, and 2 others')).toBeInTheDocument();
    });

    it('shows a long side’s first twenty tracks and a way to the rest', async () => {
      const user = userEvent.setup();
      const long = Array.from({ length: 23 }, (_, k) => ({ artist: `Artist ${k + 1}`, title: `Title ${k + 1}` }));
      render(<Tracklist tapeId="tape-1" sides={[{ position: 'A', tracks: long }]} />);
      expect(rows()).toHaveLength(20);
      await user.click(screen.getByRole('button', { name: 'Show all 23 tracks' }));
      expect(rows()).toHaveLength(23);
      expect(screen.getAllByRole('listitem')[20]).toHaveFocus();
    });
  });

  describe('as the tape plays', () => {
    beforeEach(() => {
      sides = [[id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)')]];
    });

    it('takes the tape to a track when its time is pressed', async () => {
      const user = userEvent.setup();
      page();
      await user.click(await screen.findByRole('button', { name: 'Play from 0:00:00' }));
      expect(went).toHaveBeenCalledWith(null, 0);
    });

    it('lights the row playing, and no row once the tape is past where that track is taken to end', async () => {
      page();
      await screen.findByRole('button', { name: 'Play from 0:00:00' });
      expect(screen.queryByRole('listitem', { current: true })).not.toBeInTheDocument();
      await playing(0, 30);
      expect(screen.getByRole('listitem', { current: true })).toHaveTextContent('The Prodigy');
      await playing(0, 600);
      expect(screen.queryByRole('listitem', { current: true })).not.toBeInTheDocument();
    });

    it('puts a + on the rows with no time while their side plays, but not within a moment of a track’s start', async () => {
      page();
      await screen.findByRole('button', { name: 'Play from 0:00:00' });
      expect(screen.queryByRole('button', { name: /starts here$/ })).not.toBeInTheDocument();

      await playing(0, 3);
      expect(screen.queryByRole('button', { name: /starts here$/ })).not.toBeInTheDocument();
      await playing(0, 221.6);
      expect(screen.getAllByRole('button', { name: /starts here$/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['Butsch — The Count starts here', 'Rhythm For Reasons — Grand National starts here']);
      // The numbers are back when another side is the one playing.
      await playing(1, 221.6);
      expect(screen.queryByRole('button', { name: /starts here$/ })).not.toBeInTheDocument();
    });
  });

  describe('a visitor’s own times', () => {
    beforeEach(() => {
      sides = [[id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)')]];
      window.localStorage.setItem('simfonik:id-name', 'Dana');
    });
    const plus = (name: string) => screen.getByRole('button', { name: `${name} starts here` });
    const bar = () => screen.getByRole('form', { name: 'Post your times' });

    it('are given with one press each, kept until posted, and posted together as one comment in order of time', async () => {
      const user = userEvent.setup();
      page();
      await screen.findByRole('button', { name: 'Play from 0:00:00' });

      await playing(0, 403.2);
      await user.click(plus('Rhythm For Reasons — Grand National'));
      await playing(0, 221.9);
      await user.click(plus('Butsch — The Count'));
      expect(rows()).toEqual(['0:00:00The Prodigy — Hyperspeed (G-Force Part 2)', '0:03:41Butsch — The Count(4:10)Undo', '0:06:43Rhythm For Reasons — Grand NationalUndo']);
      expect(bar()).toHaveTextContent('2 times not posted as Dana');
      // What the + is for stays said while lines still lack a posted time.
      expect(screen.getByText(/press the \+ on its row/)).toBeInTheDocument();
      // Nothing is public yet, and the side is no further along.
      expect(posts()).toEqual([]);
      expect(screen.getByText('1 of 3 timed')).toBeInTheDocument();

      await user.click(within(bar()).getByRole('button', { name: 'Post' }));
      expect(posts()).toEqual([{ tapeId: 'tape-1', authorName: 'Dana', authorEmail: '', content: '[3:41] Butsch - The Count\n[6:43] Rhythm For Reasons - Grand National', website: '' }]);
      await waitFor(() => expect(screen.queryByRole('form', { name: 'Post your times' })).not.toBeInTheDocument());
      expect(screen.getByRole('status')).toHaveTextContent('Posted 2 times. Thanks.');
      expect(window.localStorage.getItem('simfonik:id-marks:tape-1')).toBeNull();
    });

    it('keep the side in order of time: an ID the list has no line for stays after a line that is then timed before it', async () => {
      const user = userEvent.setup();
      sides = [[id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)'), id(592, 'Stakker', 'Humanoid')]];
      page();
      await waitFor(() => expect(rows()).toEqual(['0:00:00The Prodigy — Hyperspeed (G-Force Part 2)', '0:09:52Stakker — Humanoid', '02Butsch — The Count(4:10)', '03Rhythm For Reasons — Grand National']));

      await playing(0, 522);
      await user.click(plus('Butsch — The Count'));
      expect(rows()).toEqual(['0:00:00The Prodigy — Hyperspeed (G-Force Part 2)', '0:08:42Butsch — The Count(4:10)Undo', '0:09:52Stakker — Humanoid', '03Rhythm For Reasons — Grand National']);
    });

    it('cannot be given against the list’s order: the + is only on the lines that could start where the tape is', async () => {
      sides = [[id(0, 'The Prodigy', 'Hyperspeed (G-Force Part 2)'), id(400, 'Rhythm For Reasons', 'Grand National')]];
      page([{ position: 'A', tracks: [...OWN, { artist: 'Phenomania', title: 'Caramelle' }] }]);
      await screen.findByRole('button', { name: 'Play from 0:06:40' });
      const offered = () => screen.queryAllByRole('button', { name: /starts here$/ }).map((b) => b.getAttribute('aria-label'));

      // Before the third line's start, only the second can start; after it, only the fourth.
      await playing(0, 200);
      expect(offered()).toEqual(['Butsch — The Count starts here']);
      await playing(0, 450);
      expect(offered()).toEqual(['Phenomania — Caramelle starts here']);
    });

    it('can each be taken back before they are posted', async () => {
      const user = userEvent.setup();
      page();
      await screen.findByRole('button', { name: 'Play from 0:00:00' });
      await playing(0, 221);
      await user.click(plus('Butsch — The Count'));
      await user.click(screen.getByRole('button', { name: 'Take back the time for Butsch — The Count' }));
      expect(screen.queryByRole('form', { name: 'Post your times' })).not.toBeInTheDocument();
      expect(plus('Butsch — The Count')).toBeInTheDocument();
      expect(posts()).toEqual([]);
    });

    it('are still there after a reload', async () => {
      const user = userEvent.setup();
      const first = page();
      await screen.findByRole('button', { name: 'Play from 0:00:00' });
      await playing(0, 221);
      await user.click(plus('Butsch — The Count'));
      first.unmount();

      page();
      expect(await screen.findByRole('button', { name: 'Play from 0:03:41, your time, not posted yet' })).toBeInTheDocument();
      expect(bar()).toHaveTextContent('1 time not posted as Dana');
    });

    it('take the same place on the tape only once: a second track cannot start within a moment of the first', async () => {
      const user = userEvent.setup();
      page();
      await screen.findByRole('button', { name: 'Play from 0:00:00' });
      await playing(0, 221);
      await user.click(plus('Butsch — The Count'));
      await playing(0, 224);
      expect(screen.queryByRole('button', { name: /starts here$/ })).not.toBeInTheDocument();
      await playing(0, 230);
      expect(plus('Rhythm For Reasons — Grand National')).toBeInTheDocument();
    });

    it('ask a first-time visitor’s name in the same bar, and say what went wrong when the post is refused', async () => {
      const user = userEvent.setup();
      window.localStorage.clear();
      submit = () => new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), { status: 429 });
      page();
      await screen.findByRole('button', { name: 'Play from 0:00:00' });
      await playing(0, 221);
      await user.click(plus('Butsch — The Count'));

      await user.click(within(bar()).getByRole('button', { name: 'Post' }));
      expect(within(bar()).getByRole('alert')).toHaveTextContent('Enter your name.');
      expect(within(bar()).getByRole('textbox', { name: 'Your name' })).toHaveFocus();
      expect(posts()).toEqual([]);

      await user.type(within(bar()).getByRole('textbox', { name: 'Your name' }), 'Dana{Enter}');
      expect(posts()).toHaveLength(1);
      expect(await within(bar()).findByRole('alert')).toHaveTextContent('Too many requests. Please try again later.');
      // The time is still the visitor's to post.
      expect(screen.getByRole('button', { name: 'Play from 0:03:41, your time, not posted yet' })).toBeInTheDocument();
    });

    it('include a point marked by ear on the player’s line: a row of its own at its time, taken back or posted with the rest', async () => {
      const user = userEvent.setup();
      page();
      await screen.findByRole('button', { name: 'Play from 0:00:00' });
      await act(() => deck.setMarks([{ side: 0, n: null, artist: '', title: '', known: false, time: 500 }, { side: 0, n: null, artist: '', title: '', known: false, time: 130 }]));

      expect(rows()).toEqual(['0:00:00The Prodigy — Hyperspeed (G-Force Part 2)', '0:02:10Unknown trackUndo', '0:08:20Unknown trackUndo', '02Butsch — The Count(4:10)', '03Rhythm For Reasons — Grand National']);
      expect(bar()).toHaveTextContent('2 times not posted as Dana');
      // They are not the side's yet.
      expect(screen.getByText('1 of 3 timed')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Take back the mark at 0:02:10' }));
      expect(deck.marks.map((m) => m.time)).toEqual([500]);
      await user.click(within(bar()).getByRole('button', { name: 'Post' }));
      expect(posts()[0].content).toBe('[8:20] ? - ?');
    });

    it('make the tracklist appear on a tape that had nothing, with only the points and the bar', async () => {
      sides = [[]];
      page([{ position: 'A' }]);
      await read();
      expect(screen.queryByRole('heading', { name: 'Tracklist' })).not.toBeInTheDocument();
      await act(() => deck.setMarks([{ side: 0, n: null, artist: '', title: '', known: false, time: 61 }]));
      expect(screen.getByRole('heading', { name: 'Tracklist' })).toBeInTheDocument();
      expect(rows()).toEqual(['0:01:01Unknown trackUndo']);
      expect(bar()).toHaveTextContent('1 time not posted');
    });

    it('mark a line the list has down as unknown without naming it', async () => {
      const user = userEvent.setup();
      orders = [{ by: 'Josh', tracks: [{ n: 1, artist: 'Orbital', title: 'Chime', known: true }, { n: 2, artist: '', title: 'ambient track', known: false }] }];
      sides = [[id(0, 'Orbital', 'Chime')]];
      page([{ position: 'A' }, { position: 'B' }]);
      await screen.findByRole('button', { name: 'Play from A 0:00:00' });
      await playing(0, 250);
      await user.click(plus('Track 2'));
      await user.click(within(bar()).getByRole('button', { name: 'Post' }));
      expect(posts()[0].content).toBe('[A 4:10] ? - ?');
    });
  });

  describe('its history', () => {
    it('is every post of IDs in the site’s form, newest first, shut until asked for, and none of them is in the comments', async () => {
      const user = userEvent.setup();
      comments = [
        comment(1, 'Rents', 'what a tape', '2026-11-01T10:00:00Z'),
        comment(2, 'Josh', '[0:00] The Prodigy - Hyperspeed (G-Force Part 2)', '2026-11-02T10:00:00Z'),
        comment(3, 'Dana', '[3:41] Butsch - The Count\n[6:43] Rhythm For Reasons - Grand National', '2026-11-03T10:00:00Z'),
        comment(4, 'Softboiled', 'The track at 12:34 is Moby - Go', '2026-11-04T10:00:00Z'),
        comment(5, 'Josh', '[6:43] no track starts here', '2026-11-05T10:00:00Z'),
      ];
      page();
      const history = await screen.findByRole('button', { name: 'History · 3 posts' });
      expect(history).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByText('0:03:41', { selector: '.comment-time' })).not.toBeVisible();

      await user.click(history);
      expect(history).toHaveAttribute('aria-expanded', 'true');
      const log = document.getElementById(history.getAttribute('aria-controls') as string) as HTMLElement;
      expect(within(log).getAllByRole('listitem').map((entry) => entry.textContent)).toEqual([
        '0:06:43 RemovedJosh · Nov 5, 2026',
        '0:03:41 Butsch — The Count0:06:43 Rhythm For Reasons — Grand NationalDana · Nov 3, 2026',
        '0:00:00 The Prodigy — Hyperspeed (G-Force Part 2)Josh · Nov 2, 2026',
      ]);
      await user.click(within(log).getByRole('button', { name: 'Play from 0:03:41' }));
      expect(went).toHaveBeenCalledWith(null, 221);

      const talk = screen.getByTestId('comments');
      expect(within(talk).getByText('what a tape')).toBeInTheDocument();
      // An ID said in a sentence is talk; only the site's own form is a post of IDs.
      expect(within(talk).getByText('The track at 12:34 is Moby - Go')).toBeInTheDocument();
      expect(within(talk).queryByText(/Butsch|Hyperspeed|no track starts here/)).not.toBeInTheDocument();
    });

    it('is not there on a tape nobody has ID’d through the site', async () => {
      comments = [comment(1, 'Rents', 'what a tape', '2026-11-01T10:00:00Z')];
      page();
      await screen.findByText('what a tape');
      expect(screen.queryByRole('button', { name: /^History/ })).not.toBeInTheDocument();
    });
  });
});
