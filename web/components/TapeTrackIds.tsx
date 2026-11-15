'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { TrackId } from '../lib/track-ids/compose';

/** Takes the tape to a moment on a side. `position` is the side's label, or null on a tape with one side. */
type GoTo = (position: string | null, time: number) => void;

type TapeTrackIds = {
  /** The IDs the comments give: one list per side, in the order the tape has its sides. Empty until they arrive. */
  sides: TrackId[][];
  /** Counts up each time the comments are known to have changed. Whatever shows comments reads them again. */
  changed: number;
  /** A comment has been posted: read everything again. */
  refresh: () => void;
  /** The player says how to take the tape to a moment; a time written in a comment can then be pressed. */
  setPlayer: (goTo: GoTo | null) => void;
  goTo: GoTo;
};

const nothing: TapeTrackIds = { sides: [], changed: 0, refresh: () => {}, setPlayer: () => {}, goTo: () => {} };
const Context = createContext<TapeTrackIds>(nothing);

/**
 * What a tape page's separate parts share about track IDs: the player, far up the page, and the comments, far
 * down it. The IDs are read from the comments (see lib/track-ids/read.ts), so when a comment is posted from
 * either place both are told, and a time in a comment can send the player to it.
 */
export function TapeTrackIdsProvider({ tapeId, children }: { tapeId: string; children: ReactNode }) {
  const [sides, setSides] = useState<TrackId[][]>([]);
  const [changed, setChanged] = useState(0);
  const player = useRef<GoTo | null>(null);

  useEffect(() => {
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
  }, [tapeId, changed]);

  const refresh = useCallback(() => setChanged((n) => n + 1), []);
  const setPlayer = useCallback((goTo: GoTo | null) => {
    player.current = goTo;
  }, []);
  const goTo = useCallback<GoTo>((position, time) => player.current?.(position, time), []);

  const value = useMemo(() => ({ sides, changed, refresh, setPlayer, goTo }), [sides, changed, refresh, setPlayer, goTo]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The tape's track IDs and the ways to act on them. Outside a tape page there are none, and the ways do nothing. */
export const useTapeTrackIds = () => useContext(Context);
