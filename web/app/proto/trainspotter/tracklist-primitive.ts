// Tracklist: a timed tracklist as ranges on a timeline, one track per tape side.
// Draw a range to mark a track, drag to move it, drag an end to resize it; overlaps are blends.
// The same methods are offered to agents through the `agent` key, so a model can do the trainspotting.
import { createChange, createSpans, css, definePrimitive, stackSpans, type Span, type SpansDraft } from "@ui-sdk/core";

export type Cue = Span & {
  artist: string;
  title: string;
  known: boolean;
  /** Who identified it, when it came from a comment. */
  by?: string;
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

type TracklistState = { value: Cue[]; draft: SpansDraft<Cue> | null };

export const cueLabel = (cue: Pick<Cue, "artist" | "title" | "known">) =>
  cue.known ? [cue.artist, cue.title].filter(Boolean).join(" — ") || "Untitled" : cue.title ? `Unidentified: ${cue.title}` : "Unidentified";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
let made = 0;
const newId = () => `cue-${Date.now().toString(36)}-${++made}`;

export const tracklist = definePrimitive({
  name: "tracklist",
  options: { value: "value", defaultValue: "value", onValueChange: "callback", sides: "list", length: "number" },
  controlled: ["value"],
  state: (options: TracklistOptions): TracklistState => ({
    value: options.value ?? options.defaultValue ?? [],
    draft: null,
  }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => {
    const change = createChange(context);
    const length = () => context.options().length ?? 48 * 60;
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
      size: () => 180,
      overlap: true, // two records playing at once is the point of a mix
      tracks: sides,
      create: (span) => ({ ...span, id: newId(), artist: "", title: "", known: false }),
      label: (cue) => `${cueLabel(cue)}, ${clock(cue.start)} to ${clock(cue.end)}`,
    });

    const current = () => context.store.get().value;
    // Agent arguments arrive unchecked, so every method normalises what it is given.
    const tidy = (input: Partial<Cue>): Cue | null => {
      const track = sides().includes(String(input.track)) ? String(input.track) : sides()[0];
      const start = Math.max(0, Math.min(length() - 5, Math.round(Number(input.start))));
      const end = Math.max(start + 5, Math.min(length(), Math.round(Number(input.end ?? start + 180))));
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      const artist = String(input.artist ?? "").slice(0, 120);
      const title = String(input.title ?? "").slice(0, 160);
      return { id: input.id ? String(input.id) : newId(), track, start, end, artist, title, known: input.known ?? Boolean(artist || title), by: input.by ? String(input.by).slice(0, 60) : undefined };
    };

    return {
      spans,
      /** Replaces the whole tracklist. */
      setValue: (value: Partial<Cue>[]) =>
        change("value", (Array.isArray(value) ? value : []).map(tidy).filter((c): c is Cue => c !== null), { reason: "imperative" }),
      /** Marks one track: `{ track, start, end, artist, title }`, times in seconds. */
      addCue: (cue: Partial<Cue>) => {
        const next = tidy(cue);
        return next ? change("value", [...current(), next], { reason: "imperative" }) : false;
      },
      /** "A new track starts here": marks one at `time` and ends whatever was playing before it. */
      markAt: (track: string, time: number) => {
        const t = sides().includes(String(track)) ? String(track) : sides()[0];
        const start = Math.max(0, Math.min(length() - 5, Math.round(Number(time))));
        if (!Number.isFinite(start)) return false;
        const next = current()
          .filter((c) => c.track === t && c.start > start + 5)
          .sort((a, b) => a.start - b.start)[0];
        const end = Math.max(start + 5, Math.min(next?.start ?? start + 240, length()));
        const before = current()
          .map((c) => (c.track === t && c.start < start && c.end > start ? { ...c, end: start } : c))
          .filter((c) => c.end - c.start >= 5 && !(c.track === t && Math.abs(c.start - start) < 5));
        return change("value", [...before, { id: newId(), track: t, start, end, artist: "", title: "", known: false }], { reason: "imperative" });
      },
      /** Names a marked track. */
      renameCue: (id: string, artist: string, title: string) =>
        change(
          "value",
          current().map((c) => (c.id === id ? { ...c, artist: String(artist ?? "").slice(0, 120), title: String(title ?? "").slice(0, 160), known: Boolean(artist || title) } : c)),
          { reason: "imperative" },
        ),
      removeCue: (id: string) => spans.remove(String(id)),
      clear: () => change("value", [], { reason: "imperative" }),
    };
  },
  slots: (slot) => ({
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the SDK's own signature for "no props"
    root: slot<{}, { cues: Cue[]; busy: boolean }>({
      // During a drag the draft holds the proposed ranges; render those so the range follows the pointer.
      state: (state) => ({ cues: state.draft?.spans ?? state.value, busy: state.draft !== null }),
      attrs: (state) => ({ role: "group", "data-busy": state.draft ? "" : undefined }),
    }),
    track: slot<{ value: string }>({
      props: { value: "string" },
      attrs: () => ({ style: css({ position: "relative", "touch-action": "none" }) }),
      on: {
        pointerdown: (event, { el, api, key }) => {
          if (event.target === el) api.spans.trackPointerdown(event, key);
        },
      },
      bind: (el, part) => part.api.spans.bindTrack(el, part.key),
    }),
    cue: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, part) => {
        const cues = state.draft?.spans ?? state.value;
        const cue = cues.find((c) => c.id === part.key);
        if (!cue) return {};
        const lanes = stackSpans(cues.filter((c) => c.track === cue.track));
        return {
          tabindex: "0",
          "aria-label": `${cueLabel(cue)}, side ${cue.track}, ${clock(cue.start)} to ${clock(cue.end)}`,
          "aria-roledescription": "track range",
          style: part.api.spans.spanStyle(cue, lanes.get(cue.id)),
          ...part.api.spans.spanAttrs(state, part.key),
          "data-known": cue.known ? "" : undefined,
        };
      },
      on: {
        pointerdown: (event, { api, key }) => api.spans.spanPointerdown(event, key),
        keydown: (event, { api, key }) => {
          api.spans.keydown(event, key);
        },
      },
      bind: (el, part) => part.api.spans.bindSpan(el, part.key),
    }),
  }),
  agent: { actions: ["setValue", "addCue", "markAt", "renameCue", "removeCue", "clear"] },
});
