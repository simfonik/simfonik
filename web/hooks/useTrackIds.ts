import { useCallback, useEffect, useState } from 'react';
import type { TrackId } from '../lib/track-ids/compose';

/**
 * The track IDs the comments give for a tape: one list per side, in the order the tape has its sides. Empty
 * until they arrive, and if they can't be fetched. `refresh` reads them again, after an ID has been posted.
 */
export function useTrackIds(tapeId: string | undefined) {
  const [sides, setSides] = useState<TrackId[][]>([]);
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    if (!tapeId) return;
    let current = true;
    fetch(`/api/track-ids/${tapeId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((data: { sides: TrackId[][] }) => {
        if (current) setSides(data.sides);
      })
      .catch((error) => console.error('Failed to load track IDs:', error));
    return () => {
      current = false;
    };
  }, [tapeId, asked]);

  const refresh = useCallback(() => setAsked((n) => n + 1), []);
  return { sides, refresh };
}
