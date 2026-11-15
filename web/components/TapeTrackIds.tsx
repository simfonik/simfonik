'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { RunningOrder, TrackId } from '../lib/track-ids/compose';

/** Takes the tape to a moment on a side. `position` is the side's label, or null on a tape with one side. */
type GoTo = (position: string | null, time: number) => void;

/** A comment posted through the site, as /api/comments/[tapeId] gives it. */
export type TapeComment = { id: number; tape_id: string; author_name: string; content: string; created_at: string };

type TapeTrackIds = {
  /** The IDs the comments give: one list per side, in the order the tape has its sides. Empty until they arrive. */
  sides: TrackId[][];
  /** Each side's tracks in order, where a list gives them without times (see lib/track-ids/read.ts). */
  orders: (RunningOrder | null)[];
  /**
   * The comments posted through the site, oldest first; null until they have been read. They are read once
   * here for both of the places that show them: the comment list, and the log of the IDs among them.
   */
  comments: TapeComment[] | null;
  /** Counts up each time the comments are known to have changed. Whatever shows comments reads them again. */
  changed: number;
  /** A comment has been posted: read everything again. */
  refresh: () => void;
  /** The player says how to take the tape to a moment; a time written in a comment can then be pressed. */
  setPlayer: (goTo: GoTo | null) => void;
  goTo: GoTo;
};

const nothing: TapeTrackIds = { sides: [], orders: [], comments: null, changed: 0, refresh: () => {}, setPlayer: () => {}, goTo: () => {} };
const Context = createContext<TapeTrackIds>(nothing);

/**
 * What a tape page's separate parts share about track IDs: the player, far up the page, and the comments and
 * the log of ID posts, far down it. The IDs are read from the comments (see lib/track-ids/read.ts), so when a
 * comment is posted from either place all are told, and a time in the log can send the player to it.
 */
export function TapeTrackIdsProvider({ tapeId, children }: { tapeId: string; children: ReactNode }) {
  const [{ sides, orders }, setRead] = useState<Pick<TapeTrackIds, 'sides' | 'orders'>>({ sides: [], orders: [] });
  const [comments, setComments] = useState<TapeComment[] | null>(null);
  const [changed, setChanged] = useState(0);
  const player = useRef<GoTo | null>(null);

  useEffect(() => {
    let current = true;
    fetch(`/api/track-ids/${tapeId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((data: Pick<TapeTrackIds, 'sides' | 'orders'>) => {
        if (current) setRead({ sides: data.sides, orders: data.orders });
      })
      .catch((error) => console.error('Failed to load track IDs:', error));
    fetch(`/api/comments/${tapeId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((data: TapeComment[]) => {
        if (current) setComments(data);
      })
      .catch((error) => {
        console.error('Failed to load comments:', error);
        // Nothing to show is told apart from still reading: the page stops saying it is loading.
        if (current) setComments([]);
      });
    return () => {
      current = false;
    };
  }, [tapeId, changed]);

  const refresh = useCallback(() => setChanged((n) => n + 1), []);
  const setPlayer = useCallback((goTo: GoTo | null) => {
    player.current = goTo;
  }, []);
  const goTo = useCallback<GoTo>((position, time) => player.current?.(position, time), []);

  const value = useMemo(() => ({ sides, orders, comments, changed, refresh, setPlayer, goTo }), [sides, orders, comments, changed, refresh, setPlayer, goTo]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The tape's track IDs and the ways to act on them. Outside a tape page there are none, and the ways do nothing. */
export const useTapeTrackIds = () => useContext(Context);
