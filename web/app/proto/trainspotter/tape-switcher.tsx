"use client";

// The tape switcher: step to the previous or next tape, or open the list of every tape in the archive.
// It is its own component so that opening the list, typing in it and scrolling it re-render only this,
// not the timeline beside it.
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from "@ui-sdk/react/combobox";

/** A tape as the list shows it: where it sits (its group) and what is known about it (its meta line). */
export type TapeEntry = { id: string; label: string; group: string; meta: string };

/** A row of the tape list as drawn: a group's heading, or a tape. `index` is the tape's place among the
    matches, which is how the combobox finds it from the keyboard. */
type TapeItem = { value: string; label: string; group: string; meta: string };
type TapeRow = { top: number; height: number } & ({ heading: string } | { item: TapeItem; index: number });
const TAPE_ROW = 44;
const TAPE_HEADING = 36;
/** Lays the matching tapes out top to bottom, with a heading wherever the group changes. */
function layOutTapes(items: TapeItem[]): { rows: TapeRow[]; height: number } {
  const rows: TapeRow[] = [];
  let top = 0;
  items.forEach((item, index) => {
    if (index === 0 || items[index - 1].group !== item.group) {
      rows.push({ top, height: TAPE_HEADING, heading: item.group });
      top += TAPE_HEADING;
    }
    rows.push({ top, height: TAPE_ROW, item, index });
    top += TAPE_ROW;
  });
  return { rows, height: top };
}

