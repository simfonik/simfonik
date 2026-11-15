// Tracklist: a timed tracklist as ranges on a timeline, one track per tape side.
// With a mouse you draw a range, drag it to move it and drag an end to trim it; overlaps are blends.
// Touch never draws or drags, so a finger can scroll the tape. The same methods are offered to agents
// through the `agent` key, so a model or a browser's own assistant can do the trainspotting.
import { createChange, createSpans, definePrimitive, stackSpans, type Span, type SpansDraft } from "@ui-sdk/core";

export type Cue = Span & {
  artist: string;
  title: string;
  known: boolean;
  /** Who identified it, when it came from a comment. */
  by?: string;
  /** The end is a guess: nobody has said where this track stops, only where it starts. */
  open?: boolean;
};

type TracklistOptions = {
  value?: Cue[];
  defaultValue?: Cue[];
  onValueChange?: (value: Cue[], details: { source?: string; reason?: string }) => void;
  /** Track keys, one per tape side, in order. */
  sides?: string[];
  /** Length of the longest side, in seconds. */
  length?: number;
};

type TracklistState = { value: Cue[]; draft: SpansDraft<Cue> | null; focused: string | null };

export const cueLabel = (cue: Pick<Cue, "artist" | "title" | "known">) =>
  cue.known ? [cue.artist, cue.title].filter(Boolean).join(" — ") || "Untitled" : cue.title ? `Unknown track (“${cue.title}”)` : "Unknown track";

/** A time on the tape, always h:mm:ss with its zeros (0:05:15), the one format the page uses. */
export const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};
/** The reason `setValue` reports: the whole tracklist was put in place at once, not edited. */
export const REPLACED = "replace";
/** Used until a side's audio reports its real length. */
export const DEFAULT_LENGTH = 47 * 60;
let made = 0;
const newId = () => `cue-${Date.now().toString(36)}-${++made}`;

/**
 * A track as given from outside (an agent's arguments, a saved copy), made safe: times whole and in order, at
 * least five seconds long, on a side the tape has. Null if it has no usable times.
 *
 * It is not held to the length of the timeline. The timeline may be showing one part of a set of several, and
 * a write of the whole tracklist (an undo, a return visit, "start over") carries the tracks of every part:
 * cut to the shown part's length, a track 70 minutes into part D would land at the 40-minute end of part A.
 */
export function tidyCue(input: Partial<Cue>, sides: string[]): Cue | null {
  const track = sides.includes(String(input.track)) ? String(input.track) : sides[0];
  const start = Math.max(0, Math.round(Number(input.start)));
  const end = Math.max(start + 5, Math.round(Number(input.end ?? start + 180)));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const artist = String(input.artist ?? "").slice(0, 120);
  const title = String(input.title ?? "").slice(0, 160);
  return { id: input.id ? String(input.id) : newId(), track, start, end, artist, title, known: input.known ?? Boolean(artist || title), by: input.by ? String(input.by).slice(0, 60) : undefined, open: input.open ? true : undefined };
}

