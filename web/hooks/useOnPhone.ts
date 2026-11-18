import { useSyncExternalStore } from 'react';

/**
 * A screen as narrow as a phone's. There the track ID blanks are a sheet over the page, with a row each, and
 * the line under the player gives way to a tray at the foot of the screen (the stylesheet hides the line at
 * the same width). A wider screen has the player's own bar there instead, once the player is out of sight.
 */
export const PHONE = '(max-width: 39.99rem)';

// (Outside the hook: a new function each time would have the listener taken off and put back on with every
// tick of the tape.)
const watchPhone = (changed: () => void) => {
  const media = window.matchMedia(PHONE);
  media.addEventListener('change', changed);
  return () => media.removeEventListener('change', changed);
};

/** Whether the screen is that narrow, kept up to date. Not before the page is in a browser. */
export function useOnPhone() {
  return useSyncExternalStore(
    watchPhone,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}
