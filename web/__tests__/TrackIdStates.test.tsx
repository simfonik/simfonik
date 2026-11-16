// Every state a track on a tape can be in, against everything a visitor can do to it, on every part of the
// page that shows it: the line under the player (or the tray, on a phone), the marks on the waveform, the
// tracklist's rows and the bar that posts. One working-out of the side feeds all of them
// (lib/track-ids/side.ts), and these are the rules it is held to as a visitor meets them.
//
// The page is the real one's parts over a server that reads what is posted with the real reader (./tape), so
// "after it is posted" here means after the site itself has read the comment back.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hold, KEPT, old, tapePage } from './tape';

const OWN = [
  { artist: 'The Prodigy', title: 'Hyperspeed' },
  { artist: 'Butsch', title: 'The Count' },
  { artist: 'Rhythm For Reasons', title: 'Grand National' },
  { artist: 'Phenomania', title: 'Caramelle' },
];
const LISTED = [{ position: 'A', tracks: OWN }];

const artist = () => screen.getByRole('textbox', { name: 'Artist' });
const title = () => screen.getByRole('textbox', { name: 'Title' });
const NEW_UNKNOWN = /^New unknown/;
const NEW_ID = /^New ID/;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a moment with nothing marked', () => {
  it('reads as nothing everywhere, and offers nothing that needs the tape to have been played until it has', async () => {
    const page = tapePage({ sides: LISTED });
    await page.read();
    expect(page.line()).toBe('Know this track? ID it');
    expect(page.marks()).toBe('');
    expect(page.rows()).toEqual(['01The Prodigy — Hyperspeed', '02Butsch — The Count', '03Rhythm For Reasons — Grand National', '04Phenomania — Caramelle']);
    expect(page.lit()).toBeNull();
    expect(page.bar()).toBeNull();
    expect(page.pluses()).toEqual([]);

    await page.at(100);
    expect(page.line()).toBe('Know this track? ID itNew unknown');
    expect(page.pluses()).toEqual(['The Prodigy — Hyperspeed', 'Butsch — The Count', 'Rhythm For Reasons — Grand National', 'Phenomania — Caramelle']);
    expect(page.lit()).toBeNull();
  });

  it('New unknown: one press sets a point there, the visitor’s own, on every part of the page and nowhere else', async () => {
    const page = tapePage();
    await page.read();
    expect(page.tracklist()).toBeNull();
    await page.at(100.7);
    await page.user.click(page.button(NEW_UNKNOWN));

    expect(page.line()).toBe('Unknown track. Know it? ID itNot posted');
    expect(page.marks()).toBe('100?');
    expect(page.rows()).toEqual(['0:01:40Unknown trackUndo']);
    expect(page.lit()).toBe('0:01:40Unknown trackUndo');
    expect(page.bar()).toHaveTextContent('1 time not posted as Dana');
    expect(screen.getByRole('button', { name: 'Play from 0:01:40, your time, not posted yet' })).toBeInTheDocument();
    expect(page.posts()).toEqual([]);
  });

  it('ID it: the blanks post an ID at this moment, and it is on every part of the page as posted before the comments are read again', async () => {
    const page = tapePage();
    await page.read();
    await page.at(100.7);
    await page.user.click(page.button('Know this track? ID it'));
    expect(screen.getByRole('form', { name: 'ID the track at 0:01:40' })).toBeInTheDocument();
    const reading = hold(page.server);
    await page.user.type(artist(), 'Orbital');
    await page.user.type(title(), 'Chime{Enter}');

    await waitFor(() => expect(page.posts()).toEqual(['[1:40] Orbital - Chime']));
    const posted = () => {
      expect(page.line()).toBe('Orbital — Chime');
      expect(page.marks()).toBe('100');
      expect(page.rows()).toEqual(['0:01:40Orbital — Chime']);
      expect(page.bar()).toBeNull();
      expect(within(page.tracklist() as HTMLElement).getByText('Dana')).toBeInTheDocument();
    };
    await waitFor(posted);
    // The comments come back saying the same.
    reading.go();
    await waitFor(() => expect(page.reads()).toBe(2));
    await waitFor(() => expect(page.shared().sides[0].rows[0].mine).toBeUndefined());
    posted();
  });

  it('+ on a line of the list: gives the line this moment, the visitor’s own, on every part of the page', async () => {
    const page = tapePage({ sides: LISTED });
    await page.read();
    await page.at(221.9);
    await page.user.click(page.plus('Butsch — The Count'));

    expect(page.rows()).toEqual(['01The Prodigy — Hyperspeed', '0:03:41Butsch — The CountUndo', '03Rhythm For Reasons — Grand National', '04Phenomania — Caramelle']);
    expect(page.line()).toBe('Butsch — The CountNot posted');
    expect(page.marks()).toBe('221');
    expect(page.lit()).toBe('0:03:41Butsch — The CountUndo');
    expect(page.bar()).toHaveTextContent('1 time not posted as Dana');
    // It is not the side's yet: nothing is counted as timed, and nobody is credited.
    expect(screen.getByText('0 of 4 timed')).toBeInTheDocument();
    expect(screen.queryByText(/^IDs by/)).not.toBeInTheDocument();
    expect(page.posts()).toEqual([]);
  });

  it('within a moment of a mark’s start, is that mark: nothing new can start, and ID it is about the mark', async () => {
    const page = tapePage({ posted: [{ by: 'Josh', says: '[5:00] ? - ?' }] });
    await page.read();
    // Three seconds before it: nothing is playing yet, and what is said here is said of the mark.
    await page.at(297);
    expect(page.line()).toBe('Know this track? ID it');
    expect(page.has(NEW_UNKNOWN)).toBe(false);
    await page.user.click(page.button('Know this track? ID it'));
    expect(screen.getByRole('form', { name: 'ID the track at 0:05:00' })).toBeInTheDocument();
    expect(page.has('Remove this mark')).toBe(true);
  });
});

