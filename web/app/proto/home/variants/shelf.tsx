"use client";

// Shelf — axis: physical metaphor. The whole archive as cassette spines; pull one out to see it.
import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Listbox, ListboxItem } from "@ui-sdk/react/listbox";
import { chronological, cover, djLine, pick, type ProtoTape } from "../shared";

const TONES = [
  "bg-[var(--bg-hover)] text-[var(--text)]",
  "bg-[var(--text)] text-[var(--bg)]",
  "bg-[var(--bg)] text-[var(--text)] shadow-[inset_0_0_0_1.5px_var(--text)]",
  "bg-[color-mix(in_oklch,var(--text)_18%,var(--bg))] text-[var(--text)]",
];
const HEIGHTS = ["h-[196px]", "h-[204px]", "h-[212px]", "h-[188px]"];

export function Shelf({ tapes }: { tapes: ProtoTape[] }) {
  const router = useRouter();
  const sorted = useMemo(() => chronological(tapes), [tapes]);
  const byId = useMemo(() => new Map(sorted.map((t) => [t.id, t])), [sorted]);
  const [selected, setSelected] = useState(sorted[Math.floor(sorted.length * 0.4)].id);
  const tape = byId.get(selected) ?? sorted[0];

  const detail = (
    <>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] tabular-nums">
        № {tape.catalogNumber} · {tape.released}
      </p>
      <h2 className="mt-2 line-clamp-3 font-display text-3xl leading-[0.95] text-[var(--text)] [text-wrap:balance] lg:text-4xl">
        {djLine(tape)}
      </h2>
      <p className="mt-2 line-clamp-2 text-[15px] text-[var(--text)]">{tape.title}</p>
    </>
  );

  return (
    <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12" aria-label="The archive as a shelf of tapes">
      {/* Phone: the pulled tape rides along at the top while the shelf scrolls under it. */}
      <div className="sticky top-0 z-10 -mx-4 mb-6 flex items-center gap-4 border-b-[1.5px] border-[var(--text)] bg-[var(--bg)] px-4 py-3 lg:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={tape.id} src={cover(tape, 400)} alt="" className="h-16 w-24 flex-none bg-[var(--bg-hover)] object-contain" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl leading-tight text-[var(--text)]">{djLine(tape)}</p>
          <p className="truncate text-sm text-[var(--muted)]">{tape.title}</p>
        </div>
        <Link href={`/tapes/${tape.id}`} className="poster-btn min-h-11 flex-none">
          Open
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div data-proto-keys>
          <p className="mb-8 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
            {sorted.length} tapes, oldest first · arrow keys walk the shelf · type a name to jump
          </p>
          <Listbox
            aria-label="Tapes, oldest first"
            orientation="horizontal"
            loop={false}
            value={selected}
            onValueChange={(v) => {
              if (typeof v === "string") setSelected(v);
            }}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter") router.push(`/tapes/${selected}`);
            }}
            onDoubleClick={() => router.push(`/tapes/${selected}`)}
            className="flex flex-wrap items-end gap-y-10 outline-none"
          >
            {sorted.map((t, i) => {
              const newYear = i === 0 || sorted[i - 1].released !== t.released;
              return (
                <Fragment key={t.id}>
                  {newYear && (
                    <div
                      role="presentation"
                      aria-hidden
                      className="flex h-[228px] w-7 flex-none items-start justify-center border-b-[1.5px] border-[var(--text)] pt-1"
                    >
                      <span className="shelf-spine-text font-display text-lg leading-none text-[var(--text)]">{t.released}</span>
                    </div>
                  )}
                  <ListboxItem
                    value={t.id}
                    label={`${djLine(t)} ${t.title}`}
                    aria-label={`${djLine(t)} — ${t.title}, ${t.released}`}
                    className="shelf-spine flex w-[38px] flex-none items-end border-b-[1.5px] border-[var(--text)] px-px [@media(pointer:coarse)]:w-11"
                  >
                    <span
                      className={`shelf-spine-body flex w-full flex-col items-center justify-between py-2 ${HEIGHTS[pick(t.id, 4)]} ${TONES[pick(t.title + t.id, 4)]}`}
                    >
                      <span className="shelf-spine-text min-h-0 flex-1 text-[11px] leading-none">
                        <span className="font-semibold uppercase tracking-[0.06em]">{djLine(t)}</span>
                        <span className="opacity-60"> · {t.title}</span>
                      </span>
                      <span className="mt-2 font-mono text-[9px] leading-none tabular-nums opacity-70">{t.catalogNumber}</span>
                    </span>
                  </ListboxItem>
                </Fragment>
              );
            })}
          </Listbox>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <Link href={`/tapes/${tape.id}`} className="cursor-pointer block aspect-[3/2] w-full bg-[var(--bg-hover)]" aria-label={`Open ${djLine(tape)} — ${tape.title}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={tape.id} src={cover(tape, 800)} alt="" className="h-full w-full object-contain" />
            </Link>
            <div className="mt-5 min-h-[11rem]">{detail}</div>
            <Link href={`/tapes/${tape.id}`} className="poster-btn mt-5 min-h-11">
              Open this tape
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
