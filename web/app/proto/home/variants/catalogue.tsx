"use client";

// Index — axis: density. A keyboard-first catalogue: every tape as one line of type beside a resizable preview.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Listbox, ListboxItem } from "@ui-sdk/react/listbox";
import { Resizable, ResizableHandle, ResizablePanel } from "@ui-sdk/react/resizable";
import { cover, djLine, type ProtoTape } from "../shared";

const normalize = (s: string) => s.toLowerCase().replace(/[.\-\s]/g, "");

export function Catalogue({ tapes }: { tapes: ProtoTape[] }) {
  const router = useRouter();
  const sorted = useMemo(
    () => [...tapes].sort((a, b) => djLine(a).localeCompare(djLine(b)) || (a.released ?? "").localeCompare(b.released ?? "")),
    [tapes],
  );
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = normalize(query);
    if (!q) return sorted;
    return sorted.filter((t) => normalize(`${djLine(t)} ${t.title} ${t.released}`).includes(q));
  }, [sorted, query]);

  const [selected, setSelected] = useState(sorted[0].id);
  const tape = rows.find((t) => t.id === selected) ?? rows[0] ?? null;

  // Side by side on wide screens, stacked on a phone.
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setStacked(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const list = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-none border-b-[1.5px] border-[var(--border)] p-3">
        <label htmlFor="index-filter" className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
          Filter by DJ, title or year
        </label>
        <input
          id="index-filter"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="h-11 w-full border-[1.5px] border-[var(--text)] bg-transparent px-3 text-base text-[var(--text)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]"
        />
      </div>
      <div className="grid flex-none grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.2fr)_3rem] gap-3 border-b border-[var(--border)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]" aria-hidden>
        <span>№</span>
        <span>DJ</span>
        <span>Title</span>
        <span className="text-right">Year</span>
      </div>
      {rows.length === 0 ? (
        <div className="p-6">
          <p className="text-[15px] text-[var(--text)]">No tape matches “{query}”.</p>
          <button type="button" onClick={() => setQuery("")} className="poster-btn mt-4 min-h-11">
            Clear the filter
          </button>
        </div>
      ) : (
        <Listbox
          aria-label={`${rows.length} tapes`}
          value={tape?.id ?? null}
          onValueChange={(v) => {
            if (typeof v === "string") setSelected(v);
          }}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter" && tape) router.push(`/tapes/${tape.id}`);
          }}
          onDoubleClick={() => tape && router.push(`/tapes/${tape.id}`)}
          loop={false}
          className="index-list min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none"
          data-proto-keys
        >
          {rows.map((t) => (
            <ListboxItem
              key={t.id}
              value={t.id}
              label={`${djLine(t)} ${t.title}`}
              className="index-row grid min-h-9 grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.2fr)_3rem] items-center gap-3 px-3 text-[13px] leading-tight [@media(pointer:coarse)]:min-h-11"
            >
              <span className="index-muted font-mono text-[11px] tabular-nums text-[var(--muted)]">{t.catalogNumber}</span>
              <span className="truncate font-medium">{djLine(t)}</span>
              <span className="truncate">{t.title}</span>
              <span className="index-muted text-right font-mono text-[11px] tabular-nums text-[var(--muted)]">{t.released}</span>
            </ListboxItem>
          ))}
        </Listbox>
      )}
    </div>
  );

  const preview = tape ? (
    <div className={`flex h-full min-h-0 ${stacked ? "flex-row items-center gap-4 p-3" : "flex-col p-6 lg:p-10"}`}>
      <Link
        href={`/tapes/${tape.id}`}
        className={`cursor-pointer block bg-[var(--bg-hover)] ${stacked ? "h-full max-h-32 w-[40%] flex-none" : "min-h-0 flex-1"}`}
        aria-label={`Open ${djLine(tape)} — ${tape.title}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={tape.id} src={cover(tape, stacked ? 400 : 1200)} alt="" className="h-full w-full object-contain" />
      </Link>
      <div className={stacked ? "min-w-0 flex-1" : "flex-none pt-6"}>
        <p className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] tabular-nums">
          № {tape.catalogNumber} · {tape.released}
        </p>
        <h2 className={`mt-2 font-display leading-[0.95] text-[var(--text)] [text-wrap:balance] ${stacked ? "line-clamp-2 text-2xl" : "line-clamp-2 text-5xl xl:text-6xl"}`}>
          {djLine(tape)}
        </h2>
        <p className={`mt-2 text-[var(--text)] ${stacked ? "truncate text-sm" : "line-clamp-2 text-lg"}`}>{tape.title}</p>
        <Link href={`/tapes/${tape.id}`} className={`poster-btn min-h-11 whitespace-nowrap ${stacked ? "mt-3" : "mt-6"}`}>
          {stacked ? "Open tape" : "Open this tape"}
        </Link>
      </div>
    </div>
  ) : (
    <div className="grid h-full place-items-center p-6 text-[15px] text-[var(--muted)]">Nothing selected.</div>
  );

  return (
    <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12" aria-label="Index of every tape">
      <Resizable
        key={stacked ? "v" : "h"}
        orientation={stacked ? "vertical" : "horizontal"}
        className="flex h-[calc(100dvh-13rem)] min-h-[560px] border-y-[1.5px] border-[var(--text)] data-[orientation=vertical]:flex-col"
      >
        {stacked ? (
          <>
            <ResizablePanel defaultSize={30} minSize={18} className="min-h-0 overflow-hidden">{preview}</ResizablePanel>
            <ResizableHandle aria-label="Resize preview" className="index-handle" />
            <ResizablePanel minSize={30} className="min-h-0 overflow-hidden">{list}</ResizablePanel>
          </>
        ) : (
          <>
            <ResizablePanel defaultSize={46} minSize={30} className="min-w-0 overflow-hidden">{list}</ResizablePanel>
            <ResizableHandle aria-label="Resize index" className="index-handle" />
            <ResizablePanel minSize={25} className="min-w-0 overflow-hidden">{preview}</ResizablePanel>
          </>
        )}
      </Resizable>
    </section>
  );
}