describe('a point the visitor marked without a name, not yet posted', () => {
  const marked = async (setup: Parameters<typeof tapePage>[0] = {}) => {
    const page = tapePage(setup);
    await page.read();
    await page.at(100);
    await page.user.click(page.button(NEW_UNKNOWN));
    return page;
  };

  it('Undo, on its row: takes it back everywhere, and nothing was ever posted', async () => {
    const page = await marked();
    await page.user.click(page.button('Take back the mark at 0:01:40'));
    expect(page.line()).toBe('Know this track? ID itNew unknown');
    expect(page.marks()).toBe('');
    expect(page.tracklist()).toBeNull();
    expect(page.bar()).toBeNull();
    expect(page.posts()).toEqual([]);
  });

  it('Remove this mark, in the blanks: the same, with no post', async () => {
    const page = await marked();
    await page.at(130);
    await page.user.click(page.button('Unknown track. Know it? ID it'));
    // It is the visitor's own: there is nowhere to move it, only taking it back.
    expect(page.has(/instead$/)).toBe(false);
    await page.user.click(page.button('Remove this mark'));
    expect(page.rows()).toEqual([]);
    expect(page.marks()).toBe('');
    expect(page.bar()).toBeNull();
    expect(page.posts()).toEqual([]);
  });

  it('ID it: posts the ID at once, from where the point was marked, and the point no longer waits to be posted', async () => {
    const page = await marked();
    await page.at(180);
    await page.user.click(page.button('Unknown track. Know it? ID it'));
    expect(screen.getByRole('form', { name: 'ID the track at 0:01:40' })).toBeInTheDocument();
    await page.user.type(artist(), 'Orbital');
    await page.user.type(title(), 'Chime{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[1:40] Orbital - Chime']));
    await waitFor(() => expect(page.rows()).toEqual(['0:01:40Orbital — Chime']));
    expect(page.bar()).toBeNull();
    expect(page.shared().unposted).toEqual([]);
  });

  it('a second, later: is refused within a moment of the first, and then is a second row in order of time', async () => {
    const page = await marked();
    await page.at(104);
    expect(page.has(NEW_UNKNOWN)).toBe(false);
    await page.at(40);
    await page.user.click(page.button(NEW_UNKNOWN));
    expect(page.rows()).toEqual(['0:00:40Unknown trackUndo', '0:01:40Unknown trackUndo']);
    expect(page.marks()).toBe('40? 100?');
    expect(page.bar()).toHaveTextContent('2 times not posted');
  });

  it('Post: goes up with the rest as one comment, and stays on the page, as posted, while the comments are read again', async () => {
    const page = await marked();
    await page.at(40);
    await page.user.click(page.button(NEW_UNKNOWN));
    const reading = hold(page.server);
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));

    await waitFor(() => expect(page.posts()).toEqual(['[0:40] ? - ?\n[1:40] ? - ?']));
    const posted = () => {
      // Each is now anyone's to ID, and no longer the visitor's to take back.
      expect(page.rows()).toEqual(['0:00:40Unknown trackID it', '0:01:40Unknown trackID it']);
      expect(page.marks()).toBe('40? 100?');
      expect(page.line()).toBe('Unknown track. Know it? ID it');
      expect(page.bar()).toBeNull();
    };
    await waitFor(posted);
    reading.go();
    await waitFor(() => expect(page.reads()).toBe(2));
    await waitFor(() => expect(page.shared().sides[0].rows.every((row) => !row.mine)).toBe(true));
    posted();
    expect(window.localStorage.getItem(KEPT)).toBeNull();
  });

  it('is still the visitor’s after a reload', async () => {
    const page = await marked();
    const kept = window.localStorage.getItem(KEPT) as string;
    page.unmount();

    const back = tapePage({ kept });
    await back.read();
    await waitFor(() => expect(back.rows()).toEqual(['0:01:40Unknown trackUndo']));
    expect(back.marks()).toBe('100?');
    expect(back.bar()).toHaveTextContent('1 time not posted');
  });
});

