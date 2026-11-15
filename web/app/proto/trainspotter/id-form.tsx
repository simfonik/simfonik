"use client";

// IDing a track: two fields, and beside them whatever could save the typing (a likely name from the tracklist,
// what someone else thought it was, a clue). Two layouts: a bar under the timeline with a mouse, a sheet above
// the keyboard on a phone. Undo, redo and the list of keys live here too, since the bar is where they sit.
import { useState } from "react";
import { inputHints } from "@ui-sdk/core";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@ui-sdk/react/popover";
import { useShortcutHint } from "@ui-sdk/react/shortcuts";
import { listKeys } from "./keys";
import type { Listed, Opinion } from "./parse";
import type { Cue } from "./tracklist-primitive";

/** What is being typed about a track, and what can be done with it. */
export type IdDraft = {
  draft: { artist: string; title: string };
  setDraft: React.Dispatch<React.SetStateAction<{ artist: string; title: string }>>;
  /** Saves what is typed, or the name given. */
  save: (artist?: string, title?: string) => unknown;
  remove: () => void;
  /** Names from the tracklist that could be this track. */
  names: Listed[];
  /** What else people said about this track's moment. */
  opinions: Opinion[];
  /** The names come from the site's own tracklist, not from a list in the comments. */
  fromSite: boolean;
};

const nameHints = (enter: "next" | "done") => {
  const h = inputHints("name", { enter }) as Record<string, string>;
  return { autoCapitalize: h.autoCapitalize, autoCorrect: h.autoCorrect, spellCheck: h.spellCheck === "true", enterKeyHint: enter, autoComplete: "off" } as const;
};

export function UndoRedo({ canUndo, canRedo, onStep }: { canUndo: boolean; canRedo: boolean; onStep: (by: -1 | 1) => void }) {
  const undo = useShortcutHint("mod+z");
  const redo = useShortcutHint("mod+shift+z");
  return (
    <>
      {/* Unavailable, not disabled: a disabled button drops the keyboard's focus the moment the last step is undone. */}
      <button type="button" onClick={() => canUndo && onStep(-1)} aria-disabled={!canUndo} className="ts-link" aria-keyshortcuts={undo.ariaKeyshortcuts} title={`Undo (${undo.text})`}>
        Undo
      </button>
      <button type="button" onClick={() => canRedo && onStep(1)} aria-disabled={!canRedo} className="ts-link" aria-keyshortcuts={redo.ariaKeyshortcuts} title={`Redo (${redo.text})`}>
        Redo
      </button>
    </>
  );
}

/**
 * Everything else the page can do is shown where it happens: the time under the pointer, the grips on a track.
 * The keys are a click away for whoever wants them. The page's own come from the SDK's list of shortcuts that
 * can run now, read when the list opens, so it can't fall out of step with what the keys do. A focused track's
 * keys belong to the timeline, not to the page, and are listed after them. All are named the way they are
 * printed on the keyboard in front of the visitor.
 */