export const TapeSwitcher = memo(function TapeSwitcher({ tapes, currentId }: { tapes: TapeEntry[]; currentId: string }) {
  const router = useRouter();
  const [switcher, setSwitcher] = useState<HTMLButtonElement | null>(null);
  const [tapeNav, setTapeNav] = useState<HTMLElement | null>(null); // the list lines up with the page's edge, not the button's
  const [tapeQuery, setTapeQuery] = useState("");
  const [tapesOpen, setTapesOpen] = useState(false);
  const tapesOpenRef = useRef(false);
  tapesOpenRef.current = tapesOpen;
  const tapClicked = useRef(false);
  // The list holds every tape in the archive, so only the rows in view are built. Built in full, a tap on
  // "All tapes" waited about 400ms on a phone for 227 rows before anything appeared.
  const tapeItems = useMemo(() => tapes.map((o) => ({ value: o.id, label: o.label, group: o.group, meta: o.meta })), [tapes]);
  const tapeScroller = useRef<HTMLDivElement | null>(null);
  const tapeScrollerSize = useRef<ResizeObserver | null>(null);
  const [tapeScroll, setTapeScroll] = useState({ top: 0, height: 448 });
  // The scroller's height changes without a scroll (the list opens, the keyboard comes or goes, the screen
  // turns), and the rows to build depend on it.
  const setTapeScroller = useCallback((el: HTMLDivElement | null) => {
    tapeScrollerSize.current?.disconnect();
    tapeScroller.current = el;
    if (!el) return;
    tapeScrollerSize.current = new ResizeObserver(() => setTapeScroll((v) => (v.height === el.clientHeight ? v : { ...v, height: el.clientHeight })));
    tapeScrollerSize.current.observe(el);
  }, []);
  const tapeRows = useRef<TapeRow[]>([]);
  const place = tapes.findIndex((o) => o.id === currentId);
  const elsewhere = tapes.some((o) => o.id !== currentId);
  const prevTape = elsewhere ? tapes[(place <= 0 ? tapes.length : place) - 1] : null;
  const nextTape = elsewhere ? tapes[(place + 1) % tapes.length] : null;

  return (
    <>
    {/* Getting around: step to the next tape, or open the whole list with each tape's progress. The list is a
        combobox with its search inside the popup; on a phone it presents as a sheet. */}
    <Combobox
      value={currentId}
      onValueChange={(v: unknown) => {
        if (typeof v === "string" && v !== currentId) router.push(`/proto/trainspotter/${v}`);
      }}
      items={tapeItems}
      // Bring the highlighted tape into view. With only the rows in view built, the combobox can't scroll to
      // one itself. A heading above the first tape of a group comes along with it.
      onHighlight={(_value: unknown, details: { index: number }) => {
        const el = tapeScroller.current;
        const row = tapeRows.current.find((r) => "item" in r && r.index === details.index);
        if (!el || !row) return;
        const top = row.top - (tapeRows.current.some((r) => "heading" in r && r.top + r.height === row.top) ? TAPE_HEADING : 0);
        if (top < el.scrollTop) el.scrollTop = top;
        else if (row.top + row.height > el.scrollTop + el.clientHeight) el.scrollTop = row.top + row.height - el.clientHeight;
      }}
      // The search text is ours so it can be emptied each time the list opens; left to itself the field would
      // open holding the current tape's name. It is committed at once: the combobox picks which match to
      // highlight straight after telling us, and a render later it would highlight a match for the letters
      // before this one.
      query={tapeQuery}
      onQueryChange={(q: string) => flushSync(() => setTapeQuery(q))}
      open={tapesOpen}
      onOpenChange={(open: boolean, details?: { reason?: string; source?: string }) => {
        setTapesOpen(open);
        if (open) {
          setTapeQuery("");
          setTapeScroll((v) => ({ ...v, top: 0 }));
        }
        // Focus comes back to the button when the list closes. After a tap or a click the combobox brings it
        // back itself, and that is silent: a focus ring is for someone using the keyboard. After Escape it
        // does not (it expects the search field to outlive the list, and ours is inside it), so that one is
        // ours, made at once so focus never sits nowhere. Tabbing out is left alone.
        else if (details?.reason !== "focus-out") {
          const byKeyboard = details?.source === "keyboard";
          switcher?.toggleAttribute("data-quiet", !byKeyboard);
          if (byKeyboard) switcher?.focus({ preventScroll: true });
        }
      }}
      presentation="auto"
      // Typing highlights the first match; opening highlights the tape you are on, so the list opens there.
      autoHighlight="always"
    >
      <nav aria-label="Tapes" className="ts-nav" ref={setTapeNav}>
        {elsewhere && (
          <Link href={`/proto/trainspotter/${prevTape!.id}`} className="ts-link" aria-label={`Previous tape: ${prevTape!.label}`}>
            ‹ Prev
          </Link>
        )}
        {/* The list sits here in the page, directly before its button, on purpose. When it closes, the combobox
            hands focus to the next focusable element after the list's place in the page (it cannot hand it
            back to the search field, which is inside the list). Placed after the nav, that element was the
            "Tape page" link: focus showed there for half a second and then jumped to the button. Placed here,
            the next element is the button. The list is drawn in the top layer, so where it sits in the page
            changes nothing you can see. */}
        <ComboboxContent anchor={tapeNav} align="start" alignOffset={10} sideOffset={4} className="ts-tapes">
          <div className="ts-tapes-search">
            <ComboboxInput autoFocus aria-label="Search tapes" placeholder="Search by DJ or tape" autoComplete="off" spellCheck={false} className="ts-input" />
          </div>
          <ComboboxEmpty className="px-3 py-3 text-sm text-[var(--muted)]">No tape by that name has track IDs to work with yet.</ComboboxEmpty>
          <div
            ref={setTapeScroller}
            className="ts-tapes-list"
            onScroll={(e) => {
              const el = e.currentTarget;
              setTapeScroll({ top: el.scrollTop, height: el.clientHeight });
            }}
          >
            <ComboboxList>
              {(state: { items: unknown }) => {
                const { rows, height } = layOutTapes(state.items as TapeItem[]);
                tapeRows.current = rows;
                // A few rows either side of what is in view, so a quick scroll doesn't show a gap.
                const from = tapeScroll.top - 4 * TAPE_ROW;
                const to = tapeScroll.top + tapeScroll.height + 4 * TAPE_ROW;
                return (
                  <div className="relative" style={{ height }}>
                    {rows
                      .filter((r) => r.top + r.height > from && r.top < to)
                      .map((r) =>
                        "heading" in r ? (
                          <div key={`g-${r.heading}`} className="ts-tapes-group" style={{ top: r.top, height: r.height }} role="presentation">
                            {r.heading}
                          </div>
                        ) : (
                          <ComboboxItem key={r.item.value} value={r.item.value} label={r.item.label} index={r.index} className="ts-option" style={{ top: r.top, height: r.height }}>
                            <span className="min-w-0 flex-1 truncate" title={r.item.label}>
                              {r.item.label}
                            </span>
                            <span className="flex-none font-mono text-xs tabular-nums opacity-70">{r.item.value === currentId ? "You’re here" : r.item.meta}</span>
                          </ComboboxItem>
                        ),
                      )}
                  </div>
                );
              }}
            </ComboboxList>
          </div>
        </ComboboxContent>
        <ComboboxTrigger
          ref={setSwitcher}
          className="ts-link ts-nav-all"
          onBlur={(e: React.FocusEvent<HTMLButtonElement>) => e.currentTarget.removeAttribute("data-quiet")}
          onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => e.currentTarget.removeAttribute("data-quiet")}
          // A finger tap normally arrives as a click and the combobox opens itself. In WebKit's touch
          // emulation the click never comes, so if a tap ends and nothing followed, open it here.
          onClick={() => {
            tapClicked.current = true;
          }}
          onPointerUp={(e: React.PointerEvent) => {
            if (e.pointerType !== "touch") return;
            tapClicked.current = false;
            const wasOpen = tapesOpenRef.current;
            setTimeout(() => !tapClicked.current && tapesOpenRef.current === wasOpen && setTapesOpen(!wasOpen), 150);
          }}
        >
          <span>All tapes</span>
          <span className="tabular-nums opacity-60">{place >= 0 ? `${place + 1} of ${tapes.length}` : tapes.length}</span>
          <span aria-hidden>▾</span>
        </ComboboxTrigger>
        {elsewhere && (
          <Link href={`/proto/trainspotter/${nextTape!.id}`} className="ts-link" aria-label={`Next tape: ${nextTape!.label}`}>
            Next ›
          </Link>
        )}
      </nav>
    </Combobox>
    </>
  );
});