describe('the blanks, open for a mark while the mark changes', () => {
  it('act on the mark as it is now: one the visitor posts from the bar is then taken away with a post, not just forgotten', async () => {
    const page = tapePage();
    await page.read();
    await page.at(100);
    await page.user.click(page.button(NEW_UNKNOWN));
    await page.at(130);
    await page.user.click(page.button('Unknown track. Know it? ID it'));
    // With the blanks still open, the visitor posts what they have.
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(page.posts()).toEqual(['[1:40] ? - ?']));
    await waitFor(() => expect(page.bar()).toBeNull());

    await page.user.click(page.button('Remove this mark'));
    await waitFor(() => expect(page.posts()).toEqual(['[1:40] ? - ?', '[1:40] no track starts here']));
    await waitFor(() => expect(page.rows()).toEqual([]));
  });
});

describe('a line of the list the visitor has given a time, not yet posted', () => {
  const timed = async () => {
    const page = tapePage({ sides: LISTED, posted: [{ by: 'Josh', says: '[0:00] The Prodigy - Hyperspeed' }] });
    await page.read();
    await page.at(221);
    await page.user.click(page.plus('Butsch — The Count'));
    return page;
  };

  it('is the track playing from there, and the track before it ends where it starts', async () => {
    const page = await timed();
    expect(page.marks()).toBe('0 221');
    await page.at(200);
    expect(page.lit()).toBe('0:00:00The Prodigy — Hyperspeed');
    expect(page.line()).toBe('The Prodigy — HyperspeedNew IDNew unknown');
    await page.at(230);
    expect(page.lit()).toBe('0:03:41Butsch — The CountUndo');
    expect(page.line()).toBe('Butsch — The CountNot postedNew IDNew unknown');
    expect(screen.getByRole('button', { name: 'Now playing: Butsch — The Count. Correct this ID' })).toHaveAttribute('title', 'Yours, not posted yet. Press to correct it.');
  });

  it('Undo: the line is back to waiting, with its number', async () => {
    const page = await timed();
    await page.user.click(page.button('Take back the time for Butsch — The Count'));
    await page.at(400);
    expect(page.rows()).toEqual(['0:00:00The Prodigy — Hyperspeed', '+Butsch — The Count', '+Rhythm For Reasons — Grand National', '+Phenomania — Caramelle']);
    expect(page.marks()).toBe('0');
    expect(page.bar()).toBeNull();
  });

  it('keeps the list’s order: the + is then only on the lines that could start where the tape is', async () => {
    const page = await timed();
    // Before it, no other line can start: the first has its time, and the rest come after the second.
    await page.at(100);
    expect(page.pluses()).toEqual([]);
    await page.at(400);
    expect(page.pluses()).toEqual(['Rhythm For Reasons — Grand National', 'Phenomania — Caramelle']);
  });

  it('putting its name right, in the blanks: posts it at once at the time the visitor gave it', async () => {
    const page = await timed();
    await page.at(240);
    await page.user.click(page.button('Now playing: Butsch — The Count. Correct this ID'));
    expect(screen.getByRole('form', { name: 'ID the track at 0:03:41' })).toBeInTheDocument();
    expect(title()).toHaveValue('The Count');
    await page.user.type(title(), ' (Remix){Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[3:41] Butsch - The Count (Remix)']));
    await waitFor(() => expect(page.bar()).toBeNull());
    // The tape's own tracklist keeps its own words for the line; the time is now the side's.
    expect(page.rows()[1]).toBe('0:03:41Butsch — The Count');
  });

  it('Post: the line keeps its time through the reading of the comments, and is then the side’s', async () => {
    const page = await timed();
    const reading = hold(page.server);
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(page.posts()).toEqual(['[3:41] Butsch - The Count']));
    await waitFor(() => expect(page.rows()[1]).toBe('0:03:41Butsch — The Count'));
    expect(screen.getByText('2 of 4 timed')).toBeInTheDocument();
    expect(screen.getByText('Dana and Josh')).toBeInTheDocument();
    reading.go();
    await waitFor(() => expect(page.shared().sides[0].rows.every((row) => !row.mine)).toBe(true));
    expect(page.rows()[1]).toBe('0:03:41Butsch — The Count');
    expect(page.marks()).toBe('0 221');
  });
});

