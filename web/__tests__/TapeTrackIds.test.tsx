// What the parts of a tape page share (components/TapeTrackIds.tsx): the reading of the comments, the
// visitor's changes and what becomes of them, and the posting.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hold, KEPT, tapePage } from './tape';

const NEW_UNKNOWN = /^New unknown/;
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
    expect(page.line()).toBe('808 State — CubikNew IDNew unknown');
    expect(page.marks()).toBe('5');
    expect(page.reads()).toBe(2);
  });
});

describe('the visitor’s changes', () => {
  it('wait for the comments to be read before they join the page, and before more can be made: they are said on top of what the comments say', async () => {
    const page = tapePage({ sides: [{ position: 'A', tracks: [{ artist: 'Orbital', title: 'Chime' }, { artist: 'LFO', title: 'LFO' }] }], kept: JSON.stringify([said(100)]), slow: true });
    await page.at(300);
    // The tape's own tracklist is there from the start; nothing of the visitor's is, and nothing can be said yet.
    expect(page.rows()).toEqual(['01Orbital — Chime', '02LFO — LFO']);
    expect(page.pluses()).toEqual([]);
    expect(page.has(NEW_UNKNOWN)).toBe(false);
    expect(page.bar()).toBeNull();

    page.reading.go();
    await page.read();
    await waitFor(() => expect(page.rows()).toEqual(['0:01:40Unknown trackUndo', '+Orbital — Chime', '+LFO — LFO']));
    expect(page.bar()).toHaveTextContent('1 time not posted');
    expect(page.pluses()).toEqual(['Orbital — Chime', 'LFO — LFO']);
    expect(page.has(NEW_UNKNOWN)).toBe(true);
  });

  it('are kept on the device while they wait, and no longer once they are posted', async () => {
    const page = tapePage();
    await page.read();
    await page.at(100);
    await page.user.click(page.button(NEW_UNKNOWN));
    expect(JSON.parse(window.localStorage.getItem(KEPT) as string)).toEqual([said(100)]);
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(window.localStorage.getItem(KEPT)).toBeNull());
  });

  it('come back once, however often the page is put together', async () => {
    const page = tapePage({ kept: JSON.stringify([said(100), said(200)]), strict: true });
    await page.read();
    await waitFor(() => expect(page.rows()).toEqual(['0:01:40Unknown trackUndo', '0:03:20Unknown trackUndo']));
    expect(page.shared().unposted).toHaveLength(2);
    expect(page.bar()).toHaveTextContent('2 times not posted');
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
    await page.user.click(page.button(NEW_UNKNOWN));
    expect(within(page.bar() as HTMLElement).getByRole('textbox', { name: 'Your name' })).toBeInTheDocument();

    // Past where the point marked is taken to end, with nothing playing.
    await page.at(400);
    await page.user.click(page.button('Know this track? ID it'));
    await page.user.type(screen.getByRole('textbox', { name: 'Artist' }), 'Orbital');
    await page.user.type(screen.getByRole('textbox', { name: 'Title' }), 'Chime{Enter}');
    await page.user.type(within(screen.getByRole('form', { name: 'ID the track at 0:06:40' })).getByRole('textbox', { name: 'Your name' }), 'Dana{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[6:40] Orbital - Chime']));
    await waitFor(() => expect(page.bar()).toHaveTextContent('1 time not posted as Dana'));
    expect(within(page.bar() as HTMLElement).queryByRole('textbox', { name: 'Your name' })).not.toBeInTheDocument();
  });
});

describe('a post', () => {
  it('stays on the page, as posted, until the reading of the comments that has it is back, however readings overlap', async () => {
    const page = tapePage();
    await page.read();
    await page.at(100);
    await page.user.click(page.button(NEW_UNKNOWN));
    const first = hold(page.server);
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(page.posts()).toHaveLength(1));
    await waitFor(() => expect(page.rows()).toEqual(['0:01:40Unknown trackID it']));

    // A second post, while the reading for the first is still out.
    await page.at(200);
    await page.user.click(page.button(NEW_UNKNOWN));
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(page.posts()).toHaveLength(2));
    await waitFor(() => expect(page.rows()).toEqual(['0:01:40Unknown trackID it', '0:03:20Unknown trackID it']));
    expect(page.shared().sides[0].rows.filter((row) => row.mine?.sent)).toHaveLength(2);

    first.go();
    await waitFor(() => expect(page.shared().sides[0].rows.every((row) => !row.mine)).toBe(true));
    expect(page.rows()).toEqual(['0:01:40Unknown trackID it', '0:03:20Unknown trackID it']);
  });

  it('still shows as posted where the comments can’t be read again just then', async () => {
    const page = tapePage();
    await page.read();
    await page.at(100);
    await page.user.click(page.button(NEW_UNKNOWN));
    await page.user.click(within(page.bar() as HTMLElement).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(page.posts()).toHaveLength(1));
    await waitFor(() => expect(page.reads()).toBe(2));
    expect(page.rows()).toEqual(['0:01:40Unknown trackID it']);
  });
});
