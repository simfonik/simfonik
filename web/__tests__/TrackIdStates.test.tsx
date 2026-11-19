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
/** The tray's one way to say a track starts here: a phone has no room for two. */
const NEW_TRACK = /^New track/;

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
    expect(page.line()).toBe('Know this track? ID itNew track');
    expect(page.pluses()).toEqual(['The Prodigy — Hyperspeed', 'Butsch — The Count', 'Rhythm For Reasons — Grand National', 'Phenomania — Caramelle']);
    expect(page.lit()).toBeNull();
  });

  it('New track, then Mark unknown: sets a point there, the visitor’s own, on every part of the page and nowhere else', async () => {
    const page = tapePage();
    await page.read();
    expect(page.tracklist()).toBeNull();
    await page.at(100.7);
    await page.mark();

    expect(page.line()).toBe('Unknown track. Know it? ID itPending');
    expect(page.marks()).toBe('100?');
    expect(page.rows()).toEqual(['0:01:40Unknown trackUndo']);
    expect(page.lit()).toBe('0:01:40Unknown trackUndo');
    expect(page.bar()).toHaveTextContent('1 ID pending');
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
    expect(page.line()).toBe('Butsch — The CountPending');
    expect(page.marks()).toBe('221');
    expect(page.lit()).toBe('0:03:41Butsch — The CountUndo');
    expect(page.bar()).toHaveTextContent('1 ID pending');
    // It is not the side's yet: nothing is counted as timed, and nobody is credited.
    expect(screen.getByText('0 of 4 timed')).toBeInTheDocument();
    expect(screen.queryByText(/^IDs by/)).not.toBeInTheDocument();
    expect(page.posts()).toEqual([]);
  });

  it('on the second a mark starts, is that mark: nothing new can start, and ID it is about the mark', async () => {
    const page = tapePage({ posted: [{ by: 'Josh', says: '[5:00] ? - ?' }] });
    await page.read();
    // A second before it nothing is playing yet, and a track of its own could start: two can be that close.
    await page.at(299);
    expect(page.line()).toBe('Know this track? ID itNew track');
    await page.at(300.4);
    expect(page.line()).toBe('Unknown track. Know it? ID it');
    expect(page.has(NEW_TRACK)).toBe(false);
    await page.user.click(page.button('Unknown track. Know it? ID it'));
    expect(screen.getByRole('form', { name: 'ID the track at 0:05:00' })).toBeInTheDocument();
    expect(page.has('Remove this mark')).toBe(true);
  });
});