describe('a track the comments have ID’d', () => {
  const tape = (setup: Parameters<typeof tapePage>[0] = {}) => tapePage({ posted: [{ by: 'Josh', says: '[0:00] Orbital - Chime\n[5:00] Joey Beltram - Energy Flash' }], ...setup });

  it('is the track playing, with the two ways to say a new one starts, but not within a moment of a start', async () => {
    const page = tape();
    await page.read();
    await page.at(3);
    expect(page.line()).toBe('Orbital — Chime');
    await page.at(100);
    expect(page.line()).toBe('Orbital — ChimeNew IDNew unknown');
    expect(screen.getByRole('button', { name: 'Now playing: Orbital — Chime. Correct this ID' })).toHaveAttribute('title', 'ID by Josh. Press to correct it.');
    // Three seconds before the next track, what is said would be said of it.
    await page.at(297);
    expect(page.line()).toBe('Orbital — Chime');
    expect(page.rows()).toEqual(['0:00:00Orbital — Chime', '0:05:00Joey Beltram — Energy Flash']);
    expect(page.marks()).toBe('0 300');
  });

  it('its time, pressed: takes the tape there', async () => {
    const page = tape();
    await page.read();
    await page.user.click(page.button('Play from 0:05:00'));
    expect(page.went).toHaveBeenCalledWith(null, 300);
  });

  it('putting its name right: posts the new name at its start, and it reads so everywhere at once', async () => {
    const page = tape();
    await page.read();
    await page.at(100);
    await page.user.click(page.button('Now playing: Orbital — Chime. Correct this ID'));
    const reading = hold(page.server);
    await page.user.clear(title());
    await page.user.type(title(), 'Belfast{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[0:00] Orbital - Belfast']));
    await waitFor(() => expect(page.rows()).toEqual(['0:00:00Orbital — Belfast', '0:05:00Joey Beltram — Energy Flash']));
    expect(page.line()).toBe('Orbital — BelfastNew IDNew unknown');
    reading.go();
    await waitFor(() => expect(page.shared().sides[0].rows.every((row) => !row.mine)).toBe(true));
    expect(page.rows()).toEqual(['0:00:00Orbital — Belfast', '0:05:00Joey Beltram — Energy Flash']);
  });

  it('Remove this ID: posts that no track starts there, and it is gone everywhere at once', async () => {
    const page = tape();
    await page.read();
    await page.at(400);
    await page.user.click(page.button('Now playing: Joey Beltram — Energy Flash. Correct this ID'));
    const reading = hold(page.server);
    await page.user.click(page.button('Remove this ID'));
    await waitFor(() => expect(page.posts()).toEqual(['[5:00] no track starts here']));
    const gone = () => {
      expect(page.rows()).toEqual(['0:00:00Orbital — Chime']);
      expect(page.marks()).toBe('0');
      expect(page.line()).toBe('Know this track? ID itNew unknown');
    };
    await waitFor(gone);
    reading.go();
    await waitFor(() => expect(page.reads()).toBe(2));
    await waitFor(() => expect(page.shared().unposted).toEqual([]));
    gone();
  });

  it('Starts at … instead: moves it to where the tape is, in one post, and it is there everywhere at once', async () => {
    const page = tape();
    await page.read();
    await page.at(341.5);
    await page.user.click(page.button('Now playing: Joey Beltram — Energy Flash. Correct this ID'));
    const reading = hold(page.server);
    await page.user.click(page.button('Starts at 0:05:41 instead'));
    await waitFor(() => expect(page.posts()).toEqual(['[5:00] no track starts here\n[5:41] Joey Beltram - Energy Flash']));
    await waitFor(() => expect(page.rows()).toEqual(['0:00:00Orbital — Chime', '0:05:41Joey Beltram — Energy Flash']));
    expect(page.marks()).toBe('0 341');
    reading.go();
    await waitFor(() => expect(page.shared().sides[0].rows.every((row) => !row.mine)).toBe(true));
    expect(page.rows()).toEqual(['0:00:00Orbital — Chime', '0:05:41Joey Beltram — Energy Flash']);
  });

  it('New ID inside it: a new track from there, and this one ends where that starts', async () => {
    const page = tape();
    await page.read();
    await page.at(120);
    await page.user.click(page.button(NEW_ID));
    expect(artist()).toHaveValue('');
    await page.user.type(artist(), 'Altern 8');
    await page.user.type(title(), 'Infiltrate 202{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[2:00] Altern 8 - Infiltrate 202']));
    await waitFor(() => expect(page.rows()).toEqual(['0:00:00Orbital — Chime', '0:02:00Altern 8 — Infiltrate 202', '0:05:00Joey Beltram — Energy Flash']));
    await page.at(119);
    expect(page.lit()).toBe('0:00:00Orbital — Chime');
    await page.at(121);
    expect(page.lit()).toBe('0:02:00Altern 8 — Infiltrate 202');
  });
});

