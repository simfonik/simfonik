"use client";

// Trainspotter — help ID the music on a tape.
// The timeline is one UI SDK primitive (ranges on tracks). It opens showing what listeners have already
// ID'd in the comments; a visitor plays the tape and IDs what they recognise. Every change goes through the
// SDK's change pipeline, so one history gives undo and redo and knows who made each change. The page is
// operable by a browser's own assistant through the same bridge that loads the listeners' tracklist.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPointerKind } from "@ui-sdk/core";
import { solveSpring } from "@ui-sdk/core/gesture";
import { usePart, usePrimitive } from "@ui-sdk/react/primitive";
import { usePreference } from "@ui-sdk/react/preferences";
import { useShortcut } from "@ui-sdk/react/shortcuts";
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from "@ui-sdk/react/slider";
import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { Toast, ToastAction, ToastClose, ToastDescription, ToastRegion, ToastTitle, createToaster } from "@ui-sdk/react/toast";
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle } from "@ui-sdk/react/drawer";
import { reconcile, type Listed, type Proposal, type Sighting } from "./parse";
import { DEFAULT_LENGTH, clock, cueLabel, tracklist, type Cue } from "./tracklist-primitive";
import { ordersFor, placeNames, suggestNames } from "./names";
import { ChangesFold, CommentsFold, NamesFold, SendItIn, StillUnknown } from "./below-the-tape";
import { IdBar, IdSheetForm, Shortcuts, UndoRedo, type IdDraft } from "./id-form";
import { awayFrom } from "./keys";
import { PhoneBar, Player } from "./player";
import { useChanges } from "./use-changes";
import { outline } from "./waveform";
import { useTapeAudio } from "./use-tape-audio";
import { GUTTER, useTimeline } from "./use-timeline";
import { followComments, near, origin, readSaved, toCue as cueFrom, type Saved, type Spot } from "./saved";
import { TapeSwitcher, type TapeEntry } from "./tape-switcher";

type TapeProp = { id: string; title: string; djs: string; djCount: number; released: string; sides: { key: string; title: string; audio: string | null }[] };

// One bridge for the page. Every UI SDK component registers with it, including the timeline.
const pointerKind = createPointerKind();
const toaster = createToaster();


function Track({ value, ...props }: { value: string } & React.ComponentProps<"div">) {
  return usePart(tracklist, "track", { value }, props, "div");
}
function CuePart({ value, ...props }: { value: string } & React.ComponentProps<"div">) {
  return usePart(tracklist, "cue", { value }, props, "div");
}

