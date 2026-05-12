'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks the currentTime + duration of whichever <audio> element on
 * the page is currently playing. Returns zeros when nothing is
 * playing. Uses capture-phase listeners on document so events from
 * audio elements rendered after this hook mounts are still seen
 * (play/pause/timeupdate/seeked don't bubble).
 */
export function useCurrentTrackTime(): { currentTime: number; duration: number } {
  const [time, setTime] = useState({ currentTime: 0, duration: 0 });

  useEffect(() => {
    const update = () => {
      const playing = Array.from(document.querySelectorAll('audio')).find(
        (a) => !a.paused,
      );
      if (playing) {
        setTime({
          currentTime: playing.currentTime,
          duration: Number.isFinite(playing.duration) ? playing.duration : 0,
        });
      } else {
        setTime({ currentTime: 0, duration: 0 });
      }
    };

    document.addEventListener('timeupdate', update, true);
    document.addEventListener('play', update, true);
    document.addEventListener('pause', update, true);
    document.addEventListener('seeked', update, true);
    document.addEventListener('ended', update, true);

    update();

    return () => {
      document.removeEventListener('timeupdate', update, true);
      document.removeEventListener('play', update, true);
      document.removeEventListener('pause', update, true);
      document.removeEventListener('seeked', update, true);
      document.removeEventListener('ended', update, true);
    };
  }, []);

  return time;
}
