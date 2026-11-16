// A tape page to test against: the parts of the real page that have to do with track IDs, put together as
// the page puts them, over a server that keeps comments and reads them with the real reader. What a test
// posts is read back exactly as the site would read it, so a test of the page is also a test that the page
// and the reader agree.
import React, { useEffect, useMemo } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, vi } from 'vitest';
import { LiveComments } from '../components/LiveComments';
import { TapeTrackIdsProvider, useSide, useTapeTrackIds, type TapeComment, type TapeSide } from '../components/TapeTrackIds';
import { TrackIds } from '../components/TrackIds';
import { Tracklist } from '../components/Tracklist';
import type { Said } from '../lib/track-ids/parse';
import { readSaid } from '../lib/track-ids/said';
import { timeline } from '../lib/track-ids/side';

type Setup = {
  /** The tape's sides. One unnamed side by default: a tape that is one recording. */
  sides?: TapeSide[];
  /** What the 2008–2023 archive says of the tape. */
  archive?: Said[];
  /** The comments already posted through the site, as text, oldest first. */
  posted?: { by: string; says: string }[];
  /** A phone-width screen: the sheet and the tray, not the line and its blanks. */
  phone?: boolean;
  /** The name the visitor has posted under before, on this device. None for a first-time visitor. */
  name?: string | null;
  /** The side's length in seconds, as the player knows it. */
  length?: number | null;
  /** What the visitor left unposted on this device on an earlier visit, as the page keeps it. */
  kept?: string;
  /** The comments posted through the site can't be read: only the archive can. */
  down?: boolean;
  /** Put together as React does in development, where everything that sets a page up is run twice. */
  strict?: boolean;
  /** The first reading of the comments is held back until `hold` is let go: `page.reading.go()`. */
  slow?: boolean;
};

const ONE_SIDE: TapeSide[] = [{ position: 'A' }];

/** Where the page keeps a visitor's unposted changes for the test's tape. */
export const KEPT = 'simfonik:id-changes:tape-1';

/** The waveform's part in the page: the marks it is given, written out so a test can read them. */
function Marks({ side }: { side: number }) {
  const { rows } = useSide(side);
  const marks = useMemo(() => timeline(rows), [rows]);
  return <p data-testid="marks">{marks.map((mark) => `${mark.start}${mark.known ? '' : '?'}`).join(' ')}</p>;
}

// A row as it reads, less "Edit": every row with a name and a time has it, so it tells one row from another
// no more than the row's padding does.
const reads = (row: Element) => {
  const read = row.cloneNode(true) as Element;
  read.querySelector('.tracklist-edit')?.remove();
  return read.textContent;
};

