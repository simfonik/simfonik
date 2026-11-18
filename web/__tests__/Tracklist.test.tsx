// The tracklist section itself: what it is made of, how a side is headed and summed up, the bar that posts,
// and the history at its foot. What each state of a track does on it, and on the rest of the page, is in
// TrackIdStates.test.tsx.
import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TapeTrackIdsProvider } from '../components/TapeTrackIds';
import { Tracklist } from '../components/Tracklist';
import { old, tapePage } from './tape';

const OWN = [
  { artist: 'The Prodigy', title: 'Hyperspeed (G-Force Part 2)', discogs_url: 'https://www.discogs.com/release/1' },
  { artist: 'Butsch', title: 'The Count', duration: '4:10' },
  { artist: 'Rhythm For Reasons', title: 'Grand National' },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('what the tracklist is made of', () => {
  it('is the tape’s own tracklist from the start, before anything has been read, each line with its number where its time will go', () => {
    document.body.innerHTML = '';
    global.fetch = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const sides = [{ position: 'A', tracks: OWN }];
    render(
      <TapeTrackIdsProvider tapeId="tape-1" sides={sides}>
        <Tracklist />
      </TapeTrackIdsProvider>,
    );
    // (Each also has "Edit", which a mouse finds on the row under it.)
    expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual(['01The Prodigy — Hyperspeed (G-Force Part 2)Edit', '02Butsch — The Count(4:10)Edit', '03Rhythm For Reasons — Grand NationalEdit']);
    expect(screen.getByRole('link', { name: /Hyperspeed/ })).toHaveAttribute('href', 'https://www.discogs.com/release/1');
    expect(screen.getByText('0 of 3 timed')).toBeInTheDocument();
    expect(screen.getByText(/press the \+ on its row/)).toBeInTheDocument();
  });

  it('gives a line the time of the ID that names the same record, and says how far along the side is', async () => {
    const page = tapePage({ sides: [{ position: 'A', tracks: OWN }], posted: [{ by: 'Rents', says: '[0:00] The Prodigy - Hyperspeed (G-Force Part 2)' }, { by: 'Dana', says: '[3:41] Butsch - The Count' }] });
    await page.read();
    expect(page.rows()).toEqual(['0:00:00The Prodigy — Hyperspeed (G-Force Part 2)', '0:03:41Butsch — The Count(4:10)', '03Rhythm For Reasons — Grand National']);
    expect(screen.getByText('2 of 3 timed')).toBeInTheDocument();
  });

  it('is a list someone kept in the comments, where the tape has none of its own', async () => {
    const page = tapePage({ archive: [old('Side 1\n1. Orbital - Chime\n2. ??\n3. LFO - LFO', 'Josh')], posted: [{ by: 'Softboiled', says: '[0:00] Orbital - Chime' }] });
    await page.read();
    expect(page.rows()).toEqual(['0:00:00Orbital — Chime', '02Unknown track', '03LFO — LFO']);
    // Whose list it is is said once, with everyone else the tracklist is owed to, above it.
    expect(screen.getByText('1 of 3 timed · 1 unknown')).toBeInTheDocument();
  });

  it('is the IDs in order of time where there is no list, and all that is left to say when every track has both', async () => {
    const page = tapePage({ posted: [{ by: 'Josh', says: '[5:00] Orbital - Chime\n[0:00] Joey Beltram - Energy Flash' }] });
    await page.read();
    expect(page.rows()).toEqual(['0:00:00Joey Beltram — Energy Flash', '0:05:00Orbital — Chime']);
    expect(screen.getByText('2 tracks ID’d')).toBeInTheDocument();
    // Nothing waits for a time, so nothing is said about the +.
    expect(screen.queryByText(/press the \+ on its row/)).not.toBeInTheDocument();
  });

  it('says so when every line of a list has its time', async () => {
    const page = tapePage({ sides: [{ position: 'A', tracks: OWN.slice(0, 2) }], posted: [{ by: 'Rents', says: '[0:00] The Prodigy - Hyperspeed (G-Force Part 2)\n[3:41] Butsch - The Count' }] });
    await page.read();
    expect(screen.getByText('All 2 tracks timed')).toBeInTheDocument();
  });

  it('names each side of a tape with sides, and leaves out a side nothing is known of', async () => {
    const page = tapePage({ sides: [{ position: 'A', title: 'Lone Wolf' }, { position: 'B' }], posted: [{ by: 'Josh', says: '[B 12:34] Moby - Go' }] });
    await page.read();
    expect(screen.getByRole('heading', { name: 'Side B', level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Lone Wolf' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play from B 0:12:34' })).toBeInTheDocument();
  });

  it('is not there, heading and all, on a tape with no tracklist and no IDs', async () => {
    const page = tapePage();
    await page.read();
    expect(page.tracklist()).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Tracklist' })).not.toBeInTheDocument();
  });

  it('shows a long side’s first twenty tracks and a way to the rest', async () => {
    const long = Array.from({ length: 23 }, (_, k) => ({ artist: `Artist ${k + 1}`, title: `Title ${k + 1}` }));
    const page = tapePage({ sides: [{ position: 'A', tracks: long }] });
    await page.read();
    expect(page.rows()).toHaveLength(20);
    await page.user.click(page.button('Show all 23 tracks'));
    expect(page.rows()).toHaveLength(23);
    expect(within(page.tracklist() as HTMLElement).getAllByRole('listitem')[20]).toHaveFocus();
  });

  it('opens a long side by itself when the track playing is past its first twenty, and leaves the keyboard where it was', async () => {
    const long = Array.from({ length: 23 }, (_, k) => `[${k}:00] Artist${String(k).padStart(2, '0')} - ${String(k).padStart(2, '0').repeat(2)}`).join('\n');
    const page = tapePage({ posted: [{ by: 'Josh', says: long }] });
    await page.read();
    await page.at(19 * 60 + 30);
    expect(page.rows()).toHaveLength(20);
    await page.at(21 * 60 + 30);
    expect(page.rows()).toHaveLength(23);
    expect(page.lit()).toBe('0:21:00Artist21 — 2121');
    expect(page.has('Show all 23 tracks')).toBe(false);
    expect(within(page.tracklist() as HTMLElement).getAllByRole('listitem')[20]).not.toHaveFocus();
    // It stays open when the tape goes back.
    await page.at(30);
    expect(page.rows()).toHaveLength(23);
  });

  it('shows the whole of a side that was short when it first showed, and leaves the keyboard where it was when a twenty-first track is added', async () => {
    // Twenty records, each its own: 00 and "0000", 01 and "0101".
    const twenty = Array.from({ length: 20 }, (_, k) => `[${k}:00] Artist${String(k).padStart(2, '0')} - ${String(k).padStart(2, '0').repeat(2)}`).join('\n');
    const page = tapePage({ posted: [{ by: 'Rents', says: twenty }] });
    await page.read();
    expect(page.rows()).toHaveLength(20);
    await page.at(1500);
    await page.mark();
    await waitFor(() => expect(page.rows()).toHaveLength(21));
    expect(document.activeElement?.tagName).not.toBe('LI');
  });

  it('on a side the site has no audio for, says when its tracks start and offers nothing that would take the tape there', async () => {
    const page = tapePage({ sides: [{ position: 'A' }, { position: 'B', silent: true }], posted: [{ by: 'Josh', says: '[A 1:00] Orbital - Chime\n[B 12:34] Moby - Go\n[B 20:00] ? - ?' }] });
    await page.read();
    expect(page.rows()).toEqual(['0:01:00Orbital — Chime', '0:12:34Moby — Go', '0:20:00Unknown track']);
    expect(page.has('Play from A 0:01:00')).toBe(true);
    expect(page.has(/^Play from B/)).toBe(false);
    expect(page.has(/^ID it/)).toBe(false);
    // Nor in the history of posts, which lists the same times.
    await page.user.click(page.button('History · 1 post'));
    expect(screen.getAllByRole('button', { name: /^Play from/ }).map((button) => button.getAttribute('aria-label'))).toEqual(['Play from A 0:01:00', 'Play from A 0:01:00']);
  });
});

describe('who the tracklist is owed to', () => {
  it('is said once, above the list, with no name on a row', async () => {
    const page = tapePage({ archive: [old('Side 1\n1. Orbital - Chime\n2. Altern 8 - Infiltrate 202\n3. LFO - LFO', 'Josh')], posted: [{ by: 'Softboiled', says: '[0:00] Orbital - Chime' }] });
    await page.read();
    expect(screen.getByText('Josh and Softboiled')).toBeInTheDocument();
    expect(page.rows().join(' ')).not.toMatch(/Josh|Softboiled/);
  });

  it('lists three and more with a comma before the "and", and counts those past the third', async () => {
    const three = tapePage({ posted: [{ by: 'Josh McClintock', says: '[0:00] Orbital - Chime' }, { by: 'Softboiled', says: '[5:00] Joey Beltram - Energy Flash' }, { by: 'Rents', says: '[10:00] Altern 8 - Infiltrate 202' }] });
    await three.read();
    expect(screen.getByText('Josh McClintock, Rents, and Softboiled')).toBeInTheDocument();
    three.unmount();

    const five = tapePage({
      posted: [{ by: 'Josh McClintock', says: '[0:00] Orbital - Chime' }, { by: 'Softboiled', says: '[5:00] Joey Beltram - Energy Flash' }, { by: 'Rents', says: '[10:00] Altern 8 - Infiltrate 202' }, { by: 'Dana', says: '[15:00] LFO - LFO' }, { by: 'Cooper', says: '[20:00] Moby - Go' }],
    });
    await five.read();
    expect(screen.getByText('Cooper, Dana, Josh McClintock, and 2 others')).toBeInTheDocument();
  });
});

describe('as the tape plays', () => {
  it('lights the row playing, and no row once the tape is past where that track is taken to end', async () => {
    const page = tapePage({ posted: [{ by: 'Josh', says: '[0:00] Orbital - Chime' }] });
    await page.read();
    expect(page.lit()).toBeNull();
    await page.at(30);
    expect(page.lit()).toBe('0:00:00Orbital — Chime');
    // Four minutes on with nothing known to follow.
    await page.at(600);
    expect(page.lit()).toBeNull();
    // Its time could still be moved to here, so to a finger its row still shows "Edit".
    expect(page.editable()).toEqual(['0:00:00Orbital — Chime']);
  });

  it('Edit, on a row of a side that isn’t playing: the tape goes to that track, and the blanks open for it there', async () => {
    const page = tapePage({ sides: [{ position: 'A', tracks: OWN }, { position: 'B', tracks: OWN }], posted: [{ by: 'Josh', says: '[B 2:00] Butsch - The Count' }] });
    await page.read();
    await page.at(100);
    await page.user.click(page.button('Edit Butsch — The Count, at B 0:02:00'));
    expect(page.went).toHaveBeenCalledWith('B', 120);
  });

  it('has the + on a side only while that side is the one playing', async () => {
    const page = tapePage({ sides: [{ position: 'A', tracks: OWN }, { position: 'B', tracks: OWN }] });
    await page.read();
    await page.at(100);
    expect(page.pluses()).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'The Prodigy — Hyperspeed (G-Force Part 2) starts here' }).closest('ol')).toBe(within(page.tracklist() as HTMLElement).getAllByRole('list')[0]);
    await page.at(100, { side: 1 });
    expect(page.pluses()).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'The Prodigy — Hyperspeed (G-Force Part 2) starts here' }).closest('ol')).toBe(within(page.tracklist() as HTMLElement).getAllByRole('list')[1]);
  });
});

