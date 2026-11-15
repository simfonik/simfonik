import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LiveComments } from '../components/LiveComments';
import { TapeTrackIdsProvider, type TapeComment } from '../components/TapeTrackIds';
import { TrackIdLog } from '../components/TrackIdLog';

const comment = (id: number, author_name: string, content: string, created_at: string): TapeComment => ({ id, tape_id: 'tape-1', author_name, content, created_at });

describe('the log of a tape’s ID posts', () => {
  let comments: TapeComment[];

  beforeEach(() => {
    document.body.innerHTML = '';
    comments = [];
    global.fetch = vi.fn((url: RequestInfo | URL) =>
      Promise.resolve(new Response(JSON.stringify(String(url).includes('/api/track-ids/') ? { sides: [], orders: [], complete: true } : comments), { status: 200 })),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const page = () =>
    render(
      <TapeTrackIdsProvider tapeId="tape-1">
        <TrackIdLog />
        <div data-testid="comments">
          <LiveComments />
        </div>
      </TapeTrackIdsProvider>,
    );
  const log = () => screen.findByRole('region', { name: 'Track IDs' });

  it('has the ID posts and the comment list has the rest', async () => {
    comments = [
      comment(1, 'Rents', 'what a tape', '2026-11-01T10:00:00Z'),
      comment(2, 'Josh', '[B 12:34] Moby - Go', '2026-11-02T10:00:00Z'),
      comment(3, 'Softboiled', 'The track at 12:34 is Moby - Go', '2026-11-03T10:00:00Z'),
    ];
    page();

    const ids = await log();
    expect(within(ids).getByText('Moby — Go')).toBeInTheDocument();
    expect(within(ids).getByText(/Josh/)).toBeInTheDocument();
    expect(within(ids).queryByText('what a tape')).not.toBeInTheDocument();

    const talk = screen.getByTestId('comments');
    expect(within(talk).getByText('what a tape')).toBeInTheDocument();
    // An ID said in a sentence is talk; only the site's own one-line form is a log entry.
    expect(within(talk).getByText('The track at 12:34 is Moby - Go')).toBeInTheDocument();
    expect(within(talk).queryByText('Moby — Go')).not.toBeInTheDocument();
    expect(within(talk).queryByText('Josh')).not.toBeInTheDocument();
  });

  it('is not there, heading and all, on a tape with no ID posts', async () => {
    comments = [comment(1, 'Rents', 'what a tape', '2026-11-01T10:00:00Z')];
    page();
    expect(await screen.findByText('what a tape')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Track IDs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Track IDs' })).not.toBeInTheDocument();
  });

  it('is newest first, says where each is the way the player writes it, and says an unnamed one is unknown', async () => {
    comments = [
      comment(1, 'Josh', '[12:34] Moby - Go', '2026-11-02T10:00:00Z'),
      comment(2, 'Dana', '[1:02:03] ? - ?', '2026-11-05T10:00:00Z'),
    ];
    page();

    const entries = within(await log()).getAllByRole('listitem');
    expect(entries.map((entry) => entry.textContent)).toEqual(['1:02:03 Unknown trackDana · Nov 5, 2026', '0:12:34 Moby — GoJosh · Nov 2, 2026']);
  });

  it('shows the latest five of a long log, and the rest when asked, with the keyboard on the first of them', async () => {
    const user = userEvent.setup();
    comments = Array.from({ length: 8 }, (_, i) => comment(i + 1, 'Rents', `[A ${i}:00] Artist ${i} - Title ${i}`, `2026-11-0${i + 1}T10:00:00Z`));
    page();

    const ids = await log();
    // An entry not shown has no role to be found by, as it has none for a screen reader.
    expect(within(ids).getAllByRole('listitem')).toHaveLength(5);
    expect(within(ids).getByText('Artist 7 — Title 7')).toBeInTheDocument();
    expect(within(ids).queryByRole('button', { name: 'Play from A 0:02:00' })).not.toBeInTheDocument();

    await user.click(within(ids).getByRole('button', { name: 'Show all 8 IDs' }));
    expect(within(ids).getAllByRole('listitem')).toHaveLength(8);
    expect(within(ids).queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
    // The sixth newest is the first of those just shown.
    expect(within(ids).getByRole('button', { name: 'Play from A 0:02:00' })).toHaveFocus();
  });
});