describe('a side’s last second, where no track has room to start', () => {
  const SHORT = [{ position: 'A', tracks: OWN, length: 900.5 }];

  it('offers no new track, on the line or on a row, and nothing to ID where nothing is marked', async () => {
    const page = tapePage({ sides: SHORT, length: 900.5 });
    await page.read();
    // A second from the end a track can still start, and be the side's last.
    await page.at(899);
    expect(page.has(NEW_TRACK)).toBe(true);
    expect(page.pluses()).toHaveLength(4);
    await page.at(900.2);
    expect(page.has(NEW_TRACK)).toBe(false);
    expect(page.pluses()).toEqual([]);
    expect(page.button('Know this track? ID it')).toHaveAttribute('aria-disabled', 'true');
    await page.user.click(page.button('Know this track? ID it'));
    expect(screen.queryByRole('textbox', { name: 'Artist' })).not.toBeInTheDocument();
  });

  it('still lets a track that is playing there be ID’d: that is said of where it starts', async () => {
    const page = tapePage({ sides: SHORT, length: 900.5, posted: [{ by: 'Josh', says: '[14:00] ? - ?' }] });
    await page.read();
    await page.at(900.2);
    expect(page.line()).toBe('Unknown track. Know it? ID it');
    await page.user.click(page.button('Unknown track. Know it? ID it'));
    expect(screen.getByRole('form', { name: 'ID the track at 0:14:00' })).toBeInTheDocument();
  });

  it('is the same on a phone: the tray’s buttons keep their places and do nothing', async () => {
    const page = tapePage({ sides: SHORT, length: 900.5, phone: true });
    await page.read();
    await page.at(900.2);
    const tray = within(page.tray() as HTMLElement);
    expect(tray.getByRole('button', { name: 'ID it' })).toHaveAttribute('aria-disabled', 'true');
    expect(tray.getByRole('button', { name: NEW_TRACK })).toHaveAttribute('aria-disabled', 'true');
    await page.user.click(tray.getByRole('button', { name: 'ID it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('a point the visitor marked without a name, not yet posted', () => {
  const marked = async (setup: Parameters<typeof tapePage>[0] = {}) => {
    const page = tapePage(setup);
    await page.read();
    await page.at(100);
    await page.mark();
    return page;
  };

  it('Undo, on its row: takes it back everywhere, and nothing was ever posted', async () => {
    const page = await marked();
    await page.user.click(page.button('Take back the mark at 0:01:40'));
    expect(page.line()).toBe('Know this track? ID itNew track');
    expect(page.marks()).toBe('');
    expect(page.tracklist()).toBeNull();
    expect(page.bar()).toBeNull();
    expect(page.posts()).toEqual([]);
  });

  it('Use, then Post: it is moved to where the tape is, still the visitor’s own, and nothing is posted', async () => {
    const page = await marked();
    await page.at(130);
    await page.user.click(page.button('Unknown track. Know it? ID it'));
    await page.user.click(page.button('Use 0:02:10, the tape’s time'));
    // Nothing has moved until it is posted.
    expect(page.marks()).toBe('100?');
    await page.user.type(screen.getByRole('textbox', { name: 'Starts at' }), '{Enter}');
    expect(page.rows()).toEqual(['0:02:10Unknown trackUndo']);
    expect(page.marks()).toBe('130?');
    expect(page.bar()).toHaveTextContent('1 ID pending');
    expect(page.posts()).toEqual([]);
  });

  it('a time typed over its own, in the blanks: it is moved there, still the visitor’s own, and nothing is posted', async () => {
    const page = await marked();
    await page.at(130);
    await page.user.click(page.button('Unknown track. Know it? ID it'));
    const time = screen.getByRole('textbox', { name: 'Starts at' });
    await page.user.clear(time);
    await page.user.type(time, '1:35{Enter}');
    expect(page.rows()).toEqual(['0:01:35Unknown trackUndo']);
    expect(page.bar()).toHaveTextContent('1 ID pending');
    expect(page.posts()).toEqual([]);
  });

  it('Edit, on its row: the blanks open there, and its time typed over moves it, still the visitor’s own', async () => {
    const page = await marked();
    await page.user.click(page.button('Edit your mark, at 0:01:40'));
    const blanks = screen.getByRole('form', { name: 'ID the track at 0:01:40' });
    expect(blanks.closest('li')).toBe(within(page.tracklist() as HTMLElement).getAllByRole('listitem')[0]);
    // Its way back is in the blanks too.
    expect(within(blanks).getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    const time = screen.getByRole('textbox', { name: 'Starts at' });
    await page.user.clear(time);
    await page.user.type(time, '1:30{Enter}');
    expect(page.rows()).toEqual(['0:01:30Unknown trackUndo']);
    expect(page.bar()).toHaveTextContent('1 ID pending');
    expect(page.posts()).toEqual([]);
  });

  it('Undo, in the blanks: the same, with no post', async () => {
    const page = await marked();
    await page.at(130);
    await page.user.click(page.button('Unknown track. Know it? ID it'));
    // It is the visitor's own: there is nothing to remove with a post, only taking it back.
    expect(page.has(/^Remove/)).toBe(false);
    await page.user.click(within(screen.getByRole('form', { name: 'ID the track at 0:01:40' })).getByRole('button', { name: 'Undo' }));
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

  it('a second, later: is refused on the second of the first, and a second on is a second row in order of time', async () => {
    const page = await marked();
    await page.at(100.6);
    expect(page.has(NEW_TRACK)).toBe(false);
    await page.at(101);
    await page.mark();
    expect(page.rows()).toEqual(['0:01:40Unknown trackUndo', '0:01:41Unknown trackUndo']);
    await page.at(40);
    await page.mark();
    expect(page.rows()).toEqual(['0:00:40Unknown trackUndo', '0:01:40Unknown trackUndo', '0:01:41Unknown trackUndo']);
    expect(page.marks()).toBe('40? 100? 101?');
    expect(page.bar()).toHaveTextContent('3 IDs pending');
  });

  it('Post: goes up with the rest as one comment, and stays on the page, as posted, while the comments are read again', async () => {
    const page = await marked();
    await page.at(40);
    await page.mark();
    const reading = hold(page.server);
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));

    await waitFor(() => expect(page.posts()).toEqual(['[0:40] ? - ?\n[1:40] ? - ?']));
    const posted = () => {
      // Each is now anyone's to ID, and no longer the visitor's to take back.
      expect(page.rows()).toEqual(['0:00:40Unknown track+ ID', '0:01:40Unknown track+ ID']);
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
    expect(back.bar()).toHaveTextContent('1 ID pending');
  });
});

describe('the blanks, open for a mark while the mark changes', () => {
  it('act on the mark as it is now: one the visitor posts from the bar is then taken away with a post, not just forgotten', async () => {
    const page = tapePage();
    await page.read();
    await page.at(100);
    await page.mark();
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
    expect(page.line()).toBe('The Prodigy — HyperspeedNew track');
    await page.at(230);
    expect(page.lit()).toBe('0:03:41Butsch — The CountUndo');
    expect(page.line()).toBe('Butsch — The CountPendingNew track');
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

  it('says a time given with + and one taken back, and after Undo from the keyboard the keyboard is on Edit, beside where Undo was', async () => {
    const page = await timed();
    const said = (text: string) => screen.getAllByRole('status').some((status) => status.textContent === text);
    expect(said('Marked 0:03:41. Not posted yet.')).toBe(true);
    page.button('Take back the time for Butsch — The Count').focus();
    await page.user.keyboard('{Enter}');
    expect(said('Taken back: 0:03:41.')).toBe(true);
    expect(page.button('Edit Butsch — The Count')).toHaveFocus();
  });

  it('Undo with a mouse leaves the keyboard where it was', async () => {
    const page = await timed();
    await page.user.click(page.button('Take back the time for Butsch — The Count'));
    expect(document.body).toHaveFocus();
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
    // The ID says which line of the list it is, so the line is that line still, under the name typed.
    await waitFor(() => expect(page.posts()).toEqual(['[3:41] Butsch - The Count (Remix) [was Butsch - The Count]']));
    await waitFor(() => expect(page.bar()).toBeNull());
    expect(page.rows().slice(0, 2)).toEqual(['0:00:00The Prodigy — Hyperspeed', '0:03:41Butsch — The Count (Remix)']);
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

  it('is the track playing, with the two ways to say a new one starts, but not on the second it starts', async () => {
    const page = tape();
    await page.read();
    await page.at(0.6);
    expect(page.line()).toBe('Orbital — Chime');
    await page.at(100);
    expect(page.line()).toBe('Orbital — ChimeNew track');
    expect(screen.getByRole('button', { name: 'Now playing: Orbital — Chime. Correct this ID' })).toHaveAttribute('title', 'ID by Josh. Press to correct it.');
    // A second before the next track, one of its own could still start.
    await page.at(299);
    expect(page.line()).toBe('Orbital — ChimeNew track');
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
    expect(page.line()).toBe('Orbital — BelfastNew track');
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
    // What played before it plays on: the tape is still within the ten minutes that one is taken to play.
    const gone = () => {
      expect(page.rows()).toEqual(['0:00:00Orbital — Chime']);
      expect(page.marks()).toBe('0');
      expect(page.line()).toBe('Orbital — ChimeNew track');
    };
    await waitFor(gone);
    reading.go();
    await waitFor(() => expect(page.reads()).toBe(2));
    await waitFor(() => expect(page.shared().unposted).toEqual([]));
    gone();
  });

  const startsAt = () => screen.getByRole('textbox', { name: 'Starts at' });
  const retime = async (page: ReturnType<typeof tape>, to: string) => {
    await page.user.clear(startsAt());
    await page.user.type(startsAt(), `${to}{Enter}`);
  };

  it('Edit, on its row: the blanks open in the row, with its time a blank, and the tape is left where it is', async () => {
    const page = tape();
    await page.read();
    await page.at(100);
    await page.user.click(page.button('Edit Joey Beltram — Energy Flash, at 0:05:00'));
    const blanks = screen.getByRole('form', { name: 'ID the track at 0:05:00' });
    expect(blanks.closest('li')).toBe(within(page.tracklist() as HTMLElement).getAllByRole('listitem')[1]);
    expect(startsAt()).toHaveValue('0:05:00');
    expect(artist()).toHaveValue('Joey Beltram');
    expect(artist()).toHaveFocus();
    expect(page.went).not.toHaveBeenCalled();
    // The line under the player is as it was.
    expect(page.line()).toBe('Orbital — ChimeNew track');
    // Escape shuts them, and the keyboard is back on the row's "Edit".
    await page.user.keyboard('{Escape}');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(page.button('Edit Joey Beltram — Energy Flash, at 0:05:00')).toHaveFocus();
  });

  it('Edit on another row while one row’s blanks are open: they open for that row, and the keyboard goes into them', async () => {
    const page = tape();
    await page.read();
    await page.at(100);
    await page.user.click(page.button('Edit Joey Beltram — Energy Flash, at 0:05:00'));
    expect(artist()).toHaveFocus();
    await page.user.click(page.button('Edit Orbital — Chime, at 0:00:00'));
    expect(screen.getByRole('form', { name: 'ID the track at 0:00:00' })).toBeInTheDocument();
    expect(artist()).toHaveValue('Orbital');
    expect(artist()).toHaveFocus();
  });

  it('a time typed in figures alone, as a phone’s number keys give it: read as minutes and seconds', async () => {
    const page = tape();
    await page.read();
    await page.at(100);
    await page.user.click(page.button('Edit Joey Beltram — Energy Flash, at 0:05:00'));
    await retime(page, '610');
    await waitFor(() => expect(page.posts()).toEqual(['[5:00] no track starts here\n[6:10] Joey Beltram - Energy Flash']));
  });

  it('a time typed over its own: the track is moved there, in one post, and is there everywhere at once', async () => {
    const page = tape();
    await page.read();
    await page.at(100);
    await page.user.click(page.button('Edit Joey Beltram — Energy Flash, at 0:05:00'));
    const reading = hold(page.server);
    await retime(page, '6:10');
    await waitFor(() => expect(page.posts()).toEqual(['[5:00] no track starts here\n[6:10] Joey Beltram - Energy Flash']));
    await waitFor(() => expect(page.rows()).toEqual(['0:00:00Orbital — Chime', '0:06:10Joey Beltram — Energy Flash']));
    expect(page.marks()).toBe('0 370');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    reading.go();
  });

  it('a time typed a few seconds earlier: the track is at the new time at once, and not gone with the old one', async () => {
    const page = tape({ posted: [{ by: 'Josh', says: '[0:05] Orbital - Chime' }] });
    await page.read();
    await page.at(100);
    await page.user.click(page.button('Edit Orbital — Chime, at 0:00:05'));
    const reading = hold(page.server);
    await retime(page, '0:00:00');
    await waitFor(() => expect(page.posts()).toEqual(['[0:00] Orbital - Chime\n[0:05] no track starts here']));
    await waitFor(() => expect(page.rows()).toEqual(['0:00:00Orbital — Chime']));
    expect(page.marks()).toBe('0');
    reading.go();
  });

  it('a time that is no time, another track’s, or past the side’s end: says which, and posts nothing', async () => {
    const page = tape({ sides: [{ position: 'A', tracks: [], length: 900 }], length: 900 });
    await page.read();
    await page.at(100);
    await page.user.click(page.button('Edit Joey Beltram — Energy Flash, at 0:05:00'));
    await retime(page, 'soon');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the time, like 500 for 0:05:00.');
    expect(startsAt()).toHaveFocus();
    await retime(page, '275');
    expect(startsAt()).toHaveValue('0:02:75');
    expect(screen.getByRole('alert')).toHaveTextContent('Minutes and seconds only go up to 59.');
    // The blank it is about is the one marked as wrong and read with the words; the others are not.
    expect(startsAt()).toHaveAccessibleDescription('Minutes and seconds only go up to 59.');
    expect(startsAt()).toBeInvalid();
    expect(screen.getByRole('textbox', { name: 'Artist' })).toBeValid();
    expect(screen.getByRole('textbox', { name: 'Artist' })).not.toHaveAccessibleDescription();
    await retime(page, '0:00');
    expect(screen.getByRole('alert')).toHaveTextContent('Another track starts at 0:00:00.');
    await retime(page, '15:00');
    expect(screen.getByRole('alert')).toHaveTextContent('That is past where a track could start on this side.');
    expect(page.posts()).toEqual([]);
    expect(page.marks()).toBe('0 300');
    // Its own time, typed again, is no move: with the name changed it is a correction at the time it has.
    await page.user.clear(artist());
    await page.user.type(artist(), 'Beltram');
    await retime(page, '5:00');
    await waitFor(() => expect(page.posts()).toEqual(['[5:00] Beltram - Energy Flash']));
  });

  it('the up and down arrows in the time’s blank: a second at a time, ten with Shift', async () => {
    const page = tape();
    await page.read();
    await page.at(100);
    await page.user.click(page.button('Edit Joey Beltram — Energy Flash, at 0:05:00'));
    await page.user.click(startsAt());
    await page.user.keyboard('{ArrowUp}{ArrowUp}');
    expect(startsAt()).toHaveValue('0:05:02');
    await page.user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(startsAt()).toHaveValue('0:04:52');
  });

  it('Edit, on its row, with the tape before it; Use, then Post: moves it earlier, to where the tape is, in one post', async () => {
    const page = tape();
    await page.read();
    await page.at(280.2);
    // To a finger, "Edit" shows on the row playing and on the one whose time could be moved to here.
    expect(page.editable()).toEqual(['0:00:00Orbital — Chime', '0:05:00Joey Beltram — Energy Flash']);
    await page.user.click(page.button('Edit Joey Beltram — Energy Flash, at 0:05:00'));
    expect(screen.getByRole('form', { name: 'ID the track at 0:05:00' })).toBeInTheDocument();
    // The tape is left where it is: that is where the track is to be moved to.
    expect(page.went).not.toHaveBeenCalled();
    await page.user.click(page.button('Use 0:04:40, the tape’s time'));
    expect(startsAt()).toHaveValue('0:04:40');
    expect(page.posts()).toEqual([]);
    await page.user.type(startsAt(), '{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[4:40] Joey Beltram - Energy Flash\n[5:00] no track starts here']));
    await waitFor(() => expect(page.rows()).toEqual(['0:00:00Orbital — Chime', '0:04:40Joey Beltram — Energy Flash']));
    expect(page.marks()).toBe('0 280');
  });

  it('Use, then Post, from the line: moves the track playing to where the tape is, and it is there everywhere at once', async () => {
    const page = tape();
    await page.read();
    await page.at(341.5);
    await page.user.click(page.button('Now playing: Joey Beltram — Energy Flash. Correct this ID'));
    const reading = hold(page.server);
    await page.user.click(page.button('Use 0:05:41, the tape’s time'));
    await page.user.type(startsAt(), '{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[5:00] no track starts here\n[5:41] Joey Beltram - Energy Flash']));
    await waitFor(() => expect(page.rows()).toEqual(['0:00:00Orbital — Chime', '0:05:41Joey Beltram — Energy Flash']));
    expect(page.marks()).toBe('0 341');
    reading.go();
    await waitFor(() => expect(page.shared().sides[0].rows.every((row) => !row.mine)).toBe(true));
    expect(page.rows()).toEqual(['0:00:00Orbital — Chime', '0:05:41Joey Beltram — Energy Flash']);
  });

  it('New track inside it, named as the track playing or the one that starts next: it is not taken, and says why', async () => {
    const page = tape();
    await page.read();
    await page.at(100);
    await page.user.click(page.button(/^New track/));
    await page.user.type(artist(), 'Orbital');
    await page.user.type(title(), 'Chime{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('That track is already here, at 0:00:00. One track can’t play twice in a row.');
    await page.user.clear(artist());
    await page.user.type(artist(), 'Joey Beltram');
    await page.user.clear(title());
    await page.user.type(title(), 'Energy Flash{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('That track is already here, at 0:05:00.');
    expect(page.posts()).toEqual([]);
    // With another track between the two, the same track again is another play of it.
    const again = tapePage({ posted: [{ by: 'Josh', says: '[0:00] Orbital - Chime\n[5:00] Joey Beltram - Energy Flash' }] });
    await again.read();
    await again.at(500);
    await again.user.click(again.button(/^New track/));
    await again.user.type(artist(), 'Orbital');
    await again.user.type(title(), 'Chime{Enter}');
    await waitFor(() => expect(again.posts()).toEqual(['[8:20] Orbital - Chime']));
    await waitFor(() => expect(again.rows()).toEqual(['0:00:00Orbital — Chime', '0:05:00Joey Beltram — Energy Flash', '0:08:20Orbital — Chime']));
  });

  it('New track inside it: the blanks open for this moment, to name the track or, under them, to mark it unknown at the time in its blank', async () => {
    const page = tape();
    await page.read();
    await page.at(100);
    await page.user.click(page.button(NEW_TRACK));
    expect(screen.getByRole('form', { name: 'ID the track at 0:01:40' })).toBeInTheDocument();
    expect(artist()).toHaveValue('');
    expect(artist()).toHaveFocus();
    const time = screen.getByRole('textbox', { name: 'Starts at' });
    await page.user.clear(time);
    await page.user.type(time, '1:30');
    await page.user.click(page.button(/^Mark unknown/));
    expect(page.rows()).toEqual(['0:00:00Orbital — Chime', '0:01:30Unknown trackUndo', '0:05:00Joey Beltram — Energy Flash']);
    expect(page.bar()).toHaveTextContent('1 ID pending');
    expect(page.posts()).toEqual([]);
    // The blanks for a track that is already there have its removal under them, and no second way to mark it.
    await page.at(400);
    await page.user.click(page.button('Now playing: Joey Beltram — Energy Flash. Correct this ID'));
    expect(page.has(/^Mark unknown/)).toBe(false);
    expect(page.has('Remove this ID')).toBe(true);
  });

  it('a web address typed for a name: it is not taken, as an ID or as one that waits', async () => {
    const page = tape();
    await page.read();
    await page.at(100);
    await page.user.click(page.button(NEW_TRACK));
    await page.user.type(artist(), 'Best prices');
    await page.user.type(title(), 'www.pills.com{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Track IDs can’t include links.');
    expect(page.posts()).toEqual([]);
    expect(page.bar()).toBeNull();
  });

  it('New track inside it: a new track from there, and this one ends where that starts', async () => {
    const page = tape();
    await page.read();
    await page.at(120);
    await page.user.click(page.button(/^New track/));
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
    expect(page.rows()).toEqual(['0:05:00Unknown track+ ID']);
    expect(page.line()).toBe('Unknown track. Know it? ID itNew track');
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

describe('a track that an old comment timed, to the nearest few seconds', () => {
  it('is put right only from where it starts: ten seconds in, what is said starts a new track, before and after it is posted', async () => {
    const page = tapePage({ archive: [old('The track at 5:00 is Orbital - Chime')] });
    await page.read();
    expect(page.rows()).toEqual(['0:05:00Orbital — Chime']);
    await page.at(310);
    expect(page.line()).toBe('Orbital — ChimeNew track');
    await page.mark();
    expect(page.rows()).toEqual(['0:05:00Orbital — Chime', '0:05:10Unknown trackUndo']);

    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(page.posts()).toEqual(['[5:10] ? - ?']));
    await waitFor(() => expect(page.shared().sides[0].rows.every((row) => !row.mine)).toBe(true));
    // The comments, read again, say the same: the old track still has its name and its start.
    expect(page.rows()).toEqual(['0:05:00Orbital — Chime', '0:05:10Unknown track+ ID']);
  });
});

describe('the list’s order, and the one moment each track has', () => {
  it('never shows a side out of order of time, whatever is said of it', async () => {
    // The fourth line of the list, said to start before the second.
    const page = tapePage({ sides: LISTED, posted: [{ by: 'Josh', says: '[0:00] The Prodigy - Hyperspeed\n[3:41] Butsch - The Count\n[1:00] Phenomania - Caramelle' }] });
    await page.read();
    // And the line is on the page once, where its time puts it.
    expect(page.rows()).toEqual(['0:00:00The Prodigy — Hyperspeed', '0:01:00Phenomania — Caramelle', '0:03:41Butsch — The Count', '03Rhythm For Reasons — Grand National']);
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
    expect(page.rows()[1]).toBe('0:05:00Unknown track+ ID');
  });
});

describe('a line of the tape’s tracklist, edited from its row', () => {
  const startsAt = () => screen.getByRole('textbox', { name: 'Starts at' });
  const listed = (setup: Parameters<typeof tapePage>[0] = {}) =>
    tapePage({ sides: LISTED, posted: [{ by: 'Josh', says: '[0:00] The Prodigy - Hyperspeed\n[2:00] Butsch - The Count\n[3:00] Rhythm For Reasons - Grand National' }], ...setup });

  it('its time changed to one past the next track’s: it moves there, and is on the page once', async () => {
    const page = listed();
    await page.read();
    await page.user.click(page.button('Edit Butsch — The Count, at 0:02:00'));
    const reading = hold(page.server);
    await page.user.clear(startsAt());
    await page.user.type(startsAt(), '5:00{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[2:00] no track starts here\n[5:00] Butsch - The Count']));
    const moved = ['0:00:00The Prodigy — Hyperspeed', '0:03:00Rhythm For Reasons — Grand National', '0:05:00Butsch — The Count', '04Phenomania — Caramelle'];
    await waitFor(() => expect(page.rows()).toEqual(moved));
    expect(page.marks()).toBe('0 180 300');
    // And so the comments read, once they are read again.
    reading.go();
    await waitFor(() => expect(page.shared().sides[0].rows.every((row) => !row.mine)).toBe(true));
    expect(page.rows()).toEqual(moved);
    expect(screen.getByText('3 of 4 timed')).toBeInTheDocument();
  });

  it('its name changed to another record’s: the row keeps its place and its time, and reads as typed', async () => {
    const page = listed();
    await page.read();
    await page.user.click(page.button('Edit Butsch — The Count, at 0:02:00'));
    const reading = hold(page.server);
    await page.user.clear(artist());
    await page.user.type(artist(), 'LFO');
    await page.user.clear(title());
    await page.user.type(title(), 'LFO{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[2:00] LFO - LFO [was Butsch - The Count]']));
    const renamed = ['0:00:00The Prodigy — Hyperspeed', '0:02:00LFO — LFO', '0:03:00Rhythm For Reasons — Grand National', '04Phenomania — Caramelle'];
    await waitFor(() => expect(page.rows()).toEqual(renamed));
    reading.go();
    await waitFor(() => expect(page.shared().sides[0].rows.every((row) => !row.mine)).toBe(true));
    expect(page.rows()).toEqual(renamed);
    // Put right again, by anyone: it is still the list's second line that is being named.
    await page.user.click(page.button('Edit LFO — LFO, at 0:02:00'));
    await page.user.type(title(), ' (Leeds Warehouse Mix){Enter}');
    await waitFor(() => expect(page.posts()[1]).toBe('[2:00] LFO - LFO (Leeds Warehouse Mix) [was Butsch - The Count]'));
    // The list's own words, typed back, are the list's again.
    await waitFor(() => expect(page.button('Edit LFO — LFO (Leeds Warehouse Mix), at 0:02:00')).toBeInTheDocument());
    await page.user.click(page.button('Edit LFO — LFO (Leeds Warehouse Mix), at 0:02:00'));
    await page.user.clear(artist());
    await page.user.type(artist(), 'Butsch');
    await page.user.clear(title());
    await page.user.type(title(), 'The Count{Enter}');
    await waitFor(() => expect(page.posts()[2]).toBe('[2:00] Butsch - The Count'));
  });

  it('a line with no time yet: Edit, or its number, opens the blanks in its row with the time to fill in, and the tape is not started', async () => {
    const page = listed();
    await page.read();
    await page.user.click(page.button('Edit Phenomania — Caramelle'));
    expect(screen.getByRole('form', { name: 'The time track 4 starts' }).closest('li')).toBe(within(page.tracklist() as HTMLElement).getAllByRole('listitem')[3]);
    expect(startsAt()).toHaveValue('');
    expect(startsAt()).toHaveFocus();
    expect(artist()).toHaveValue('Phenomania');
    expect(page.went).not.toHaveBeenCalled();
    // Before the tape has been played there is no time of the tape's to use.
    expect(page.has(/^Use/)).toBe(false);
    // It is a line of the list being given its time, not a moment being marked.
    expect(page.has(/^Mark unknown/)).toBe(false);
    await page.user.keyboard('{Escape}');
    expect(page.button('04, set the time for Phenomania — Caramelle')).toHaveFocus();
    await page.user.click(page.button('04, set the time for Phenomania — Caramelle'));
    expect(startsAt()).toHaveFocus();
  });

  it('a line with no time yet, given one by hand: it waits to be posted like a + on its row, and goes up with the rest', async () => {
    const page = listed();
    await page.read();
    await page.user.click(page.button('Edit Phenomania — Caramelle'));
    await page.user.type(startsAt(), 'soon{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the time, like 500 for 0:05:00.');
    await page.user.clear(startsAt());
    await page.user.type(startsAt(), '2:00{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Another track starts at 0:02:00.');
    await page.user.clear(startsAt());
    await page.user.type(startsAt(), '6:30{Enter}');
    expect(screen.queryByRole('form', { name: 'The time track 4 starts' })).not.toBeInTheDocument();
    expect(page.rows()[3]).toBe('0:06:30Phenomania — CaramelleUndo');
    expect(page.bar()).toHaveTextContent('1 ID pending');
    expect(page.posts()).toEqual([]);
    // The keyboard is on the row's time, not on "Undo", which another Enter would set off.
    expect(page.button('Play from 0:06:30, your time, not posted yet')).toHaveFocus();
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(page.posts()).toEqual(['[6:30] Phenomania - Caramelle']));
  });

  it('a line with no time yet, given a time out of the list’s order and its name put right: one row, by its time, under the name typed', async () => {
    const page = listed();
    await page.read();
    await page.user.click(page.button('Edit Phenomania — Caramelle'));
    await page.user.type(startsAt(), '1:00');
    await page.user.type(title(), ' (Partyunicorn Mix){Enter}');
    expect(page.rows()).toEqual(['0:00:00The Prodigy — Hyperspeed', '0:01:00Phenomania — Caramelle (Partyunicorn Mix)Undo', '0:02:00Butsch — The Count', '0:03:00Rhythm For Reasons — Grand National']);
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(page.posts()).toEqual(['[1:00] Phenomania - Caramelle (Partyunicorn Mix) [was Phenomania - Caramelle]']));
    await waitFor(() => expect(page.shared().sides[0].rows.every((row) => !row.mine)).toBe(true));
    expect(page.rows()).toEqual(['0:00:00The Prodigy — Hyperspeed', '0:01:00Phenomania — Caramelle (Partyunicorn Mix)', '0:02:00Butsch — The Count', '0:03:00Rhythm For Reasons — Grand National']);
    expect(screen.getByText('All 4 tracks timed')).toBeInTheDocument();
  });

  it('on a phone: the line’s number opens the sheet, which adds the time and asks no name', async () => {
    const page = listed({ phone: true, name: null });
    await page.read();
    // Hard by another track's start no line could be the one starting, and each has its number, not a +.
    await page.at(121);
    await page.user.click(page.button('04, set the time for Phenomania — Caramelle'));
    const sheet = within(screen.getByRole('dialog', { name: 'The time track 4 starts' }));
    expect(sheet.queryByRole('textbox', { name: 'Your name' })).not.toBeInTheDocument();
    await page.at(400);
    await page.user.click(sheet.getByRole('button', { name: 'Use 0:06:40, the tape’s time' }));
    await page.user.click(sheet.getByRole('button', { name: /^Add/ }));
    await waitFor(() => expect(page.rows()[3]).toBe('0:06:40Phenomania — CaramelleUndo'));
    expect(page.posts()).toEqual([]);
    // Said once the sheet has closed, when a screen reader can hear the page again.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('status').some((status) => status.textContent === 'Added at 0:06:40. Not posted yet.')).toBe(true);
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
    expect(page.line()).toBe('Know this track? ID itNew track');
    expect(page.lit()).toBeNull();
    await page.mark();
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
    expect(page.bar()).toHaveTextContent('1 ID pending');
    // Someone else posts that line's time, the same to the second, and the page reads the comments again.
    page.server.comments.push({ id: 99, tape_id: 'tape-1', author_name: 'Softboiled', content: '[3:41] Butsch - The Count', created_at: '2026-11-15T13:00:00.000Z' });
    await waitFor(() => page.shared().reread());
    await waitFor(() => expect(page.rows()[1]).toBe('0:03:41Butsch — The Count'));
    expect(page.bar()).toBeNull();
    expect(page.shared().unposted).toEqual([]);
  });

  it('says so, quietly, where the newer comments couldn’t be read, and shows what the archive has', async () => {
    const page = tapePage({ archive: [old('anyone know the track @5:00?')], down: true });
    await page.read();
    await waitFor(() => expect(page.rows()).toEqual(['0:05:00Unknown track+ ID']));
    expect(screen.getByText('The latest IDs couldn’t be read just now, so some may be missing here.')).toBeInTheDocument();
  });

  it('keeps everything as it was when a post is refused, and says why', async () => {
    const page = tapePage();
    await page.read();
    await page.at(100);
    await page.mark();
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
    expect(page.tray()).toHaveTextContent('The Prodigy0:01:00HyperspeedEdit IDNew track');
    // Past the ten minutes a track is taken to play.
    await page.at(700);
    expect(page.tray()).toHaveTextContent('Nothing ID’d here yet0:11:40Know this track? ID it.ID itNew track');

    await page.user.click(page.plus('Butsch — The Count'));
    await page.at(710);
    expect(page.tray()).toHaveTextContent('Butsch0:11:50The CountPendingEdit IDNew track');

    await page.at(900);
    await page.user.click(within(page.tray() as HTMLElement).getByRole('button', { name: NEW_TRACK }));
    expect(page.tray()).toHaveTextContent('Unknown track0:15:00Marked by youPendingID itNew track');
    expect(within(page.tray() as HTMLElement).getByRole('button', { name: NEW_TRACK })).toHaveAttribute('aria-disabled', 'true');
    expect(page.bar()).toHaveTextContent('2 IDs pending');
  });
});