describe('a spot the comments have marked without a name', () => {
  const tape = (setup: Parameters<typeof tapePage>[0] = {}) => tapePage({ archive: [old('anyone know the track @5:00?')], ...setup });

  it('reads as an unknown track everywhere, by whoever marked it', async () => {
    const page = tape();
    await page.read();
    await page.at(310);
    expect(page.rows()).toEqual(['0:05:00Unknown trackID it']);
    expect(page.line()).toBe('Unknown track. Know it? ID itNew unknown');
    expect(page.marks()).toBe('300?');
    expect(screen.getByText('0 tracks ID’d · 1 unknown')).toBeInTheDocument();
  });

  it('ID it, on its row: takes the tape there and opens the blanks for it', async () => {
    const page = tape();
    await page.read();
    await page.at(20);
    await page.user.click(page.button('ID the unknown track at 0:05:00'));
    expect(page.went).toHaveBeenCalledWith(null, 300);
    expect(await screen.findByRole('form', { name: 'ID the track at 0:05:00' })).toBeInTheDocument();
  });

  it('naming it: posts the ID at its start, and the name fills the whole of it', async () => {
    const page = tape();
    await page.read();
    await page.at(400);
    await page.user.click(page.button('Unknown track. Know it? ID it'));
    await page.user.type(artist(), 'Orbital');
    await page.user.type(title(), 'Chime{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[5:00] Orbital - Chime']));
    await waitFor(() => expect(page.rows()).toEqual(['0:05:00Orbital — Chime']));
    await waitFor(() => expect(page.shared().sides[0].rows.every((row) => !row.mine)).toBe(true));
    expect(page.rows()).toEqual(['0:05:00Orbital — Chime']);
    expect(screen.getByText('1 track ID’d')).toBeInTheDocument();
  });

  it('Remove this mark: posts that no track starts there, and the tracklist goes with its last row', async () => {
    const page = tape();
    await page.read();
    await page.at(400);
    await page.user.click(page.button('Unknown track. Know it? ID it'));
    await page.user.click(page.button('Remove this mark'));
    await waitFor(() => expect(page.posts()).toEqual(['[5:00] no track starts here']));
    await waitFor(() => expect(page.tracklist()).toBeNull());
    await waitFor(() => expect(page.reads()).toBe(2));
    expect(page.rows()).toEqual([]);
  });
});