export function Trainspotter({
  tape,
  sightings,
  complete,
  listed,
  official,
  others,
  waves,
}: {
  tape: TapeProp;
  sightings: Sighting[];
  /** False when the newer comments couldn't be read, and `sightings` is the archive's alone. */
  complete: boolean;
  listed: Listed[];
  official: Listed[][];
  /** Every tape with something to work on, in the order the switcher lists them. */
  others: TapeEntry[];
  /** Each side's loudness along its length, where it has been measured (see `outline`). */
  waves: (number[] | null)[] | null;
}) {
  const sides = useMemo(() => tape.sides.map((s) => s.key), [tape.sides]);
  // A set of several tapes (eight DJs, eight recordings) shows one part at a time, chosen from a row of parts.
  // Stacked, the rows would bury the one being listened to under seven that aren't.
  const many = sides.length > 2;
  const storageKey = `simfonik:trainspotter:${tape.id}`;
  // Behaviour forks on the pointer; styling forks on media queries in the stylesheet.
  const touch = usePreference(pointerKind).pointer === "coarse";

  const audio = useTapeAudio(tape.sides.length);
  const { audios, durations, failed, active, activeRef, playing, now, seek, toggle } = audio;

  // What the comments said, reconciled into one proposal per moment. An unmeasured side is treated as endless, so a slow connection never drops an ID for being "past the end".
  // How long each side is: what its audio says or, until it does, what it said on an earlier visit.
  const [remembered, setRemembered] = useState<(number | null)[]>([]);
  const lengths = useMemo(() => durations.map((d, i) => d ?? remembered[i] ?? null), [durations, remembered]);
  const proposals = useMemo(() => reconcile(sightings, lengths.map((d) => d ?? Infinity)), [sightings, lengths]);
  const toCue = useCallback((p: Proposal): Cue => cueFrom(p, sides), [sides]);

  // It starts as what the comments say, so the tracks are in the HTML the server sends. Saved work, if this
  // browser has any, takes its place as soon as the page can read it.
  const [cues, setCues] = useState<Cue[]>(() => reconcile(sightings, tape.sides.map(() => Infinity)).map((p) => cueFrom(p, tape.sides.map((s) => s.key))));
  const cuesRef = useRef(cues);
  cuesRef.current = cues;
  const [restored, setRestored] = useState<"pending" | "saved" | "fresh">("pending");
  // True once the page holds the tracklist it should: saved work, or the listeners' version on a first visit.
  // Nothing is written to storage before that, so closing the tab mid-load can't save an empty tape.
  const [ready, setReady] = useState(false);
  const saveFailed = useRef(false);
  // What this visitor took off the timeline, and whose times are whose (see `Saved`). `moved` is null for work
  // saved before the page recorded it.
  const gone = useRef<Spot[]>([]);
  const moved = useRef<Set<string> | null>(new Set());
  useEffect(() => {
    let found: ReturnType<typeof readSaved> = null;
    try {
      found = readSaved(window.localStorage.getItem(storageKey), window.localStorage.getItem(`${storageKey}:seen`) !== null);
    } catch {
      /* storage is unavailable */
    }
    if (found) {
      setCues(found.cues);
      gone.current = found.removed;
      moved.current = found.moved;
      setRemembered(found.lengths);
      setReady(true);
    }
    setRestored(found ? "saved" : "fresh");
  }, [storageKey]);
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ v: 2, cues, removed: gone.current, moved: [...(moved.current ?? [])], lengths } satisfies Saved));
      window.localStorage.removeItem(`${storageKey}:seen`); // the earlier versions' bookkeeping
      saveFailed.current = false;
    } catch {
      saveFailed.current = true; // private mode, or storage is full; the toasts say so
    }
  }, [cues, lengths, ready, storageKey]);

  // The timeline is as long as the longest thing it has to show: a measured side, or the last known track.
  const length = useMemo(() => {
    const shown = (i: number) => !many || i === active;
    const measured = lengths.filter((_, i) => shown(i));
    const unmeasured = measured.every((d) => d === null) ? DEFAULT_LENGTH : 0;
    // A track whose end is only a guess (the last one anyone timed on a side) doesn't get to stretch the
    // timeline: until that side's audio reports its length the guess can run four minutes past the real end,
    // which made the whole tape draw at a scrolling scale and then snap to fit a moment later.
    const reach = (x: { start: number; end: number; open?: boolean }) => (x.open ? x.start + 30 : x.end);
    const ends = [...cues.filter((c) => shown(sides.indexOf(c.track))).map(reach), ...proposals.filter((p) => shown(p.side)).map(reach)];
    return Math.max(60, unmeasured, ...measured.map((d) => d ?? 0), ...ends);
  }, [lengths, cues, proposals, many, active, sides]);
  const sideLength = (i: number) => lengths[i] ?? length;
  // Where a side's sound has been measured, the overview's lane takes its shape.
  const outlines = useMemo(() => (waves ?? []).map((levels) => (levels ? outline(levels) : null)), [waves]);
  const [sheet, setSheet] = useState(false); // the ID sheet, on phones
  const timeline = useTimeline({ audio, length, many, rows: sides.length, sheet });
  const { scrollerRef, headRef, ghostRef, mapRef, mapWindowRef, mapHeadRef, minutes, snapUntil, scrubAt, scrub, scrubEnd, rulerDown, mapDown, mapMove, mapUp, mapCancel } = timeline;

  const [selected, setSelected] = useState<string | null>(null);
  const wantName = useRef(false);
  // The ID sheet must not cover the track being ID'd. The page moves only when it would (the sheet's edge
  // lands on the timeline, the keyboard lifts the sheet over it, or the timeline is off the screen), by as
  // little as clears it, and goes back when the sheet closes. It glides on the sheet's own spring, so the two
  // read as one movement; with reduced motion it is simply there.
  const [sheetEl, setSheetEl] = useState<HTMLElement | null>(null);
  const pageBefore = useRef(0); // where the page was when the sheet opened
  const pageGlide = useRef(0);
  const stopGlide = useRef(() => {});
  const glidePage = useCallback((to: number) => {
    stopGlide.current();
    const from = window.scrollY;
    if (Math.abs(to - from) < 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return window.scrollTo({ top: to });
    const spring = solveSpring(0.34, 1, from - to, 0); // the SDK's sheet spring
    const t0 = performance.now();
    // The visitor's own scrolling wins: a wheel, a finger or a key ends the glide where it is.
    const theirs = ["wheel", "touchstart", "keydown"] as const;
    const stop = () => {
      cancelAnimationFrame(pageGlide.current);
      theirs.forEach((type) => window.removeEventListener(type, stop));
      stopGlide.current = () => {};
    };
    stopGlide.current = stop;
    theirs.forEach((type) => window.addEventListener(type, stop, { passive: true }));
    const tick = (now: number) => {
      const off = spring.position(now - t0);
      const done = Math.abs(off) < 0.5;
      window.scrollTo({ top: done ? to : to + off });
      if (done) stop();
      else pageGlide.current = requestAnimationFrame(tick);
    };
    pageGlide.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => stopGlide.current(), []); // not into the next tape's page
  const keepClear = useCallback(() => {
    const tape = scrollerRef.current?.getBoundingClientRect();
    if (!sheetEl || !tape) return;
    const view = window.visualViewport;
    const top = view?.offsetTop ?? 0;
    // Where the sheet's top edge rests: above the keyboard when it is up, else at the bottom of the screen.
    const edge = top + (view?.height ?? window.innerHeight) - sheetEl.offsetHeight;
    const by = tape.top < top + 8 ? tape.top - top - 8 : tape.bottom > edge - 12 ? Math.min(tape.top - top - 8, tape.bottom - edge + 12) : 0;
    if (by) glidePage(window.scrollY + by);
  }, [sheetEl, scrollerRef, glidePage]);
  useEffect(() => {
    if (!sheetEl) return;
    const sized = new ResizeObserver(keepClear); // as it opens, and if what it holds changes height
    sized.observe(sheetEl);
    window.visualViewport?.addEventListener("resize", keepClear); // the keyboard coming up
    return () => {
      sized.disconnect();
      window.visualViewport?.removeEventListener("resize", keepClear);
    };
  }, [sheetEl, keepClear]);
  const openSheet = useCallback((id?: string | null) => {
    pageBefore.current = window.scrollY;
    toaster.dismiss(); // a lingering confirmation would sit on top of the fields
    // The track goes to the middle of the timeline. One too long to fit shows from its start, where its name is.
    const sc = scrollerRef.current;
    const el = id ? (sc?.querySelector(`[data-span-id="${CSS.escape(id)}"]`) as HTMLElement | null) : null;
    if (sc && el) sc.scrollLeft = Math.max(0, el.offsetWidth > sc.clientWidth - GUTTER ? el.offsetLeft : el.offsetLeft + el.offsetWidth / 2 - sc.clientWidth / 2 + GUTTER / 2);
    setSheet(true);
  }, [scrollerRef]);
  const closeSheet = useCallback(() => {
    setSheet(false);
    // Back to where the visitor was, such as their place in the unknown list.
    requestAnimationFrame(() => glidePage(pageBefore.current));
  }, [glidePage]);
  const focusName = useCallback(
    (id?: string | null) => {
      if (touch) requestAnimationFrame(() => openSheet(id));
      else requestAnimationFrame(() => (document.getElementById("ts-artist") as HTMLInputElement | null)?.focus());
    },
    [touch, openSheet],
  );

  // Every change to the timeline, with who made it. It is the undo stack.
  const { rootRef, writing, entries, position, floor, canUndo, canRedo, step, confirmWithUndo, rewrite, untouched, settle } = useChanges({ toaster, saveFailed });

  const handle = usePrimitive(tracklist, {
    value: cues,
    onValueChange: (v: Cue[], details: { source?: string }) => {
      // A track a person has just marked is the one they want to ID next.
      const added = v.filter((c) => !cuesRef.current.some((b) => b.id === c.id));
      if (added.length === 1 && details?.source !== "agent" && !writing.current) setSelected(added[0].id);
      // A time changed by anything but the page's own writing from the comments is the visitor's.
      if (!writing.current)
        for (const c of v) {
          const was = cuesRef.current.find((b) => b.id === c.id);
          if (was && c.by && (was.start !== c.start || was.end !== c.end)) (moved.current ??= new Set()).add(c.id);
        }
      cuesRef.current = v; // at once: the page's next change in line works from this, not from the last render
      setCues(v);
    },
    sides,
    length,
  });
  const api = handle.api;

  // First visit to a tape: the page opened holding what the comments know, so there is nothing to wait for.
  useEffect(() => {
    if (restored === "fresh") setReady(true);
  }, [restored]);

  // The timeline follows the comments as the page comes to know more. The comments are read against how long
  // each side is, which is known once the audio says (or was remembered from an earlier visit): a track can't
  // run past the end of its side, and a list that timed the tape as one recording is split between the sides.
  //  · A first visit nobody has touched takes the comments' tracklist as it now reads. That is still part of
  //    setting up, so undo stops after it.
  //  · Otherwise the timeline is brought in line the way a return visit is (the rules are in
  //    `followComments`), which keeps everything the visitor did, and says so if tracks came or went.
  // Not from a reading that is missing the newer comments, on a return visit: their tracks would look "gone".
  useEffect(() => {
    if (!ready || (restored === "saved" && !complete)) return;
    let settingUp = false;
    let found: ReturnType<typeof followComments> = null;
    void rewrite(() => {
      settingUp = restored === "fresh" && untouched();
      if (settingUp) {
        const next = proposals.map(toCue);
        return JSON.stringify(next) === JSON.stringify(cuesRef.current) ? null : next;
      }
      found = followComments({ cues: cuesRef.current, removed: gone.current, moved: moved.current }, proposals, sides);
      // `followComments` leaves the end of the last track on a side alone; the side's length does not.
      let cut = false;
      const next = (found?.cues ?? cuesRef.current).flatMap((c) => {
        const d = lengths[sides.indexOf(c.track)];
        if (d == null || c.end <= d || !c.by) return [c];
        cut = true;
        return c.start > d - 5 ? [] : [{ ...c, end: d }];
      });
      return found || cut ? next : null;
    }).then((ok) => {
      if (!ok) return;
      if (settingUp) return settle();
      if (!found) return;
      const parts = [found.added ? `added ${found.added}` : "", found.corrected ? `corrected ${found.corrected}` : "", found.removed ? `removed ${found.removed} misread` : ""].filter(Boolean).join(", ");
      confirmWithUndo(`Updated from the comments: ${parts}.`);
    });
  }, [proposals, lengths, ready, restored, complete, sides, toCue, rewrite, untouched, settle, confirmWithUndo]);

  const startOver = async () => {
    gone.current = []; // starting over forgets what was removed, too
    moved.current = new Set(); // and whose times were whose
    if (await rewrite(() => proposals.map(toCue))) {
      setSelected(null);
      confirmWithUndo("Back to the IDs from the comments.");
    }
  };

  // In a text field these keys belong to the field: they undo typing, not the tracklist.
  const notTyping = () => !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement);
  useShortcut("mod+z", () => canUndo && void step(-1), { description: "Undo", when: notTyping });
  useShortcut("mod+shift+z", () => canRedo && void step(1), { description: "Redo", when: notTyping });

  // The track under the playhead, on the side that is playing.
  const playingCue = useMemo(
    () =>
      cues
        .filter((c) => c.track === sides[active] && c.start <= now && now < c.end)
        .sort((a, b) => b.start - a.start)[0] ?? null,
    [cues, sides, active, now],
  );

  // "Mark new track": mark it at the playhead and go straight to ID'ing it.
  const markHere = useCallback(() => {
    const a = audios.current[activeRef.current];
    const t = Math.floor(a?.currentTime ?? 0);
    // A second press within a few seconds means "this one", not "another one on top of it".
    const same = cuesRef.current.find((c) => c.track === sides[activeRef.current] && Math.abs(c.start - t) < 5);
    if (same) {
      setSelected(same.id);
      focusName(same.id);
      return;
    }
    wantName.current = api.markAt(sides[activeRef.current], t) !== false;
  }, [api, sides, focusName, activeRef, audios]);
  useEffect(() => {
    if (selected && wantName.current) {
      wantName.current = false;
      focusName(selected);
    }
  }, [selected, focusName]);
  const idIt = (id: string) => {
    // Where one part shows at a time, go to the part this track is on, so it is on screen to be ID'd.
    const cue = cuesRef.current.find((c) => c.id === id);
    const side = cue ? sides.indexOf(cue.track) : -1;
    if (many && cue && side >= 0 && side !== activeRef.current) seek(side, cue.start);
    setSelected(id);
    focusName(id);
  };
  // Changing part leaves behind a selection that is no longer on screen.
  useEffect(() => {
    if (many) setSelected((id) => (cuesRef.current.find((c) => c.id === id)?.track === sides[active] ? id : null));
  }, [many, active, sides]);
  // The sheet is about the picked track. If that track goes (an undo, a change of part), so does the sheet;
  // left "open" with nothing in it, it would hold the tape still for good.
  useEffect(() => {
    if (sheet && !cues.some((c) => c.id === selected)) closeSheet();
  }, [sheet, cues, selected, closeSheet]);

  // ← and →: the previous or next track, from wherever the keyboard is. The audio goes with it, and keeps
  // playing if it was playing. With no track picked, it steps from the one under the playhead.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const stepTrack = useCallback(
    (dir: -1 | 1) => {
      const picked = cuesRef.current.find((c) => c.id === selectedRef.current);
      const side = picked ? sides.indexOf(picked.track) : activeRef.current;
      const row = cuesRef.current.filter((c) => c.track === sides[side]).sort((a, b) => a.start - b.start);
      let to: Cue | undefined;
      if (picked) to = row[row.indexOf(picked) + dir];
      else {
        const t = audios.current[side]?.currentTime ?? 0;
        const sofar = row.filter((c) => c.start <= t);
        to = dir > 0 ? row.find((c) => c.start > t) : (sofar[sofar.length - 2] ?? sofar[0]);
      }
      if (!to) return;
      const id = to.id;
      setSelected(id);
      snapUntil.current = performance.now() + 600; // a key press: the tape goes there without a glide
      seek(side, to.start);
      // Focus the block: it scrolls into view, and the keys that act on a track now act on this one.
      requestAnimationFrame(() => (scrollerRef.current?.querySelector(`[data-span-id="${CSS.escape(id)}"]`) as HTMLElement | null)?.focus());
    },
    [sides, seek, activeRef, audios, scrollerRef, snapUntil],
  );

  // The page's keys are the SDK's shortcuts: it leaves plain keys to whoever is typing, holds them while a
  // dialog is open, takes a held key as one press, and can say which are available for the list of keys.
  // What it can't know is where a key already means something on this page, so each says where it stands
  // aside: Space and M on a button or link (where Space presses it), the arrows on the scrubber, the part
  // picker or an open list. A focused track is none of those.
  const offControls = useMemo(() => awayFrom("button, a, input, [role=slider], [role=option]"), []);
  const arrowsFree = useMemo(() => awayFrom("input, [role=slider], [role=radio], [role=radiogroup], [role=option], [role=listbox], [role=combobox]"), []);
  useShortcut("space", toggle, { description: "Play or pause", when: offControls });
  useShortcut("arrowleft", () => stepTrack(-1), { description: "Previous track", when: arrowsFree });
  useShortcut("arrowright", () => stepTrack(1), { description: "Next track", when: arrowsFree });
  useShortcut("m", markHere, { description: "Mark new track", when: offControls });
  // A held key is one press. The SDK ignores the key's repeats, which leaves them to the browser, and the
  // browser reads a held arrow as "scroll the timeline" and a held Space as "scroll the page": the track
  // just stepped to would slide out of view. Where one of these keys is the page's, its repeats do nothing.
  useEffect(() => {
    const once = (e: KeyboardEvent) => {
      if (!e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === " " ? offControls() : (e.key === "ArrowLeft" || e.key === "ArrowRight") && arrowsFree()) e.preventDefault();
    };
    window.addEventListener("keydown", once);
    return () => window.removeEventListener("keydown", once);
  }, [offControls, arrowsFree]);

  // Names waiting for a time: the site's own tracklist if there is one, else a list kept in the comments.
  const orders = useMemo(() => ordersFor(listed, official, sides.length), [listed, official, sides]);
  const fromSite = official.some((o) => o.length > 0);
  // Which track on the timeline carries each listed name, and the names still without one.
  const placed = useMemo(() => orders.map((order, side) => placeNames(order, cues.filter((c) => c.track === sides[side]))), [orders, cues, sides]);
  const waiting = useMemo(() => orders.map((order, side) => order.filter((l) => l.known && !placed[side].has(l))), [orders, placed]);
  const namesWaiting = waiting.reduce((n, w) => n + w.length, 0);

  const sel = cues.find((c) => c.id === selected) ?? null;
  // The track the ID fields are about: the one picked, or failing that the one under the playhead. So the
  // fields are always there and always about something: press play, hear a track you know, and type. Putting
  // the cursor in a field picks that track, so it stays put while the tape plays on to the next one.
  const subject = sel ?? playingCue;
  const nextNames = useMemo(() => {
    if (!subject) return [];
    const side = sides.indexOf(subject.track);
    return suggestNames(subject, orders[side] ?? [], placed[side] ?? new Map(), cues.filter((c) => c.track === subject.track));
  }, [subject, sides, orders, placed, cues]);
  // What else people said about that track's moment.
  const opinions = useMemo(() => {
    if (!subject) return [];
    const side = sides.indexOf(subject.track);
    return proposals.find((p) => p.side === side && Math.abs(p.start - subject.start) <= 20)?.also ?? [];
  }, [subject, sides, proposals]);

  // An unknown track's "title" is only a listener's clue ("you can't run"), so it never pre-fills the field.
  const shownTitle = subject?.known ? subject.title : "";
  const [draft, setDraft] = useState({ artist: "", title: "" });
  useEffect(() => {
    setDraft({ artist: subject?.artist ?? "", title: shownTitle });
  }, [subject?.id, subject?.artist, shownTitle]);
  // The picked track is let go when the playhead leaves it, by the tape playing on or by being moved. From
  // then on the fields, and the bar on a phone, are about what you are hearing, not what you tapped a minute
  // ago. Not while you are IDing it: the sheet open, the cursor in a field, or something typed and not saved.
  // And not when it was the track that left the playhead: moved or trimmed, it is still being worked on.
  const heard = useRef<{ id: string; start: number; end: number } | null>(null);
  useEffect(() => {
    const was = heard.current;
    heard.current = playingCue ? { id: playingCue.id, start: playingCue.start, end: playingCue.end } : null;
    if (was === null || was.id === heard.current?.id || selected !== was.id) return;
    if (sel && (sel.start !== was.start || sel.end !== was.end)) return;
    const typed = draft.artist.trim() !== (sel?.artist ?? "") || draft.title.trim() !== (sel?.known ? sel.title : "");
    if (!sheet && !document.activeElement?.closest(".ts-idbar-fields") && !typed) setSelected(null);
    // Only when the track under the playhead changes; what was picked and typed is read as it stands then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingCue?.id]);
  const abandoning = useRef(false);
  const saveId = (artist = draft.artist, title = draft.title) => {
    if (abandoning.current) return false;
    const a = artist.trim();
    const t = title.trim();
    if (!subject || (a === subject.artist && t === shownTitle)) return false;
    if (!a && !t) {
      // Both fields emptied on an ID'd track: that is how it goes back to unknown. On an unknown one there
      // is nothing to save.
      if (!subject.known) return false;
      api.renameCue(subject.id, "", "");
      confirmWithUndo("Set back to unknown.");
      return true;
    }
    api.renameCue(subject.id, a, t);
    confirmWithUndo(`ID’d: ${[a, t].filter(Boolean).join(" — ")}`, "Saved on this device.");
    return true;
  };
  const remove = (cue: Cue | null = subject) => {
    if (!cue) return;
    // Keep the keyboard somewhere useful: the next track on that side, or the one before.
    const row = cuesRef.current.filter((c) => c.track === cue.track).sort((a, b) => a.start - b.start);
    const i = row.findIndex((c) => c.id === cue.id);
    const neighbour = row[i + 1] ?? row[i - 1];
    // Removing a track the comments supplied is remembered, so it doesn't come back on the next visit.
    const from = origin(cue);
    if (from) gone.current = [...gone.current.filter((spot) => !near(spot, from)), from];
    api.removeCue(cue.id);
    setSelected(null);
    if (sheet) closeSheet();
    else if (neighbour) requestAnimationFrame(() => (scrollerRef.current?.querySelector(`[data-span-id="${CSS.escape(neighbour.id)}"]`) as HTMLElement | null)?.focus());
    confirmWithUndo(`Removed ${cueLabel(cue)}.`);
  };

  // A press that didn't travel is a click: on bare tape it moves the playhead. A drag is the SDK's to handle.
  const down = useRef<{ x: number; y: number } | null>(null);
  const wasClick = (e: React.MouseEvent) => {
    const d = down.current;
    return !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5;
  };

  const unknownCount = cues.filter((c) => !c.known).length;
  // What is on screen: the one part of a multi-part tape, else the whole tape. The intro and the lines shown
  // when nothing is picked speak about this, so they never mention tracks that are on some other part.
  const here = cues.filter((c) => !many || c.track === sides[active]);
  const audioFailed = failed[active];

  // The unknown list follows the timeline: every side of a two-sided tape, or the one part on screen.
  const unknownHere = cues.filter((c) => !c.known && (!many || c.track === sides[active])).sort((a, b) => a.track.localeCompare(b.track) || a.start - b.start);
  const elsewhereUnknown = cues.filter((c) => !c.known && c.track !== sides[active]).length;
  const unknownParts = sides.filter((k) => k !== sides[active] && cues.some((c) => !c.known && c.track === k));
  // A compilation is named by its title and the part being heard, not by a line of eight DJs.
  const compactTitle = tape.djCount > 3;
  const partTitle = (i: number) => (tape.sides[i]?.title && !/^side\b/i.test(tape.sides[i].title) ? tape.sides[i].title : null);
  const partName = partTitle(active);
  // What to do, in one line, always the same shape: press play and do one thing. The counts are in the list
  // of tapes and the lists below.
  const intro =
    namesWaiting > 0 && fromSite
      ? "We know the tracklist but not the times. Press play and mark where each track starts."
      : // Names someone listed in a comment are a start, not the tracklist.
        namesWaiting > 0 && !cues.length
        ? "Some tracks are named in the comments, without times. Press play and mark where each one starts."
        : here.length
        ? here.some((c) => !c.known)
          ? "Press play and help ID the unknowns."
          : "Press play and mark any track that’s missing."
        : "Press play and mark the first track you know.";

  // IDing: the fields, the likely names and what else was said, for the bar (mouse) and the sheet (phone).
  const idForm: IdDraft = { draft, setDraft, save: saveId, remove: () => remove(), names: nextNames, opinions, fromSite };
  const pickedBlock = () => scrollerRef.current?.querySelector("[data-selected]") as HTMLElement | null;
  const undoRedo = <UndoRedo canUndo={canUndo} canRedo={canRedo} onStep={(by) => void step(by)} />;

  const root = usePart(
    handle,
    "root",
    {},
    {
      ref: rootRef,
      "aria-label": "Tracklist timeline",
      className: "ts-rows",
      children: ({ cues: live }: { cues: Cue[] }) => (
        <>
          {tape.sides.map((side, i) => (many && i !== active ? null : (
            <div key={side.key} className="ts-row">
              <button type="button" className="ts-side" onClick={() => seek(i, audios.current[i]?.currentTime ?? 0)} aria-pressed={i === active} aria-label={`Listen to side ${side.key}${side.title && side.title !== `Side ${side.key}` ? `, ${side.title}` : ""}`}>
                {side.key}
              </button>
              <Track
                value={side.key}
                className="ts-track"
                style={{ backgroundSize: `${(60 / length) * 100}% 100%` }}
                onPointerDown={(e: React.PointerEvent) => {
                  down.current = { x: e.clientX, y: e.clientY };
                }}
                onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                  // Click bare tape to go there.
                  if (wasClick(e)) seek(i, Math.min(api.spans.valueAt(side.key, e.clientX, e.clientY), sideLength(i)));
                }}
              >
                {lengths[i] !== null && lengths[i]! < length && <div className="ts-beyond" style={{ left: `${(lengths[i]! / length) * 100}%` }} aria-hidden />}
                {live
                  .filter((c) => c.track === side.key)
                  .map((c) => (
                    <CuePart
                      key={c.id}
                      value={c.id}
                      className="ts-cue"
                      // Read by the pointer's time label, which names the track it is over.
                      data-name={c.known ? cueLabel(c) : c.title ? `Unknown. Clue: “${c.title}”` : "Unknown"}
                      data-selected={c.id === selected ? "" : undefined}
                      data-playing={c.id === playingCue?.id ? "" : undefined}
                      aria-current={c.id === selected ? "true" : undefined}
                      onClick={(e: React.MouseEvent) => {
                        // A click on a track picks it and plays it from its start, whichever side it is on.
                        // It stops here so the tape underneath doesn't also seek to wherever the click landed.
                        e.stopPropagation();
                        if (!wasClick(e)) return;
                        setSelected(c.id);
                        seek(i, c.start, true);
                      }}
                      onFocus={() => setSelected(c.id)}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          idIt(c.id);
                        } else if (e.key === "Delete" || e.key === "Backspace") {
                          e.preventDefault();
                          remove(c);
                        }
                      }}
                    >
                      <span className="ts-edge" data-span-edge="start" aria-hidden />
                      <span className="ts-cue-text">
                        {/* An unknown track shows nothing but its hatching. Its label, the pointer's time label and the
                            list below say "unknown" in words. */}
                        {c.known && (
                          <>
                            <b>{c.artist || c.title}</b>
                            <i>{c.artist ? c.title : ""}</i>
                          </>
                        )}
                      </span>
                      <span className="ts-edge" data-span-edge="end" aria-hidden />
                    </CuePart>
                  ))}
              </Track>
            </div>
          )))}
        </>
      ),
    },
    "div",
  );

  return (
    <section className="ts-page mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12" aria-label="Help ID the tracks on this tape">
      {tape.sides.map((s, i) => (
        <audio
          key={s.key}
          ref={(el) => {
            audios.current[i] = el;
          }}
          src={s.audio ?? undefined}
          // Of eight recordings, only the one on screen is worth asking the audio host about.
          preload={many && i !== active ? "none" : "metadata"}
          playsInline
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <TapeSwitcher tapes={others} currentId={tape.id} />
        {/* Above the title: its tall letters reach up past their own line and would otherwise sit over this link. */}
        <p className="relative z-[1] -mr-[0.14em] font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          Released {tape.released} ·{" "}
          <Link href={`/tapes/${tape.id}`} className="ts-inline-link">
            Tape page
          </Link>
        </p>
      </div>
      <h1 className="-ml-[0.038em] mt-5 font-display text-4xl leading-[0.95] text-[var(--text)] [text-wrap:balance] sm:text-6xl">
        {compactTitle ? (
          <>
            {tape.title} <span className="text-[var(--muted)]">{partName ?? `${tape.djCount} DJs`}</span>
          </>
        ) : (
          <>
            {tape.djs} <span className="text-[var(--muted)]">{tape.title}</span>
          </>
        )}
      </h1>
      <p className="mt-3 max-w-[60ch] text-[17px] text-[var(--text)] [text-wrap:pretty]">{intro}</p>

      <Player audioFailed={audioFailed} playing={playing} cue={playingCue} side={sides[active]} now={now} duration={durations[active]} onToggle={toggle} onId={idIt} onMark={markHere} />

      {many && (
        <SegmentedControl
          aria-label="Part of this set"
          value={sides[active]}
          onValueChange={(v: string | null) => {
            const i = v === null ? -1 : sides.indexOf(v);
            if (i >= 0 && i !== active) seek(i, audios.current[i]?.currentTime ?? 0);
          }}
          className="ts-parts mt-5"
        >
          {tape.sides.map((side, i) => {
            const left = cues.filter((c) => c.track === side.key && !c.known).length;
            return (
              <SegmentedControlItem key={side.key} value={side.key} className="ts-part">
                <b>{side.key}</b>
                {partTitle(i) && <span>{partTitle(i)}</span>}
                {left > 0 && (
                  <i>
                    {left}
                    <span className="sr-only"> unknown</span>
                  </i>
                )}
              </SegmentedControlItem>
            );
          })}
        </SegmentedControl>
      )}

      {/* The stylesheet turns the tape's length into its width: see .ts-canvas. */}
      <div className={`ts-root ${many ? "mt-2" : "mt-4"}`} style={{ "--minutes": length / 60 } as React.CSSProperties}>
        <div className="ts-scroller" ref={scrollerRef}>
          <div className="ts-canvas">
            {/* The ruler is the scrubber: a slider the width of the tape. It sits outside the tracklist
                so that moving through the audio is never recorded as a change to the tracklist. */}
            <div className="ts-ruler" onPointerDownCapture={rulerDown}>
              <Slider value={Math.min(scrubAt ?? now, length)} onValueChange={scrub} onValueCommit={scrubEnd} min={0} max={length} step={1} largeStep={15} format={clock}>
                <SliderControl
                  className="ts-scrub"
                  // A press focuses the handle, and browsers show a focus ring for it as if it were keyboard
                  // focus (on a phone, a box around the marker for as long as it stays focused). The ring is
                  // for the keyboard: a press silences it until a key is used or focus leaves.
                  onPointerDownCapture={(e: React.PointerEvent<HTMLElement>) => e.currentTarget.setAttribute("data-quiet", "")}
                  onKeyDownCapture={(e: React.KeyboardEvent<HTMLElement>) => e.currentTarget.removeAttribute("data-quiet")}
                  onBlur={(e: React.FocusEvent<HTMLElement>) => e.currentTarget.removeAttribute("data-quiet")}
                >
                  <SliderTrack className="ts-scrub-track">
                    {Array.from({ length: Math.floor(minutes / 5) + 1 }, (_, i) => (
                      <span key={i} className="ts-tick" style={{ left: `${((i * 300) / length) * 100}%` }} aria-hidden>
                        {clock(i * 300)}
                      </span>
                    ))}
                    <SliderIndicator className="ts-scrub-fill" />
                    <SliderThumb className="ts-scrub-thumb" aria-label={`Position in side ${sides[active]}`} />
                  </SliderTrack>
                </SliderControl>
              </Slider>
            </div>
            {root}
            {/* The playhead. One element, so the marker and the line cannot part company. The slider's handle is
                still under the marker, invisible, for dragging and for the keyboard. */}
            <div ref={headRef} className="ts-head" style={{ left: GUTTER }} aria-hidden>
              {/* The cap: drawn as a path, not clipped from a box, so its curves and its point are exact. Eleven
                  wide around a one-pixel line, so its point lands dead centre on the line. */}
              <svg className="ts-head-cap" width="11" height="13" viewBox="0 0 11 13">
                <path d="M2 0h7a2 2 0 0 1 2 2v4.4L5.5 13 0 6.4V2a2 2 0 0 1 2-2Z" />
              </svg>
              <span className="ts-head-pole" />
              <span className="ts-head-pass" />
              <span className="ts-head-line" />
            </div>
            <div ref={ghostRef} className="ts-ghost" aria-hidden>
              <span className="ts-ghost-time">
                <b className="font-normal" />
                <span />
              </span>
            </div>
          </div>
        </div>
        {/* The whole tape at a glance, when it doesn't all fit: the rows above in miniature, drawn the same way
            (grey for ID'd, hatched for unknown, solid for what's playing), with the part that is off screen
            dimmed and a faint band behind what is on screen. Press or drag it to go there (a finger: tap, or drag sideways). It is a second
            way to scroll, so it stays out of the accessibility tree; the timeline itself scrolls for everyone. */}
        {/* Always in the page, and folded shut by the stylesheet when the whole tape is on screen. */}
        <div className="ts-map-fold">
          <div
            ref={mapRef}
            className="ts-map"
            style={{ marginLeft: GUTTER }}
            aria-hidden
            onPointerDown={mapDown}
            onPointerMove={mapMove}
            onPointerUp={mapUp}
            onPointerCancel={mapCancel}
          >
            {/* Inside a clipped box of its own, so the band can dim everything outside itself. */}
            <div className="ts-map-tape">
              {tape.sides.map((side, i) =>
                many && i !== active ? null : (
                  <div
                    key={side.key}
                    className="ts-map-lane"
                    data-wave={outlines[i] ? "" : undefined}
                    style={outlines[i] ? { maskImage: outlines[i], WebkitMaskImage: outlines[i], maskSize: `${((lengths[i] ?? length) / length) * 100}% 100%`, WebkitMaskSize: `${((lengths[i] ?? length) / length) * 100}% 100%` } : undefined}
                  >
                    {lengths[i] !== null && lengths[i]! < length && <span style={{ left: `${(lengths[i]! / length) * 100}%` }} />}
                    {cues
                      .filter((c) => c.track === side.key)
                      .map((c) => (
                        <i key={c.id} data-known={c.known ? "" : undefined} data-playing={c.id === playingCue?.id ? "" : undefined} style={{ left: `${(c.start / length) * 100}%`, width: `${((c.end - c.start) / length) * 100}%` }} />
                      ))}
                  </div>
                ),
              )}
              <div ref={mapHeadRef} className="ts-map-head" />
              <div ref={mapWindowRef} className="ts-map-window" />
            </div>
          </div>
        </div>
      </div>

      {/* Under the timeline. Both layouts are in the page and the stylesheet shows the one that fits the
          pointer, so a phone never paints the mouse layout first and then swaps it. Each keeps one height in
          every state. */}
      <div className="ts-namebar">
        <div className="ts-fine-only">
          <IdBar
            form={idForm}
            subject={subject}
            playingId={playingCue?.id ?? null}
            empty={here.length === 0}
            onPick={() => {
              if (!sel && playingCue) setSelected(playingCue.id);
            }}
            onAbandon={() => {
              if (subject) setDraft({ artist: subject.artist, title: shownTitle });
              // Moving focus out of the bar would save what was typed, which is what Escape is refusing.
              abandoning.current = true;
              pickedBlock()?.focus();
              abandoning.current = false;
            }}
            onNamed={() => requestAnimationFrame(() => pickedBlock()?.focus())}
          >
            {undoRedo}
            <Shortcuts />
          </IdBar>
        </div>
        {/* Phone: the track's name, what to do with it and its ID button are all in the bar pinned to the
            bottom of the screen, once. Undo and Redo are what is left here. */}
        <div className="ts-coarse-only">
          <div className="-mr-2.5 flex h-11 items-center justify-end gap-1">{undoRedo}</div>
        </div>
      </div>

      <Drawer open={sheet && Boolean(sel) && touch} onOpenChange={(open: boolean) => (open ? setSheet(true) : closeSheet())}>
        <DrawerBackdrop className="ts-backdrop" />
        <DrawerContent ref={setSheetEl} className="ts-sheet">
          <div data-slot="grip" className="ts-grip" aria-hidden />
          {sel && (
            <>
              <div className="flex items-start justify-between gap-3">
                <DrawerTitle className="font-display text-2xl leading-tight text-[var(--text)]">{sel.known ? "Fix ID" : "What is this track?"}</DrawerTitle>
                <DrawerClose className="ts-link flex-none">Close</DrawerClose>
              </div>
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)] tabular-nums">
                {sel.track} {clock(sel.start)}–{clock(sel.end)}
              </p>
              <div className="mt-3">
                <IdSheetForm form={idForm} track={sel} onClose={closeSheet} onReplay={() => seek(sides.indexOf(sel.track), sel.start, true)} />
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {ready && unknownCount > 0 && (
        <StillUnknown
          tracks={unknownHere}
          part={many ? `${sides[active]}${partName ? ` · ${partName}` : ""}` : null}
          elsewhere={{ count: elsewhereUnknown, parts: unknownParts }}
          onHear={(c) => seek(sides.indexOf(c.track), c.start, true)}
          onId={idIt}
        />
      )}

      <div className="mt-10 grid gap-x-12 gap-y-8 lg:grid-cols-2">
        <SendItIn tapeId={tape.id} sides={sides} cues={cues} />
        <div className="min-w-0">
          <NamesFold orders={orders} placed={placed} sides={sides} fromSite={fromSite} onHear={(side, time) => seek(side, time, true)} />
          <CommentsFold proposals={proposals} sides={sides} onHear={(side, time) => seek(side, time, true)} />
          <ChangesFold entries={entries} floor={floor} position={position} />
          {proposals.length > 0 && (
            <button type="button" onClick={() => void startOver()} className="ts-link -ml-2.5 mt-2 !text-[var(--muted)] hover:!text-[var(--text)]">
              Start over from the comments’ IDs
            </button>
          )}
        </div>
      </div>

      <PhoneBar audioFailed={audioFailed} playing={playing} subject={subject} empty={here.length === 0} side={sides[active]} now={now} onToggle={toggle} onId={idIt} onMark={markHere} />

      <ToastRegion toaster={toaster} side="bottom" align="center" className="ts-toasts">
        {() => (
          <Toast className="ts-toast">
            <div className="min-w-0 flex-1">
              <ToastTitle className="text-[15px] font-medium leading-snug" />
              <ToastDescription className="mt-0.5 text-sm opacity-75" />
            </div>
            <ToastAction className="ts-toast-btn" />
            <ToastClose className="ts-toast-btn" aria-label="Dismiss">
              ✕
            </ToastClose>
          </Toast>
        )}
      </ToastRegion>
    </section>
  );
}