export const tracklist = definePrimitive({
  name: "tracklist",
  options: { value: "value", defaultValue: "value", onValueChange: "callback", sides: "list", length: "number" },
  controlled: ["value"],
  state: (options: TracklistOptions): TracklistState => ({
    value: options.value ?? options.defaultValue ?? [],
    draft: null,
    focused: null,
  }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => {
    const change = createChange(context);
    const length = () => context.options().length ?? DEFAULT_LENGTH;
    const sides = () => context.options().sides ?? ["A"];

    const spans = createSpans<TracklistState, Cue>(context, {
      key: "value",
      draft: "draft",
      set: (value, details) => change("value", value, details),
      axis: "x",
      min: () => 0,
      max: length,
      step: () => 1,
      minSize: () => 5,
      // No `size`: a plain click on empty tape is for moving the playhead, not for making a track.
      overlap: true, // two records playing at once is the point of a mix
      tracks: sides,
      create: (span) => ({ ...span, id: newId(), artist: "", title: "", known: false }),
      label: (cue) => cueLabel(cue),
      // Say what happened in a listener's words, not an editor's.
      message: ({ type, span, label }) =>
        type === "draw"
          ? `Marked a track from ${clock(span.start)} to ${clock(span.end)}.`
          : type === "delete"
            ? `Removed ${label}.`
            : type === "cancel"
              ? "Left as it was."
              : `${label} now runs ${clock(span.start)} to ${clock(span.end)}.`,
    });

    const current = () => context.store.get().value;
    const tidy = (input: Partial<Cue>) => tidyCue(input, sides());

    return {
      spans,
      /** Replaces the whole tracklist. It reports a reason of its own, so a history can tell it from an edit. */
      setValue: (value: Partial<Cue>[]) =>
        change("value", (Array.isArray(value) ? value : []).map(tidy).filter((c): c is Cue => c !== null), { reason: REPLACED }),
      /** Marks one track: `{ track, start, end, artist, title }`, times in seconds. */
      addCue: (cue: Partial<Cue>) => {
        const next = tidy(cue);
        return next ? change("value", [...current(), next], { reason: "imperative" }) : false;
      },
      /**
       * "Mark new track": marks one at `time` and ends whatever was playing before it. Refused where a track
       * already starts: marking is offered to assistants, which may add tracks but not remove them, and a mark
       * on top of a track would replace it.
       */
      markAt: (track: string, time: number) => {
        const t = sides().includes(String(track)) ? String(track) : sides()[0];
        const start = Math.max(0, Math.min(length() - 5, Math.round(Number(time))));
        if (!Number.isFinite(start) || current().some((c) => c.track === t && Math.abs(c.start - start) < 5)) return false;
        const next = current()
          .filter((c) => c.track === t && c.start > start + 5)
          .sort((a, b) => a.start - b.start)[0];
        // Pressed in the middle of a track: this splits it, and the first part now ends here.
        const split = current()
          .filter((c) => c.track === t && c.start < start && c.end > start)
          .sort((a, b) => b.end - a.end)[0];
        // If that track's end was known, the new one takes the rest of it and no more. If its end was only
        // a guess (it was marked by ear and nothing has followed it yet), the new one gets a guess of its own;
        // otherwise marking tracks one after another would leave each a stub of the last one's guess.
        const known = split && !split.open ? split.end : Infinity;
        const until = Math.min(next?.start ?? Infinity, known);
        const guessed = !Number.isFinite(until);
        const end = Math.max(start + 5, Math.min(guessed ? start + 240 : until, length()));
        const before = current()
          .map((c) => (c.track === t && c.start < start && c.end > start ? { ...c, end: start, open: undefined } : c))
          .filter((c) => c.end - c.start >= 5);
        return change("value", [...before, { id: newId(), track: t, start, end, artist: "", title: "", known: false, open: guessed ? true : undefined }], { reason: "imperative" });
      },
      /** Names a marked track. A name someone types replaces whoever was credited before. */
      renameCue: (id: string, artist: string, title: string) => {
        const a = String(artist ?? "").slice(0, 120);
        const t = String(title ?? "").slice(0, 160);
        return spans.update(String(id), { artist: a, title: t, known: Boolean(a || t), by: undefined });
      },
      removeCue: (id: string) => spans.remove(String(id)),
      /**
       * Keys on a focused track. Changing a track's times takes Alt, so it can't happen by accident. Plain
       * arrows are left to the page, which uses them to step between tracks and move the audio with them.
       * Up and Down are left alone (a track never jumps to the other side of the tape), and Delete is the
       * page's to handle, so it can confirm and offer an undo.
       */
      keydown(event: KeyboardEvent, id: string, el: HTMLElement | null) {
        const cue = current().find((c) => c.id === id);
        if (!cue) return;
        const row = current()
          .filter((c) => c.track === cue.track)
          .sort((a, b) => a.start - b.start);
        const go = (to?: Cue) => {
          if (to) (el?.parentElement?.querySelector(`[data-span-id="${CSS.escape(to.id)}"]`) as HTMLElement | null)?.focus();
        };
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          if (!event.altKey) return;
          event.preventDefault();
          const dir = event.key === "ArrowLeft" ? -1 : 1;
          if (event.shiftKey) {
            // Alt-Shift: trim where it ends.
            const end = Math.max(cue.start + 5, Math.min(length(), cue.end + dir));
            spans.update(id, { end, open: undefined });
          } else {
            // Alt: nudge the whole track a second.
            const start = Math.max(0, Math.min(length() - (cue.end - cue.start), cue.start + dir));
            spans.update(id, { start, end: start + (cue.end - cue.start) });
          }
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          go(event.key === "Home" ? row[0] : row[row.length - 1]);
        } else if (event.key === "Escape") {
          spans.keydown(event, id); // lets go of a drag in progress
        }
      },
      focused: (id: string) => context.store.set({ focused: id }),
    };
  },
  slots: (slot) => ({
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the SDK's own signature for "no props"
    root: slot<{}, { cues: Cue[] }>({
      role: "group",
      // During a drag the draft holds the proposed ranges; render those so the range follows the pointer.
      state: (state, { api }) => ({ cues: api.spans.spans(state) }),
    }),
    track: slot<{ value: string }>({
      props: { value: "string" },
      on: {
        pointerdown: (event, { api, key }) => {
          if (event.pointerType !== "touch") api.spans.trackPointerdown(event, key);
        },
      },
      bind: (el, part) => part.api.spans.bindTrack(el, part.key),
    }),
    cue: slot<{ value: string }>({
      props: { value: "string" },
      role: "group",
      attrs: (state, part) => {
        const cues = part.api.spans.spans(state);
        const cue = cues.find((c) => c.id === part.key);
        if (!cue) return {};
        const row = cues.filter((c) => c.track === cue.track);
        const first = [...row].sort((a, b) => a.start - b.start)[0];
        // One tab stop per side: the track last focused, or the first one.
        const stop = row.some((c) => c.id === state.focused) ? state.focused : first?.id;
        const stack = stackSpans(row).get(cue.id);
        return {
          tabindex: stop === cue.id ? "0" : "-1",
          "aria-label": `${cueLabel(cue)}, side ${cue.track}, ${clock(cue.start)} to ${clock(cue.end)}`,
          "aria-roledescription": "track",
          style: part.api.spans.spanStyle(cue, stack),
          ...part.api.spans.spanAttrs(state, part.key),
          "data-known": cue.known ? "" : undefined,
          // Two records playing at once share the row's height; each has room for less of its name.
          "data-stacked": stack && stack.lanes > 1 ? "" : undefined,
        };
      },
      on: {
        pointerdown: (event, { api, key }) => {
          if (event.pointerType !== "touch") api.spans.spanPointerdown(event, key);
        },
        keydown: (event, { api, key, el }) => api.keydown(event, key, el ?? null),
        focus: (_event, { api, key }) => api.focused(key),
      },
      bind: (el, part) => part.api.spans.bindSpan(el, part.key),
    }),
  }),
  // What the bridge offers. Removing a track and clearing the tape are not on it: those are a person's to do.
  agent: { actions: ["setValue", "addCue", "markAt", "renameCue"] },
});
