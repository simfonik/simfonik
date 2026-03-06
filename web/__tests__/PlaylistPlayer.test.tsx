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
});