export function Shortcuts() {
  const [page, setPage] = useState<{ hint: string; description: string }[]>([]);
  const [history, setHistory] = useState<{ hint: string; description: string }[]>([]);
  const mac = useShortcutHint("mod+z").text.includes("⌘");
  return (
    <Popover
      onOpenChange={(open: boolean) => {
        if (!open) return;
        setPage(listKeys(["space", "arrowleft", "arrowright", "m"]));
        setHistory(listKeys(["mod+z", "mod+shift+z"]));
      }}
    >
      <PopoverTrigger className="ts-link ts-fine-only">Keyboard shortcuts</PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={6} className="ts-keys">
        <PopoverTitle className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Keyboard shortcuts</PopoverTitle>
        <dl>
          {[
            ...page.map((k) => [k.hint, k.description]),
            [mac ? "Return" : "Enter", "ID the selected track"],
            ["Delete", "Remove it"],
            [mac ? "⌥ ← →" : "Alt ← →", "Move it a second"],
            [mac ? "⌥ ⇧ ← →" : "Alt Shift ← →", "Trim where it ends"],
            ...history.map((k) => [k.hint, k.description]),
          ].map(([key, what]) => (
            <div key={`${key} ${what}`} className="contents">
              <dt>{key}</dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

/** The two fields, shared by the bar and the sheet. */
function Fields({ form, artistId, disabled }: { form: IdDraft; artistId: string; disabled: boolean }) {
  return (
    <>
      <Field className="min-w-0 flex-1 basis-40" disabled={disabled}>
        <FieldLabel className="ts-label">Artist</FieldLabel>
        <Input
          id={artistId}
          value={form.draft.artist}
          onValueChange={(v: string) => form.setDraft((d) => ({ ...d, artist: v }))}
          // The keyboard's Next key sends Enter. It should go to Title, not save half an ID.
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              (e.currentTarget.form?.querySelector("[data-title]") as HTMLInputElement | null)?.focus();
            }
          }}
          {...nameHints("next")}
          className="ts-input"
        />
      </Field>
      <Field className="min-w-0 flex-[1.4] basis-48" disabled={disabled}>
        <FieldLabel className="ts-label">Title</FieldLabel>
        <Input data-title value={form.draft.title} onValueChange={(v: string) => form.setDraft((d) => ({ ...d, title: v }))} {...nameHints("done")} className="ts-input" />
      </Field>
    </>
  );
}

/** What other people said about this moment: a rival ID is a button that takes it, a clue is just read out. */
function OtherIds({ form }: { form: IdDraft }) {
  return form.opinions.map((o, i) => (
    <span key={i}>
      {i > 0 ? " " : ""}
      {o.known ? (
        <>
          {o.author} thought it was{" "}
          <button type="button" onClick={() => form.save(o.artist, o.title)} className="ts-inline-link text-[var(--text)]">
            {[o.artist, o.title].filter(Boolean).join(" — ")}
          </button>
          .
        </>
      ) : (
        <>
          {o.author} heard “{o.title}”.
        </>
      )}
    </span>
  ));
}

/**
 * With a mouse: the ID bar under the timeline. It is always there and always the same height, whatever is
 * picked or playing: two fields and their buttons, then one line that holds whichever applies (what to do,
 * likely names from the tracklist, other people's IDs, a clue) beside undo, redo and the keys. Nothing under
 * it moves when a track is picked, a clue turns up or suggestions do.
 */
export function IdBar({
  form,
  subject,
  playingId,
  empty,
  onPick,
  onAbandon,
  onNamed,
  children,
}: {
  form: IdDraft;
  /** The track the fields are about. */
  subject: Cue | null;
  playingId: string | null;
  /** Nothing is marked on the part of the tape being shown. */
  empty: boolean;
  /** The cursor went into the fields. */
  onPick: () => void;
  /** Escape: what was typed is dropped. */
  onAbandon: () => void;
  /** A suggested name was taken. */
  onNamed: () => void;
  /** Undo, redo and the keys, at the end of the bar's last line. */
  children: React.ReactNode;
}) {
  return (
    <form
      className="ts-idbar"
      onSubmit={(e) => {
        e.preventDefault();
        form.save();
      }}
      // Leaving the bar saves. Moving between its fields and buttons does not, and neither does the whole
      // window losing focus: switching to another tab mid-word is not finishing.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null) && document.hasFocus()) form.save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && subject) onAbandon();
      }}
    >
      {/* Typing about the track under the playhead picks it, so the fields don't move on when the tape does. */}
      <div className="ts-idbar-fields" onFocus={onPick}>
        <Fields form={form} artistId="ts-artist" disabled={!subject} />
        <div className="flex flex-none items-center gap-2">
          <button type="submit" disabled={!subject} className="ts-btn ts-btn-solid">
            Save
          </button>
          {/* Pulled out by its own padding, so its last letter ends where "Keyboard shortcuts" below it does. */}
          <button type="button" disabled={!subject} onClick={form.remove} className="ts-link -mr-2.5">
            Remove
          </button>
        </div>
      </div>
      <div className="ts-idbar-foot">
        <div className="ts-idbar-context">
          {!subject ? (
            empty ? (
              "Nothing marked yet. Play, then “Mark new track”."
            ) : (
              "Click a track to play it and ID it."
            )
          ) : form.names.length > 0 ? (
            <>
              <span className="flex-none">{form.fromSite ? "From the tracklist:" : `From ${form.names[0].author}’s list:`}</span>
              {form.names.map((l) => (
                <button
                  key={`${l.side}-${l.n}`}
                  type="button"
                  onClick={() => {
                    form.save(l.artist, l.title);
                    onNamed();
                  }}
                  className="ts-chip ts-chip-inline"
                  title={`${l.artist} — ${l.title}`}
                >
                  <span className="font-mono text-xs tabular-nums opacity-70">{l.n}</span>
                  <span className="truncate">
                    {l.artist} — {l.title}
                  </span>
                </button>
              ))}
            </>
          ) : form.opinions.length > 0 ? (
            <span className="truncate">
              <OtherIds form={form} />
            </span>
          ) : !subject.known && subject.title && subject.id !== playingId ? (
            // The player already shows the clue of the track that is playing; this is for one that isn't.
            <span className="truncate">
              Clue from {subject.by ?? "a comment"}: “{subject.title}”
            </span>
          ) : null}
        </div>
        <div className="-mr-2.5 flex flex-none items-center gap-1">{children}</div>
      </div>
    </form>
  );
}