describe('the list’s order, and the one moment each track has', () => {
  it('never shows a side out of order of time, whatever is said of it', async () => {
    // The fourth line of the list, said to start before the second.
    const page = tapePage({ sides: LISTED, posted: [{ by: 'Josh', says: '[0:00] The Prodigy - Hyperspeed\n[3:41] Butsch - The Count\n[1:00] Phenomania - Caramelle' }] });
    await page.read();
    expect(page.rows()).toEqual(['0:00:00The Prodigy — Hyperspeed', '0:01:00Phenomania — Caramelle', '0:03:41Butsch — The Count', '03Rhythm For Reasons — Grand National', '04Phenomania — Caramelle']);
  });

  it('gives a mark with no name to the first line with no name that it could be, before and after it is posted', async () => {
    const page = tapePage({ archive: [old('Side 1\n1. Orbital - Chime\n2. ??\n3. LFO - LFO\n4. ??\n5. Altern 8 - Infiltrate 202', 'Josh')] });
    await page.read();
    // The reader takes the first line of a side's list to start the side.
    expect(page.rows()).toEqual(['0:00:00Orbital — Chime', '02Unknown track', '03LFO — LFO', '04Unknown track', '05Altern 8 — Infiltrate 202']);
    await page.at(300);
    // One unnamed line is as good as another: only the first has the +.
    expect(page.pluses()).toEqual(['Track 2', 'LFO — LFO', 'Altern 8 — Infiltrate 202']);
    await page.user.click(page.plus('Track 2'));
    expect(page.rows()[1]).toBe('0:05:00Unknown trackUndo');
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(page.posts()).toEqual(['[5:00] ? - ?']));
    await waitFor(() => expect(page.shared().sides[0].rows.every((row) => !row.mine)).toBe(true));
    expect(page.rows()[1]).toBe('0:05:00Unknown trackID it');
  });
});

