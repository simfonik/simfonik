import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TrackIds } from '../components/TrackIds';
import type { TrackId } from '../lib/track-ids/compose';

const ids: TrackId[] = [
  { start: 0, end: 120, artist: 'Moby', title: 'Go', known: true, by: 'Rents' },
  { start: 300, end: 420, artist: '', title: '', known: false, by: 'Josh' },
];

describe('track IDs under the player', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let posted: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    posted = vi.fn<() => void>();
    fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ success: true, message: 'Comment posted' }), { status: 200 })));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const body = () => JSON.parse(fetchMock.mock.calls[0][1].body);

  it('says what is playing, who ID’d it, and what can be done about it', () => {
    const { rerender } = render(<TrackIds tapeId="tape-1" position="A" ids={ids} time={60} onPosted={posted} />);
    expect(screen.getByText('Moby — Go')).toBeInTheDocument();
    expect(screen.getByText('ID by Rents')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Correct this ID' })).toBeInTheDocument();

    rerender(<TrackIds tapeId="tape-1" position="A" ids={ids} time={200} onPosted={posted} />);
    expect(screen.getByText('No ID here yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ID this track' })).toBeInTheDocument();

    rerender(<TrackIds tapeId="tape-1" position="A" ids={ids} time={310} onPosted={posted} />);
    expect(screen.getByText('Unknown track')).toBeInTheDocument();
    expect(screen.getByText('Marked by Josh')).toBeInTheDocument();
  });

  it('posts an ID as a comment that carries the side and the moment the form was opened', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TrackIds tapeId="tape-1" position="B" ids={ids} time={754.6} onPosted={posted} />);

    await user.click(screen.getByRole('button', { name: 'ID this track' }));
    expect(screen.getByRole('textbox', { name: 'Artist' })).toHaveFocus();
    // The tape plays on; the form stays on the moment it was opened for.
    rerender(<TrackIds tapeId="tape-1" position="B" ids={ids} time={790} onPosted={posted} />);

    await user.type(screen.getByRole('textbox', { name: 'Artist' }), '808 State');
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Cubik');
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Tester{Enter}');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/comments/submit');
    expect(body()).toEqual({ tapeId: 'tape-1', authorName: 'Tester', authorEmail: '', content: '[B 12:34] 808 State - Cubik', website: '' });
    expect(posted).toHaveBeenCalledTimes(1);

    // The form has shut, the button has the keyboard again, and the name is offered next time.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ID this track' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Posted. Thanks.');
    await user.click(screen.getByRole('button', { name: 'ID this track' }));
    expect(screen.getByRole('textbox', { name: 'Your name' })).toHaveValue('Tester');
  });

  it('puts a known ID right at the time that track starts, and writes no side on a tape that is one recording', async () => {
    const user = userEvent.setup();
    render(<TrackIds tapeId="tape-1" position={null} ids={ids} time={95} onPosted={posted} />);

    await user.click(screen.getByRole('button', { name: 'Correct this ID' }));
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Go (Woodtick Mix)');
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Tester{Enter}');

    expect(body().content).toBe('[0:00] ? - Go (Woodtick Mix)');
  });

  it('asks for what is missing on its own line and posts nothing until it has it', async () => {
    const user = userEvent.setup();
    render(<TrackIds tapeId="tape-1" position="A" ids={ids} time={200} onPosted={posted} />);

    await user.click(screen.getByRole('button', { name: 'ID this track' }));
    await user.click(screen.getByRole('button', { name: /post id/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the artist or the title.');
    expect(screen.getByRole('textbox', { name: 'Artist' })).toHaveFocus();

    await user.type(screen.getByRole('textbox', { name: 'Artist' }), 'Moby');
    await user.click(screen.getByRole('button', { name: /post id/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your name.');
    expect(screen.getByRole('textbox', { name: 'Your name' })).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ID this track' })).toHaveFocus();
  });

  it('says what the server said when it refuses, and keeps what was typed', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), { status: 429 })));
    render(<TrackIds tapeId="tape-1" position="A" ids={ids} time={200} onPosted={posted} />);

    await user.click(screen.getByRole('button', { name: 'ID this track' }));
    await user.type(screen.getByRole('textbox', { name: 'Artist' }), 'Moby');
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Tester{Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent('Too many requests. Please try again later.');
    expect(screen.getByRole('textbox', { name: 'Artist' })).toHaveValue('Moby');
    expect(posted).not.toHaveBeenCalled();
  });
});
