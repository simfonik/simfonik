import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Comment } from '@/components/Comment';
import { TapePlays, TapeStatsProvider } from '@/components/TapeStats';

const fetchMock = vi.fn();
/** What the site answers: the tape's stats, and then each heart sent. */
const site = (stats: { plays: number | null; hearts: Record<string, number> }, heart: () => Response = () => Response.json({ count: 1 })) =>
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => (init?.method === 'POST' ? heart() : Response.json(stats)));
const page = () =>
  render(
    <TapeStatsProvider tapeId="some-tape">
      <TapePlays />
      <Comment author="Thomas" date="2009-02-07" content="Wow!" heart="a0" />
    </TapeStatsProvider>,
  );
const heart = () => screen.getByRole('button', { name: /heart this comment/i });
const sent = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').map(([, init]) => JSON.parse(init.body as string));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  window.localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('the heart on a comment', () => {
  it('is bare until someone has given one', async () => {
    site({ plays: null, hearts: {} });
    page();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/tape-stats/some-tape'));
    expect(heart().textContent).toBe('');
    expect(heart().getAttribute('aria-pressed')).toBe('false');
  });

  it('has its count beside it once someone has', async () => {
    site({ plays: null, hearts: { a0: 3 } });
    page();
    await waitFor(() => expect(heart().textContent).toBe('3'));
  });

  it('is given when pressed: filled, counted at once, sent with this browser’s id, and remembered', async () => {
    site({ plays: null, hearts: { a0: 3 } }, () => Response.json({ count: 4 }));
    page();
    await waitFor(() => expect(heart().textContent).toBe('3'));
    fireEvent.click(heart());
    expect(heart().getAttribute('aria-pressed')).toBe('true');
    expect(heart().textContent).toBe('4');
    await waitFor(() => expect(sent()).toHaveLength(1));
    expect(sent()[0]).toMatchObject({ tapeId: 'some-tape', target: 'a0', on: true });
    expect(sent()[0].visitor).toBe(window.localStorage.getItem('simfonik:visitor'));
    expect(JSON.parse(window.localStorage.getItem('simfonik:hearts:some-tape') ?? '[]')).toEqual(['a0']);
  });

  it('is still this browser’s after a reload, and is taken back when pressed again', async () => {
    window.localStorage.setItem('simfonik:hearts:some-tape', '["a0"]');
    site({ plays: null, hearts: { a0: 1 } }, () => Response.json({ count: 0 }));
    page();
    await waitFor(() => expect(heart().getAttribute('aria-pressed')).toBe('true'));
    fireEvent.click(heart());
    await waitFor(() => expect(sent()[0]).toMatchObject({ target: 'a0', on: false }));
    await waitFor(() => expect(heart().textContent).toBe(''));
    expect(heart().getAttribute('aria-pressed')).toBe('false');
    expect(window.localStorage.getItem('simfonik:hearts:some-tape')).toBeNull();
  });

  it('is put back as it was where the site would not take it', async () => {
    site({ plays: null, hearts: {} }, () => new Response('{}', { status: 429 }));
    page();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(heart());
    await waitFor(() => expect(sent()).toHaveLength(1));
    await waitFor(() => expect(heart().getAttribute('aria-pressed')).toBe('false'));
    expect(heart().textContent).toBe('');
    expect(window.localStorage.getItem('simfonik:hearts:some-tape')).toBeNull();
  });
});

describe('the plays among a tape’s details', () => {
  it('are a line with the number, once read', async () => {
    site({ plays: 2407, hearts: {} });
    page();
    expect(await screen.findByText('Plays · 2,407')).toBeTruthy();
  });

  it('are left out where there are none to show', async () => {
    site({ plays: null, hearts: {} });
    page();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText(/Plays/)).toBeNull();
  });
});
