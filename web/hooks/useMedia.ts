import { useSyncExternalStore } from 'react';

/**
 * A screen as narrow as a phone's. There the track ID blanks are a sheet over the page, with a row each, and
 * the line under the player gives way to a tray at the foot of the screen (the stylesheet hides the line at
 * the same width). A wider screen has the player's own bar there instead, once the player is out of sight.
 */
export const PHONE = '(max-width: 39.99rem)';

// One watcher for each width asked about, made once: a new function each time would have the listener taken
// off and put back on with every tick of the tape.
const watchers = new Map<string, (changed: () => void) => () => void>();
const watch = (query: string) => {
  let watcher = watchers.get(query);
  if (!watcher) {
    watcher = (changed) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', changed);
      return () => media.removeEventListener('change', changed);
    };
    watchers.set(query, watcher);
  }
  return watcher;
};

/** Whether the screen answers to a media query, kept up to date. Not before the page is in a browser. */
export function useMedia(query: string) {
  return useSyncExternalStore(
    watch(query),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Whether the screen is as narrow as a phone's. */
export const useOnPhone = () => useMedia(PHONE);
