'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true while any <audio> element on the page is playing.
 *
 * Uses capture-phase listeners on document so the hook catches events
 * from audio elements rendered after this hook mounts. play/pause
 * events don't bubble, so capture phase is required to see them at
 * the document level.
 */
export function useAnyAudioPlaying(): boolean {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const update = () => {
      const anyPlaying = Array.from(document.querySelectorAll('audio')).some(
        (a) => !a.paused,
      );
      setPlaying(anyPlaying);
    };

    document.addEventListener('play', update, true);
    document.addEventListener('pause', update, true);
    document.addEventListener('ended', update, true);

    update();

    return () => {
      document.removeEventListener('play', update, true);
      document.removeEventListener('pause', update, true);
      document.removeEventListener('ended', update, true);
    };
  }, []);

  return playing;
}
