// What the parts of a tape page share (components/TapeTrackIds.tsx): the reading of the comments, the
// visitor's changes and what becomes of them, and the posting.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { clock } from '@/lib/track-ids/compose';
import { hold, KEPT, tapePage } from './tape';

const NEW_TRACK = /^New track/;
const said = (time: number, artist = '', title = '') => ({ side: 0, time, artist, title });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the reading of the comments', () => {
  it('is done once, for the comment list, the tracklist’s history and the IDs', async () => {
    const page = tapePage({ posted: [{ by: 'Rents', says: 'what a tape' }, { by: 'Josh', says: '[12:34] Moby - Go' }] });
    await page.read();
    expect(await screen.findByText('what a tape')).toBeInTheDocument();
    expect(page.rows()).toEqual(['0:12:34Moby — Go']);
    expect(page.has('History · 1 post')).toBe(true);
    expect(page.reads()).toBe(1);
  });

  it('is done again when a comment is posted some other way, and what it finds shows on every part of the page', async () => {
    const page = tapePage();
    await page.read();
    await page.at(60);
    // The comment form, down the page, posts an ordinary comment and says so.
    page.server.comments.push({ id: 1, tape_id: 'tape-1', author_name: 'Tester', content: '[0:05] 808 State - Cubik', created_at: '2026-11-15T13:00:00.000Z' });
    page.shared().reread();
    await waitFor(() => expect(page.rows()).toEqual(['0:00:05808 State — Cubik']));
    expect(page.line()).toBe('808 State — CubikNew track');
    expect(page.marks()).toBe('5');
    expect(page.reads()).toBe(2);
  });

  it('takes a comment for a post of IDs only where the reader does: on a tape with sides, lines with no side, or a side it hasn’t got, are talk', async () => {
    const page = tapePage({
      sides: [{ position: 'A' }, { position: 'B' }],
      posted: [{ by: 'Rents', says: '[12:34] Moby - Go\n[15:00] Orbital - Chime' }, { by: 'Josh', says: '[C 1:00] LFO - LFO' }, { by: 'Softboiled', says: '[B 2:00] Altern 8 - Infiltrate 202' }],
    });
    await page.read();
    const comments = within(screen.getByTestId('comments'));
    expect(comments.getByText('Rents')).toBeInTheDocument();
    expect(comments.getByText('[C 1:00] LFO - LFO')).toBeInTheDocument();
    expect(comments.queryByText('Softboiled')).not.toBeInTheDocument();
    // And only the one that is a post of IDs is in the tracklist's history.
    expect(page.has('History · 1 post')).toBe(true);
  });

  it('keeps the comments it had when it can’t be done again just then', async () => {
    const page = tapePage({ posted: [{ by: 'Rents', says: 'what a tape' }] });
    await page.read();
    // The newer comments can't be had: the reading is the archive's alone, and has no comments in it.
    page.server.down = true;
    page.shared().reread();
    await waitFor(() => expect(page.shared().read).toBe('short'));
    expect(screen.getByText('what a tape')).toBeInTheDocument();
    // Nor can the site be reached at all.
    page.server.down = false;
    page.shared().reread();
    await waitFor(() => expect(page.shared().read).toBe('read'));
    const failed = vi.spyOn(console, 'error').mockImplementation(() => {});
    (global.fetch as unknown as Mock).mockRejectedValueOnce(new Error('offline'));
    page.shared().reread();
    await waitFor(() => expect(page.shared().read).toBe('short'));
    expect(failed).toHaveBeenCalledWith('Failed to load track IDs:', expect.any(Error));
    expect(screen.getByText('what a tape')).toBeInTheDocument();
  });
});

