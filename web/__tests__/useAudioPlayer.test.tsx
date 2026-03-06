import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

// Mock global fetch
global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));

describe('useAudioPlayer', () => {
  let audioNode: HTMLAudioElement;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    audioNode = document.createElement('audio');
    
    // happy-dom doesn't implement media playback out of the box, so we stub it
    audioNode.play = vi.fn().mockImplementation(() => {
      audioNode.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
    audioNode.pause = vi.fn().mockImplementation(() => {
      audioNode.dispatchEvent(new Event('pause'));
    });
    
    document.body.appendChild(audioNode);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to mount hook properly and trigger effects
  const setupHook = (initialProps: any) => {
    return renderHook((dynamicProps: any) => {
      const result = useAudioPlayer(dynamicProps);
      // Assign the ref during render so effects fire immediately
      if (result.ref) {
        (result.ref as any).current = audioNode;
      }
      return result;
    }, { initialProps });
  };

  it('updates state on play and pause controls', async () => {
    const { result } = setupHook({ src: 'test.mp3' });
    
    // play is mocked in our setup file to return a resolved promise
    await act(async () => {
      result.current.controls.play();
    });
    
    expect(audioNode.play).toHaveBeenCalled();
    expect(result.current.state.isPlaying).toBe(true);

    act(() => {
      result.current.controls.pause();
    });

    expect(audioNode.pause).toHaveBeenCalled();
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('fires /api/track-play exactly once per track load when playback first starts', async () => {
    setupHook({ src: 'test.mp3', tapeId: 'tape-1', sidePosition: 'A' });

    await act(async () => {
      audioNode.dispatchEvent(new Event('play'));
    });
    
    await act(async () => {
      audioNode.dispatchEvent(new Event('pause'));
    });
    
    await act(async () => {
      audioNode.dispatchEvent(new Event('play'));
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/track-play', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ tapeId: 'tape-1', sidePosition: 'A' })
    }));
  });

  it('resets tracking and fires again when src changes', async () => {
    const { rerender } = setupHook({ src: 'test1.mp3', tapeId: 'tape-1', sidePosition: 'A' });
    
    audioNode.src = 'test1.mp3';

    await act(async () => {
      audioNode.dispatchEvent(new Event('play'));
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Change source
    rerender({ src: 'test2.mp3', tapeId: 'tape-1', sidePosition: 'B' });
    audioNode.src = 'test2.mp3';

    await act(async () => {
      audioNode.dispatchEvent(new Event('play'));
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenLastCalledWith('/api/track-play', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ tapeId: 'tape-1', sidePosition: 'B' })
    }));
  });

  it('resets currentTime and error state on src change without affecting isPlaying', async () => {
    const { result, rerender } = setupHook({ src: 'test1.mp3' });
    
    act(() => {
      audioNode.currentTime = 50;
      audioNode.dispatchEvent(new Event('timeupdate'));
      audioNode.dispatchEvent(new Event('error'));
    });
    
    // Explicitly set playing state 
    await act(async () => {
      result.current.controls.play();
    });

    expect(result.current.state.currentTime).toBe(50);
    expect(result.current.state.error).toBeTruthy();
    expect(result.current.state.isPlaying).toBe(true);

    // Note: since our mock play doesn't throw, we don't have to catch AbortError here.
    await act(async () => {
      rerender({ src: 'test2.mp3' });
    });

    expect(result.current.state.currentTime).toBe(0);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isPlaying).toBe(true);
  });

  it('swallows AbortError naturally during source transitions', async () => {
    const { result, rerender } = setupHook({ src: 'test1.mp3' });

    // Make play() reject with AbortError
    audioNode.play = vi.fn().mockRejectedValue({ name: 'AbortError' });
    
    // We force the internal isPlaying state to true without calling controls.play()
    // because that mock is specifically to test the re-render auto-play effect in useAudioPlayer
    await act(async () => {
      audioNode.dispatchEvent(new Event('play'));
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      rerender({ src: 'test2.mp3' });
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(result.current.state.isPlaying).toBe(true);
  });

  it('cleans up event listeners on unmount', () => {
    const { unmount } = setupHook({ src: 'test.mp3' });

    // In happy-dom the spy needs to be on the node instance directly or on EventTarget
    const removeSpy = vi.spyOn(audioNode, 'removeEventListener');

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('play', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
