import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlaylistPlayer } from '../components/PlaylistPlayer';

// Mock our fetch API globally to prevent unhandled rejection spam if track-play fires
global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));

const mockTracks = [
  { title: 'Track 1', url: 'track1.mp3', position: 'A' },
  { title: 'Track 2', url: 'track2.mp3', position: 'B' },
];

describe('PlaylistPlayer Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('auto-advances to the next track when the current track fires the ended event', async () => {
    const user = userEvent.setup();
    render(<PlaylistPlayer tracks={mockTracks} tapeId="tape-1" />);

    // Track 1 should be active initially
    expect(screen.getByText('Track 1')).toBeInTheDocument();
    
    // Find the embedded audio element
    const audioNode = document.querySelector('audio');
    expect(audioNode).toBeTruthy();
    expect(audioNode?.src).toContain('track1.mp3');

    // Simulate clicking play on the main controls
    // (Using getByRole relies on the svg having an aria-label, but PlaylistPlayer has a button wrapping the play/pause logic)
    // Wait, PlayerControls doesn't explicitly label the toggle, let's just trigger from the track list
    
    const track1Button = screen.getByRole('button', { name: /track 1/i });
    await user.click(track1Button);

    // Simulate the audio finishing ('ended' event fires)
    await act(async () => {
      audioNode?.dispatchEvent(new Event('ended'));
    });

    // The PlaylistPlayer should have caught the onEnded prop from useAudioPlayer,
    // advanced currentTrackIndex, and assigned the new src to the audio node.
    expect(audioNode?.src).toContain('track2.mp3');
  });

  it('says the times on the rows: each side\'s length, and how far in the loaded side is once it has started', async () => {
    const timed = [
      { ...mockTracks[0], length: 1831 },
      { ...mockTracks[1], length: 1829 },
    ];
    render(<PlaylistPlayer tracks={timed} tapeId="tape-1" />);
    const [first, second] = [screen.getByRole('button', { name: /track 1/i }), screen.getByRole('button', { name: /track 2/i })];

    // At rest: a length on each row, and no clock anywhere.
    expect(first).toHaveTextContent('Track 10:30:31');
    expect(second).toHaveTextContent('Track 20:30:29');
    expect(document.body).not.toHaveTextContent('0:00:00');

    const audioNode = document.querySelector('audio')!;
    await act(async () => {
      audioNode.currentTime = 441;
      audioNode.dispatchEvent(new Event('timeupdate'));
    });

    expect(first).toHaveTextContent('Track 10:07:21 / 0:30:31');
    expect(second).toHaveTextContent('Track 20:30:29');
    // The row's name for a screen reader stays its side and length; the slider says how far in the tape is.
    expect(first).toHaveAccessibleName('Track 1 0:30:31');
  });
});