describe('the bar that posts a visitor’s times', () => {
  it('asks a first-time visitor’s name in the bar itself, and posts under it', async () => {
    const page = tapePage({ sides: [{ position: 'A', tracks: OWN }], name: null });
    await page.read();
    await page.at(221);
    await page.user.click(page.plus('Butsch — The Count'));
    const bar = () => page.bar() as HTMLElement;
    expect(bar()).toHaveTextContent('1 ID pending');
    expect(bar()).not.toHaveTextContent(' as ');

    await page.user.click(within(bar()).getByRole('button', { name: 'Post' }));
    expect(within(bar()).getByRole('alert')).toHaveTextContent('Enter your name.');
    expect(within(bar()).getByRole('textbox', { name: 'Your name' })).toHaveFocus();
    expect(page.posts()).toEqual([]);

    await page.user.type(within(bar()).getByRole('textbox', { name: 'Your name' }), 'Dana{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[3:41] Butsch - The Count']));
    await waitFor(() => expect(page.bar()).toBeNull());
    expect(screen.getAllByRole('status').some((status) => status.textContent === 'Posted 1 ID. Thanks.')).toBe(true);
    expect(window.localStorage.getItem('simfonik:id-name')).toBe('Dana');
  });

  it('marks the place for the player’s bar after the tracklist’s rows, where the Tab key will come to it', async () => {
    // An ID has been posted, so the tracklist has its History under the rows.
    const page = tapePage({ sides: [{ position: 'A', tracks: OWN }], posted: [{ by: 'Josh', says: '[0:00] The Prodigy - Hyperspeed (G-Force Part 2)' }] });
    await page.read();
    const home = page.shared().barHome as HTMLElement;
    const after = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const rows = within(page.tracklist() as HTMLElement).getAllByRole('listitem');
    expect(after(rows[rows.length - 1], home)).toBe(true);
    expect(after(home, screen.getByRole('button', { name: /^History/ }))).toBe(true);
  });

  it('is the start of the player’s bar while that is at the foot of a wide window, and a strip of its own again when it goes; it posts from there all the same', async () => {
    const page = tapePage({ sides: [{ position: 'A', tracks: OWN }], name: null });
    await page.read();
    await page.at(221);
    await page.user.click(page.plus('Butsch — The Count'));
    const bar = () => page.bar() as HTMLElement;
    expect(bar()).toHaveClass('tracklist-post');

    // The player's bar comes, with a place at its start (PlayerControls.tsx).
    const lead = document.body.appendChild(document.createElement('div'));
    act(() => page.shared().setBarLead(lead));
    expect(lead).toContainElement(bar());
    expect(screen.getAllByRole('form', { name: 'Post your IDs' })).toHaveLength(1);
    expect(bar()).not.toHaveClass('tracklist-post');
    expect(bar()).toHaveTextContent('1 ID pending');

    // What was typed in one is in the other, and the keyboard with it: the name is the tracklist's, not the bar's.
    await page.user.type(within(bar()).getByRole('textbox', { name: 'Your name' }), 'Dan');
    act(() => page.shared().setBarLead(null));
    expect(lead).toBeEmptyDOMElement();
    expect(bar()).toHaveClass('tracklist-post');
    expect(within(bar()).getByRole('textbox', { name: 'Your name' })).toHaveValue('Dan');
    expect(within(bar()).getByRole('textbox', { name: 'Your name' })).toHaveFocus();

    act(() => page.shared().setBarLead(lead));
    expect(within(bar()).getByRole('textbox', { name: 'Your name' })).toHaveFocus();
    await page.user.type(within(bar()).getByRole('textbox', { name: 'Your name' }), 'a{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[3:41] Butsch - The Count']));
    await waitFor(() => expect(page.bar()).toBeNull());
    expect(lead).toBeEmptyDOMElement();
  });
});