describe('the visitor’s changes', () => {
  it('wait for the comments to be read before they join the page, and before more can be made: they are said on top of what the comments say', async () => {
    const page = tapePage({ sides: [{ position: 'A', tracks: [{ artist: 'Orbital', title: 'Chime' }, { artist: 'LFO', title: 'LFO' }] }], kept: JSON.stringify([said(100)]), slow: true });
    await page.at(300);
    // The tape's own tracklist is there from the start; nothing of the visitor's is, and nothing can be said yet.
    expect(page.rows()).toEqual(['01Orbital — Chime', '02LFO — LFO']);
    expect(page.pluses()).toEqual([]);
    expect(page.has(NEW_TRACK)).toBe(false);
    expect(page.bar()).toBeNull();

    page.reading.go();
    await page.read();
    await waitFor(() => expect(page.rows()).toEqual(['0:01:40Unknown trackUndo', '+Orbital — Chime', '+LFO — LFO']));
    expect(page.bar()).toHaveTextContent('1 ID pending');
    expect(page.pluses()).toEqual(['Orbital — Chime', 'LFO — LFO']);
    expect(page.has(NEW_TRACK)).toBe(true);
  });

  it('are kept on the device while they wait, and no longer once they are posted', async () => {
    const page = tapePage();
    await page.read();
    await page.at(100);
    await page.mark();
    expect(JSON.parse(window.localStorage.getItem(KEPT) as string)).toEqual([said(100)]);
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(window.localStorage.getItem(KEPT)).toBeNull());
  });

  it('come back once, however often the page is put together', async () => {
    const page = tapePage({ kept: JSON.stringify([said(100), said(200)]), strict: true });
    await page.read();
    await waitFor(() => expect(page.rows()).toEqual(['0:01:40Unknown trackUndo', '0:03:20Unknown trackUndo']));
    expect(page.shared().unposted).toHaveLength(2);
    expect(page.bar()).toHaveTextContent('2 IDs pending');
  });

  it('leave out anything kept on the device that isn’t one of them', async () => {
    const page = tapePage({ kept: JSON.stringify([said(100), { side: 0, time: 'soon' }, null, { ...said(300), gone: true }, { ...said(400), sent: { by: 'Dana', read: 1 } }]) });
    await page.read();
    await waitFor(() => expect(page.rows()).toEqual(['0:01:40Unknown trackUndo']));
  });

  it('are let go, unposted, where the comments turn out to have that moment already', async () => {
    // Kept from an earlier visit: a point at 5:00, which someone has since ID'd, and one at 8:20, still nobody's.
    const page = tapePage({ kept: JSON.stringify([said(300), said(500)]), posted: [{ by: 'Josh', says: '[5:02] Orbital - Chime' }] });
    await page.read();
    await waitFor(() => expect(page.rows()).toEqual(['0:05:02Orbital — Chime', '0:08:20Unknown trackUndo']));
    await waitFor(() => expect(page.shared().unposted).toEqual([said(500)]));
    expect(JSON.parse(window.localStorage.getItem(KEPT) as string)).toEqual([said(500)]);
  });

  it('replace what the visitor had unposted of the same moment', async () => {
    const page = tapePage();
    await page.read();
    page.shared().say(said(100));
    page.shared().say(said(103, 'Orbital', 'Chime'));
    await waitFor(() => expect(page.rows()).toEqual(['0:01:43Orbital — ChimeUndo']));
    expect(page.shared().unposted).toEqual([said(103, 'Orbital', 'Chime')]);
  });
});

describe('the visitor’s name', () => {
  it('is asked for once on the page: posted under in the blanks, it is not asked for again by the bar', async () => {
    const page = tapePage({ name: null });
    await page.read();
    await page.at(100);
    await page.mark();
    expect(within(page.bar() as HTMLElement).getByRole('textbox', { name: 'Your name' })).toBeInTheDocument();

    // Past where the point marked is taken to end, with nothing playing.
    await page.at(800);
    await page.user.click(page.button('Know this track? ID it'));
    await page.user.type(screen.getByRole('textbox', { name: 'Artist' }), 'Orbital');
    await page.user.type(screen.getByRole('textbox', { name: 'Title' }), 'Chime{Enter}');
    await page.user.type(within(screen.getByRole('form', { name: 'ID the track at 0:13:20' })).getByRole('textbox', { name: 'Your name' }), 'Dana{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[13:20] Orbital - Chime']));
    await waitFor(() => expect(page.bar()).toHaveTextContent('1 ID pending'));
    expect(within(page.bar() as HTMLElement).queryByRole('textbox', { name: 'Your name' })).not.toBeInTheDocument();
  });
});