describe('a tape with sides', () => {
  const AB = [{ position: 'A', tracks: OWN.slice(0, 2) }, { position: 'B', tracks: OWN.slice(2) }];

  it('keeps each side’s tracks to that side, and says which side in what it posts', async () => {
    const page = tapePage({ sides: AB });
    await page.read();
    await page.at(60, { side: 1 });
    await page.user.click(page.plus('Rhythm For Reasons — Grand National'));
    expect(page.rows()).toEqual(['01The Prodigy — Hyperspeed', '02Butsch — The Count', '0:01:00Rhythm For Reasons — Grand NationalUndo', '02Phenomania — Caramelle']);
    expect(screen.getByRole('button', { name: 'Play from B 0:01:00, your time, not posted yet' })).toBeInTheDocument();
    expect(page.marks()).toBe('60');
    // Side A, loaded, knows nothing of it.
    await page.at(60, { side: 0 });
    expect(page.marks()).toBe('');
    expect(page.line()).toBe('Know this track? ID itNew unknown');
    expect(page.lit()).toBeNull();
    await page.user.click(page.button(NEW_UNKNOWN));
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(page.posts()).toEqual(['[A 1:00] ? - ?\n[B 1:00] Rhythm For Reasons - Grand National']));
  });
});

describe('when the comments change underneath the visitor', () => {
  it('lets go of an unposted time the comments have since come to give themselves', async () => {
    const page = tapePage({ sides: LISTED });
    await page.read();
    await page.at(221);
    await page.user.click(page.plus('Butsch — The Count'));
    expect(page.bar()).toHaveTextContent('1 time not posted');
    // Someone else posts that line's time, two seconds off, and the page reads the comments again.
    page.server.comments.push({ id: 99, tape_id: 'tape-1', author_name: 'Softboiled', content: '[3:43] Butsch - The Count', created_at: '2026-11-15T13:00:00.000Z' });
    await waitFor(() => page.shared().reread());
    await waitFor(() => expect(page.rows()[1]).toBe('0:03:43Butsch — The Count'));
    expect(page.bar()).toBeNull();
    expect(page.shared().unposted).toEqual([]);
  });

  it('says so, quietly, where the newer comments couldn’t be read, and shows what the archive has', async () => {
    const page = tapePage({ archive: [old('anyone know the track @5:00?')], down: true });
    await page.read();
    await waitFor(() => expect(page.rows()).toEqual(['0:05:00Unknown trackID it']));
    expect(screen.getByText('The latest IDs couldn’t be read just now, so some may be missing here.')).toBeInTheDocument();
  });

  it('keeps everything as it was when a post is refused, and says why', async () => {
    const page = tapePage();
    await page.read();
    await page.at(100);
    await page.user.click(page.button(NEW_UNKNOWN));
    page.server.refuse = 'Too many requests. Please try again later.';
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    expect(await within(page.bar() as HTMLElement).findByRole('alert')).toHaveTextContent('Too many requests. Please try again later.');
    expect(page.rows()).toEqual(['0:01:40Unknown trackUndo']);
    expect(page.shared().unposted).toHaveLength(1);
    expect(page.reads()).toBe(1);
  });
});

describe('on a phone, where the tray says what the line does', () => {
  it('has each state as the line has it', async () => {
    const page = tapePage({ sides: LISTED, phone: true, posted: [{ by: 'Josh', says: '[0:00] The Prodigy - Hyperspeed' }] });
    await page.read();
    expect(page.tray()).toBeNull();

    await page.at(60);
    expect(page.tray()).toHaveTextContent('The Prodigy0:01:00HyperspeedFix IDNew unknown');
    await page.at(300);
    expect(page.tray()).toHaveTextContent('Nothing ID’d here yet0:05:00Know this track? ID it.ID itNew unknown');

    await page.user.click(page.plus('Butsch — The Count'));
    await page.at(310);
    expect(page.tray()).toHaveTextContent('Butsch0:05:10The CountNot postedFix IDNew unknown');

    await page.at(500);
    await page.user.click(within(page.tray() as HTMLElement).getByRole('button', { name: NEW_UNKNOWN }));
    expect(page.tray()).toHaveTextContent('Unknown track0:08:20Marked by youNot postedID itNew unknown');
    expect(within(page.tray() as HTMLElement).getByRole('button', { name: NEW_UNKNOWN })).toHaveAttribute('aria-disabled', 'true');
    expect(page.bar()).toHaveTextContent('2 times not posted');
  });
});
