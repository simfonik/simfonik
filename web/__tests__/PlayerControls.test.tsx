// The player kept in reach (components/PlayerControls.tsx): on a wide screen, once the tape has been played
// and the player is out of sight, a second one at the foot of the window.
import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayerControls, type PlayerControlsProps } from '../components/PlayerControls';
import type { Mark } from '../lib/track-ids/side';

const IDS = [
  { start: 0, end: 300, artist: 'Orbital', title: 'Chime', known: true },
  { start: 300, end: 600, artist: '', title: '', known: false },
] as Mark[];

/** The page, with the player in the window or scrolled out of it at the test's word. */
function page({ phone = false, wide = false, ...props }: Partial<PlayerControlsProps> & { phone?: boolean; wide?: boolean } = {}) {
  document.body.innerHTML = '';
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: (phone && query === '(max-width: 39.99rem)') || (wide && query === '(min-width: 70rem)'), media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList);
  let seen: (inWindow: boolean) => void = () => {};
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        seen = (inWindow) => callback([{ isIntersecting: inWindow }]);
      }
      observe() {}
      disconnect() {}
    },
  );
  const pressed = { onPlay: vi.fn(), onPause: vi.fn(), onSeek: vi.fn() };
  const all: PlayerControlsProps = { isPlaying: true, currentTime: 65, duration: 600, isLoading: false, title: 'Side A', ids: IDS, ...pressed, ...props };
  const { rerender } = render(<PlayerControls {...all} />);
  return {
    ...pressed,
    scrolledAway: () => act(() => seen(false)),
    scrolledBack: () => act(() => seen(true)),
    now: (more: Partial<PlayerControlsProps>) => rerender(<PlayerControls {...all} {...more} />),
    bar: () => screen.queryByRole('group', { name: 'Player' }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the player kept in reach', () => {
  it('is at the foot of the window while the player is out of sight, with what is playing and where the tape is, and goes when the player is back', () => {
    const the = page();
    expect(the.bar()).toBeNull();
    the.scrolledAway();
    expect(the.bar()).toHaveTextContent('Orbital — Chime');
    expect(the.bar()).toHaveTextContent('Side A · 0:01:05 / 0:10:00');
    the.now({ currentTime: 301 });
    expect(the.bar()).toHaveTextContent('Unknown track');
    expect(the.bar()).toHaveTextContent('Side A · 0:05:01 / 0:10:00');
    the.scrolledBack();
    expect(the.bar()).toBeNull();
  });

  it('plays, pauses and moves the tape as the player does', async () => {
    const the = page();
    the.scrolledAway();
    const bar = within(the.bar() as HTMLElement);
    await userEvent.click(bar.getByRole('button', { name: 'Pause' }));
    expect(the.onPause).toHaveBeenCalledTimes(1);
    the.now({ isPlaying: false });
    await userEvent.click(bar.getByRole('button', { name: 'Play' }));
    expect(the.onPlay).toHaveBeenCalledTimes(1);
    expect(bar.getByRole('slider', { name: 'Seek audio: Side A' })).toHaveValue('65');
  });

  it('says so where nothing has been ID’d, and leaves out a side’s name the tape hasn’t got', () => {
    const the = page({ ids: [], title: undefined });
    the.scrolledAway();
    expect(the.bar()).toHaveTextContent('Nothing ID’d here yet');
    expect(the.bar()).toHaveTextContent('0:01:05 / 0:10:00');
    expect(the.bar()).not.toHaveTextContent('·');
  });

  it('is not there before the tape has been played', () => {
    const the = page({ isPlaying: false, currentTime: 0 });
    the.scrolledAway();
    expect(the.bar()).toBeNull();
    // Paused part of the way in, the tape has been played.
    the.now({ isPlaying: false, currentTime: 65 });
    expect(the.bar()).not.toBeNull();
  });

  it('is not there on a phone, which has its tray', () => {
    const the = page({ phone: true });
    the.scrolledAway();
    expect(the.bar()).toBeNull();
  });

  it('on a window wide enough for one row, has a place at its start for what else belongs at the foot of the window, and says when the place is there and when it has gone', () => {
    const onBarLead = vi.fn();
    const the = page({ wide: true, onBarLead });
    expect(onBarLead).not.toHaveBeenCalled();
    the.scrolledAway();
    const place = onBarLead.mock.lastCall?.[0] as HTMLElement;
    expect(the.bar()).toContainElement(place);
    // First on the row: before the button, under the page's left edge.
    expect(place.compareDocumentPosition(within(the.bar() as HTMLElement).getByRole('button', { name: 'Pause' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    the.scrolledBack();
    expect(onBarLead.mock.lastCall?.[0]).toBeNull();
  });

  it('has no such place on a narrower window, where there is no room on the row', () => {
    const onBarLead = vi.fn();
    const the = page({ onBarLead });
    the.scrolledAway();
    expect(the.bar()).not.toBeNull();
    expect(onBarLead).not.toHaveBeenCalled();
  });

  it('has no second bar of its own, and leaves what is under the player where it is', () => {
    const the = page({ children: <p>Know this track? ID it</p> });
    the.scrolledAway();
    expect(screen.getAllByRole('group', { name: 'Player' })).toHaveLength(1);
    expect(screen.getAllByText('Know this track? ID it')).toHaveLength(1);
    expect(within(the.bar() as HTMLElement).queryByText('Know this track? ID it')).toBeNull();
  });
});