describe('a post', () => {
  it('stays on the page, as posted, until the reading of the comments that has it is back, however readings overlap', async () => {
    const page = tapePage();
    await page.read();
    await page.at(100);
    await page.mark();
    const first = hold(page.server);
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(page.posts()).toHaveLength(1));
    await waitFor(() => expect(page.rows()).toEqual(['0:01:40Unknown track+ ID']));

    // A second post, while the reading for the first is still out.
    await page.at(200);
    await page.mark();
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(page.posts()).toHaveLength(2));
    await waitFor(() => expect(page.rows()).toEqual(['0:01:40Unknown track+ ID', '0:03:20Unknown track+ ID']));
    expect(page.shared().sides[0].rows.filter((row) => row.mine?.sent)).toHaveLength(2);

    first.go();
    await waitFor(() => expect(page.shared().sides[0].rows.every((row) => !row.mine)).toBe(true));
    expect(page.rows()).toEqual(['0:01:40Unknown track+ ID', '0:03:20Unknown track+ ID']);
  });

  describe('of more than one comment holds', () => {
    // Forty tracks, each with a title as long as the blanks allow: about three comments' worth. (Each is
    // its own record: 01 and "0101…", 02 and "0202…".)
    const nth = (k: number) => String(k + 1).padStart(2, '0');
    const sitting = Array.from({ length: 40 }, (_, k) => said(100 * (k + 1), `Artist${nth(k)}`, nth(k).repeat(75)));
    const fits = (comment: string) => comment.length <= 5000;

    it('goes up as several, one after another, every line of it, in order of time', async () => {
      const page = tapePage();
      await page.read();
      for (const change of sitting) page.shared().say(change);
      await waitFor(() => expect(page.bar()).toHaveTextContent('40 IDs pending'));
      await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
      await waitFor(() => expect(page.bar()).toBeNull());
      expect(page.posts().length).toBeGreaterThan(1);
      expect(page.posts().every(fits)).toBe(true);
      expect(page.posts().join('\n').split('\n').map((line) => line.split(' - ')[0])).toEqual(sitting.map((change) => `[${clock(change.time)}] ${change.artist}`));
      await waitFor(() => expect(page.shared().sides[0].rows.every((row) => !row.mine)).toBe(true));
      expect(page.shared().sides[0].rows).toHaveLength(40);
    });

    it('leaves waiting what didn’t go up when one of them is refused, and has what did as posted', async () => {
      const page = tapePage();
      await page.read();
      for (const change of sitting) page.shared().say(change);
      await waitFor(() => expect(page.bar()).toHaveTextContent('40 IDs pending'));
      // The site takes the first comment and refuses the second.
      const fetched = global.fetch as unknown as Mock;
      const answer = fetched.getMockImplementation() as typeof fetch;
      let posts = 0;
      fetched.mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
        if (String(url) === '/api/comments/submit' && ++posts === 2) return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), { status: 429 });
        return answer(url, init);
      });
      await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
      expect(await within(page.bar() as HTMLElement).findByRole('alert')).toHaveTextContent('Too many requests. Please try again later.');
      expect(page.server.comments).toHaveLength(1);
      const went = page.server.comments[0].content.split('\n').length;
      expect(went).toBeGreaterThan(5);
      await waitFor(() => expect(page.bar()).toHaveTextContent(`${40 - went} IDs pending`));
      expect(page.shared().sides[0].rows).toHaveLength(40);
    });
  });

  it('still shows as posted where the comments can’t be read again just then', async () => {
    const page = tapePage();
    await page.read();
    await page.at(100);
    await page.mark();
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(page.posts()).toHaveLength(1));
    await waitFor(() => expect(page.reads()).toBe(2));
    expect(page.rows()).toEqual(['0:01:40Unknown track+ ID']);
  });
});