/**
 * On an iPhone, a field taking focus makes Safari scroll the page to bring the field to the middle of the
 * screen. It does so even for a field in a sheet, which doesn't move with the page: the sheet stays put and
 * the page slides away underneath it. Safari skips the scroll for a field it takes to be at the top already,
 * so the field is put there for the instant it takes focus. (React Aria does the same.)
 */
function focusInPlace(e: React.TouchEvent<HTMLFormElement>) {
  const field = e.target instanceof HTMLInputElement ? e.target : null;
  if (!field || field === document.activeElement) return; // a tap in the focused field places the caret
  e.preventDefault();
  field.style.transform = "translateY(-2000px)";
  field.focus({ preventScroll: true });
  requestAnimationFrame(() => (field.style.transform = ""));
}

/**
 * On a phone the same job is a sheet that stays above the keyboard. Height is free there, so the likely names
 * and the clue get lines of their own.
 */
export function IdSheetForm({ form, track, onClose, onReplay }: { form: IdDraft; track: Cue; onClose: () => void; onReplay: () => void }) {
  return (
    <form
      className="ts-nameform"
      onTouchEndCapture={focusInPlace}
      onSubmit={(e) => {
        e.preventDefault();
        form.save();
        onClose();
      }}
    >
      {/* One-tap answers come before the fields that need typing. */}
      {form.names.length > 0 && (
        <div className="w-full">
          <p className="ts-label">{form.fromSite ? "Is it one of these, from the tape’s tracklist?" : `Is it one of these, from ${form.names[0].author}’s list?`}</p>
          <div className="flex flex-wrap gap-2">
            {form.names.map((l) => (
              <button
                key={`${l.side}-${l.n}`}
                type="button"
                onClick={() => {
                  form.save(l.artist, l.title);
                  onClose();
                }}
                className="ts-chip"
              >
                <span className="font-mono text-xs tabular-nums opacity-70">{l.n}</span> {l.artist} — {l.title}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* The sheet covers the player, so the clue is said here. */}
      {!track.known && track.title && (
        <p className="w-full text-[15px] text-[var(--text)]">
          Clue from {track.by ?? "a comment"}: “{track.title}”
        </p>
      )}
      <Fields form={form} artistId="ts-artist-sheet" disabled={false} />
      <div className="flex flex-none flex-wrap items-end gap-2">
        <button type="submit" className="ts-btn ts-btn-solid">
          Save
        </button>
        {/* The sheet covers the timeline, so this is the way to hear the track again from here. */}
        <button type="button" onClick={onReplay} className="ts-link">
          Replay
        </button>
        <button type="button" onClick={form.remove} className="ts-link">
          Remove
        </button>
      </div>
      {form.opinions.length > 0 && (
        <p className="w-full text-sm text-[var(--muted)]">
          <OtherIds form={form} />
        </p>
      )}
    </form>
  );
}
