import React, { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LiveComments } from '../components/LiveComments';
import { TapeTrackIdsProvider, useTapeTrackIds } from '../components/TapeTrackIds';

// Stands in for the player: says how to take the tape somewhere, and can announce a posted comment.
function Player({ went }: { went: (position: string | null, time: number) => void }) {
  const { sides, setPlayer, refresh } = useTapeTrackIds();
  useEffect(() => {
    setPlayer(went);
    return () => setPlayer(null);
  }, [setPlayer, went]);
  return (
    <button type="button" onClick={refresh}>
      posted, {sides.flat().length} IDs
    </button>
  );
}

describe('what a tape page’s parts share about track IDs', () => {
  let comments: { id: number; tape_id: string; author_name: string; content: string; created_at: string }[];
  let ids: unknown[][];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    comments = [
      { id: 1, tape_id: 'tape-1', author_name: 'Rents', content: 'what a tape', created_at: '2026-11-01T10:00:00Z' },
      { id: 2, tape_id: 'tape-1', author_name: 'Josh', content: '[B 12:34] Moby - Go', created_at: '2026-11-02T10:00:00Z' },
    ];
    ids = [[], [{ start: 754, end: 994, artist: 'Moby', title: 'Go', known: true, by: 'Josh' }]];
    fetchMock = vi.fn((url: RequestInfo | URL) =>
      Promise.resolve(new Response(JSON.stringify(String(url).includes('/api/track-ids/') ? { sides: ids, complete: true } : comments), { status: 200 })),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an ID in the comments as a time that takes the tape there, and other comments as they were written', async () => {
    const user = userEvent.setup();
    const went = vi.fn<(position: string | null, time: number) => void>();
    render(
      <TapeTrackIdsProvider tapeId="tape-1">
        <Player went={went} />
        <LiveComments tapeId="tape-1" />
      </TapeTrackIdsProvider>,
    );

    expect(await screen.findByText('what a tape')).toBeInTheDocument();
    expect(screen.getByText('Moby — Go')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Play from B · 12:34' }));
    expect(went).toHaveBeenCalledWith('B', 754);
  });

  it('reads the IDs and the comments again when a comment is posted', async () => {
    const user = userEvent.setup();
    render(
      <TapeTrackIdsProvider tapeId="tape-1">
        <Player went={() => {}} />
        <LiveComments tapeId="tape-1" />
      </TapeTrackIdsProvider>,
    );
    expect(await screen.findByRole('button', { name: 'posted, 1 IDs' })).toBeInTheDocument();

    comments.push({ id: 3, tape_id: 'tape-1', author_name: 'Tester', content: '[A 0:05] 808 State - Cubik', created_at: '2026-11-15T10:00:00Z' });
    ids[0] = [{ start: 5, end: 245, artist: '808 State', title: 'Cubik', known: true, by: 'Tester' }];
    await user.click(screen.getByRole('button', { name: 'posted, 1 IDs' }));

    expect(await screen.findByRole('button', { name: 'posted, 2 IDs' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('808 State — Cubik')).toBeInTheDocument());
  });
});