export function tapePage({ sides = ONE_SIDE, archive = [], posted = [], phone = false, name = 'Dana', length = null, kept, down = false, strict = false, slow = false }: Setup = {}) {
  document.body.innerHTML = '';
  window.localStorage.clear();
  if (name) window.localStorage.setItem('simfonik:id-name', name);
  if (kept) window.localStorage.setItem(KEPT, kept);
  // The test's DOM has no animations to wait for.
  Element.prototype.getAnimations = () => [];
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: phone && query === '(max-width: 39.99rem)', media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList);

  // The server: the comments it holds, and how it answers.
  let clock = Date.UTC(2026, 10, 15, 12);
  const stamp = () => new Date((clock += 60_000)).toISOString();
  const server = {
    comments: posted.map((c, k): TapeComment => ({ id: k + 1, tape_id: 'tape-1', author_name: c.by, content: c.says, created_at: stamp() })),
    /** Set to have the next posts refused with this. */
    refuse: null as string | null,
    /** The newer comments are unreadable: the archive still reads. */
    down,
    /** Holds every reading of the comments back until let go, so a test can look at the page while it waits. */
    hold: null as Promise<void> | null,
  };
  const reading = slow ? hold(server) : { go: () => {} };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const fetched = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const to = String(url);
    if (to === '/api/comments/submit') {
      if (server.refuse) return json({ error: server.refuse }, 429);
      const body = JSON.parse(String(init?.body));
      server.comments.push({ id: server.comments.length + 1, tape_id: body.tapeId, author_name: body.authorName, content: body.content, created_at: stamp() });
      return json({ success: true });
    }
    if (server.hold) await server.hold;
    if (!to.startsWith('/api/track-ids/')) throw new Error(`The page asked for ${to}`);
    // As read.ts answers: the comments and what they and the archive say; the archive alone when the newer ones can't be had.
    const comments = server.down ? [] : server.comments;
    const said = [...archive, ...comments.map((c) => ({ author: c.author_name, date: c.created_at, content: c.content }))];
    return json({ comments, ...readSaid({ id: 'tape-1', sides: sides as never }, said), complete: !server.down });
  });
  global.fetch = fetched as unknown as typeof fetch;

  const went = vi.fn<(position: string | null, time: number) => void>();
  const toggled = vi.fn<() => void>();
  const shared = { now: null as unknown as ReturnType<typeof useTapeTrackIds> };
  function Deck() {
    const all = useTapeTrackIds();
    const { setPlayer } = all;
    useEffect(() => {
      shared.now = all;
    });
    useEffect(() => {
      setPlayer(went);
      return () => setPlayer(null);
    }, [setPlayer]);
    return null;
  }
  const several = sides.length > 1;
  const Whole = strict ? React.StrictMode : React.Fragment;
  const Page = ({ side, time, playing }: { side: number; time: number; playing: boolean }) => (
    <Whole>
    <TapeTrackIdsProvider tapeId="tape-1" sides={sides}>
      <Deck />
      <TrackIds key={sides[side].position} side={side} position={several ? sides[side].position : null} time={time} isPlaying={playing} onToggle={toggled} length={length} />
      <Marks side={side} />
      <Tracklist />
      <div data-testid="comments">
        <LiveComments />
      </div>
    </TapeTrackIdsProvider>
    </Whole>
  );
  const view = render(<Page side={0} time={0} playing={false} />);

  const list = () => screen.queryByRole('region', { name: 'Tracklist' });
  return {
    user: userEvent.setup(),
    server,
    reading,
    went,
    toggled,
    unmount: view.unmount,
    /** The page's shared state, for what a test has no other way to see. */
    shared: () => shared.now,
    /** Waits until the page has read the comments. */
    read: () => waitFor(() => expect(shared.now.read).not.toBe('reading')),
    /** Moves the tape: to a moment of a side, playing. With `played: false`, a tape nobody has started yet. */
    async at(time: number, { side = 0, played = true }: { side?: number; played?: boolean } = {}) {
      view.rerender(<Page side={side} time={time} playing={played} />);
      await act(async () => shared.now.report(side, time, played));
    },
    /** The line under the player, as text, on a wide screen. */
    line: () => document.querySelector('.track-ids-row')?.textContent ?? null,
    /** The tray at the foot of a phone's screen, or null. */
    tray: () => screen.queryByRole('group', { name: 'Now playing' }),
    /** The marks the waveform is given: each track's start, with a ? where it has no name. */
    marks: () => screen.getByTestId('marks').textContent,
    /** The tracklist's rows that are showing, as text. */
    // Each row as it reads, less "Edit": every row with a name and a time has it, so it tells one from another no more than the row's padding does.
    rows: () => [...(list()?.querySelectorAll('ol > li:not([hidden])') ?? [])].map(reads),
    tracklist: list,
    /** The row that is lit, as text, or null. */
    lit: () => {
      const row = screen.queryByRole('listitem', { current: true });
      return row && reads(row);
    },
    /** The rows that show "Edit" to a finger: the times that could be moved to where the tape is, and the row playing. */
    editable: () => [...(list()?.querySelectorAll('ol > li:is([data-movable], [aria-current])') ?? [])].map(reads),
    /** The bar that posts the visitor's unposted times, or null. */
    bar: () => screen.queryByRole('form', { name: 'Post your times' }),
    /** What has been posted through the page, as the text of each comment. */
    posts: () => fetched.mock.calls.filter(([url]) => String(url) === '/api/comments/submit').map(([, init]) => JSON.parse(String(init?.body)).content as string),
    /** How many times the page has read the comments. */
    reads: () => fetched.mock.calls.filter(([url]) => String(url).startsWith('/api/track-ids/')).length,
    plus: (name: string) => screen.getByRole('button', { name: `${name} starts here` }),
    pluses: () => screen.queryAllByRole('button', { name: /starts here$/ }).map((button) => button.getAttribute('aria-label')?.replace(' starts here', '')),
    button: (name: string | RegExp) => screen.getByRole('button', { name }),
    has: (name: string | RegExp) => screen.queryByRole('button', { name }) !== null,
  };
}

/** A reading of the comments that waits to be let go: `held.go()` lets it, and every one after it, through. */
export function hold(server: { hold: Promise<void> | null }) {
  let go = () => {};
  server.hold = new Promise<void>((resolve) => {
    go = () => {
      server.hold = null;
      resolve();
    };
  });
  return { go };
}

/** A comment in the archive. */
export const old = (content: string, author = 'Rents', date = '2013-05-01'): Said => ({ author, date, content });
