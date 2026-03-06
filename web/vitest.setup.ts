import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Create a robust mock for HTMLAudioElement that simulates browser behavior
class AudioMock {
  src = '';
  currentTime = 0;
  duration = 100;
  playbackRate = 1;
  paused = true;
  readyState = 4; // HAVE_ENOUGH_DATA
  
  // Need to track listeners rigorously to verify cleanup in Spec 0019
  public listeners: Record<string, Function[]> = {};

  addEventListener(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  removeEventListener(event: string, callback: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  dispatchEvent(event: Event) {
    const callbacks = this.listeners[event.type] || [];
    callbacks.forEach(cb => cb(event));
    return true;
  }

  // We explicitly make play() a mock so we can resolve or reject it to test AbortError
  play = vi.fn().mockImplementation(() => {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });

  pause = vi.fn().mockImplementation(() => {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  });
}

// Apply the mock to the global window object provided by jsdom
// @ts-ignore
global.window.HTMLAudioElement = AudioMock;