describe('the tracklist’s history', () => {
  const posted = [
    { by: 'Rents', says: 'what a tape' },
    { by: 'Josh', says: '[0:00] The Prodigy - Hyperspeed (G-Force Part 2)' },
    { by: 'Dana', says: '[3:41] Butsch - The Count\n[6:43] Rhythm For Reasons - Grand National' },
    { by: 'Softboiled', says: 'The track at 12:34 is Moby - Go' },
    { by: 'Josh', says: '[6:43] no track starts here' },
  ];

  it('says what the list had a track down as, where a post gave it another name', async () => {
    const page = tapePage({ sides: [{ position: 'A', tracks: OWN }], posted: [{ by: 'Dana', says: '[3:41] Butsch - The Count (Remix) [was Butsch - The Count]' }] });
    await page.read();
    const history = await screen.findByRole('button', { name: 'History · 1 post' });
    await page.user.click(history);
    const log = document.getElementById(history.getAttribute('aria-controls') as string) as HTMLElement;
    expect(within(log).getByRole('listitem')).toHaveTextContent('0:03:41 Butsch — The Count (Remix) (was Butsch — The Count)Dana');
  });

  it('is every post of IDs in the site’s form, newest first, shut until asked for, and none of them is in the comments', async () => {
    const page = tapePage({ sides: [{ position: 'A', tracks: OWN }], posted });
    await page.read();
    const history = await screen.findByRole('button', { name: 'History · 3 posts' });
    expect(history).toHaveAttribute('aria-expanded', 'false');
    const log = document.getElementById(history.getAttribute('aria-controls') as string) as HTMLElement;
    expect(log).not.toBeVisible();

    await page.user.click(history);
    expect(history).toHaveAttribute('aria-expanded', 'true');
    expect(within(log).getAllByRole('listitem').map((entry) => entry.textContent)).toEqual([
      '0:06:43 RemovedJosh · Nov 15, 2026',
      '0:03:41 Butsch — The Count0:06:43 Rhythm For Reasons — Grand NationalDana · Nov 15, 2026',
      '0:00:00 The Prodigy — Hyperspeed (G-Force Part 2)Josh · Nov 15, 2026',
    ]);
    await page.user.click(within(log).getByRole('button', { name: 'Play from 0:03:41' }));
    expect(page.went).toHaveBeenCalledWith(null, 221);

    const talk = screen.getByTestId('comments');
    expect(within(talk).getByText('what a tape')).toBeInTheDocument();
    // An ID said in a sentence is talk; only the site's own form is a post of IDs.
    expect(within(talk).getByText('The track at 12:34 is Moby - Go')).toBeInTheDocument();
    expect(within(talk).queryByText(/Butsch|Hyperspeed|no track starts here/)).not.toBeInTheDocument();
    // The removal is read, so the third line has lost the time it was given; and the ID said in a sentence is read too.
    expect(page.rows()).toEqual(['0:00:00The Prodigy — Hyperspeed (G-Force Part 2)', '0:03:41Butsch — The Count(4:10)', '0:12:34Moby — Go', '03Rhythm For Reasons — Grand National']);
  });

  it('is not there on a tape nobody has ID’d through the site', async () => {
    const page = tapePage({ sides: [{ position: 'A', tracks: OWN }], posted: posted.slice(0, 1) });
    await page.read();
    await screen.findByText('what a tape');
    expect(page.has(/^History/)).toBe(false);
  });
});
