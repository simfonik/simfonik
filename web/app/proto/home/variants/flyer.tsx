"use client";

// Flyer — you're the promoter. Pick DJs from the archive, drag them into a running order, and the
// page typesets a flyer for your night. Every name plays a real tape, and the link is shareable.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createParts } from "@ui-sdk/react/primitive";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxLabel, ComboboxList } from "@ui-sdk/react/combobox";
import { chronological, type ProtoTape } from "../shared";
import { lineup } from "./lineup-primitive";

const { Root: Lineup, Item: LineupItem } = createParts(lineup, { root: "div", item: "div" });

const MAX = 8;
const THEMES = [
  { id: "paper", name: "Photocopy", bg: "#f4f1ea", ink: "#0a0a0a", pop: "#0a0a0a" },
  { id: "acid", name: "Acid", bg: "#f7e017", ink: "#0a0a0a", pop: "#e4002b" },
  { id: "night", name: "Blacklight", bg: "#140a2e", ink: "#f5f0ff", pop: "#3dffb0" },
];
const SIZES = ["text-[13cqw]", "text-[10cqw]", "text-[8cqw]", "text-[6.6cqw]", "text-[5.6cqw]", "text-[5cqw]", "text-[4.5cqw]", "text-[4.5cqw]"];
const hour = (i: number) => {
  const h = (22 + i) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? "PM" : "AM"}`;
};

export function Flyer({ tapes }: { tapes: ProtoTape[] }) {
  // One entry per DJ: how many tapes they have and which one a press on their name plays.
  const roster = useMemo(() => {
    const m = new Map<string, { slug: string; name: string; count: number; tape: ProtoTape }>();
    for (const t of chronological(tapes)) {
      for (const d of t.djs) {
        const e = m.get(d.slug);
        if (e) e.count++;
        else m.set(d.slug, { slug: d.slug, name: d.name, count: 1, tape: t });
      }
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tapes]);
  const bySlug = useMemo(() => new Map(roster.map((d) => [d.slug, d])), [roster]);
  const headliners = useMemo(() => [...roster].sort((a, b) => b.count - a.count).slice(0, 6).map((d) => d.slug), [roster]);

  const [night, setNight] = useState("One More Time");
  const [order, setOrder] = useState<string[]>(headliners);
  const [theme, setTheme] = useState(THEMES[0].id);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [restored, setRestored] = useState(false);

  // A shared link restores the night it describes.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const djs = q.get("djs")?.split(",").filter((s) => bySlug.has(s)).slice(0, MAX);
    if (djs?.length) setOrder(djs);
    const n = q.get("night");
    if (n) setNight(n.slice(0, 28));
    const t = q.get("theme");
    if (t && THEMES.some((x) => x.id === t)) setTheme(t);
    setRestored(true);
  }, [bySlug]);
  useEffect(() => {
    if (!restored) return;
    const url = new URL(window.location.href);
    url.searchParams.set("djs", order.join(","));
    url.searchParams.set("night", night);
    url.searchParams.set("theme", theme);
    window.history.replaceState(null, "", url);
  }, [order, night, theme, restored]);

  const add = (slug: string) => setOrder((o) => (o.includes(slug) || o.length >= MAX ? o : [...o, slug]));
  const remove = (slug: string) => setOrder((o) => o.filter((s) => s !== slug));
  const surprise = () => {
    const pool = [...roster];
    const out: string[] = [];
    while (out.length < 6 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].slug);
    setOrder(out);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the address bar already holds the link */
    }
  };

  const t = THEMES.find((x) => x.id === theme)!;
  const full = order.length >= MAX;

  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" aria-label="Make a flyer for your own night">
      <div className="min-w-0">
        <h2 className="font-display text-4xl leading-[0.95] text-[var(--text)] sm:text-5xl">Throw your own night.</h2>
        <p className="mt-3 max-w-[46ch] text-[15px] text-[var(--muted)]">Book up to {MAX} DJs from the archive and drag them into a running order. Every name on your flyer plays one of their tapes.</p>

        <div className="mt-6">
          <label htmlFor="flyer-night" className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Name of the night
          </label>
          <input id="flyer-night" value={night} maxLength={28} onChange={(e) => setNight(e.target.value)} autoComplete="off" className="h-11 w-full border-[1.5px] border-[var(--text)] bg-transparent px-3 text-base text-[var(--text)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]" />
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <Combobox
            value={null}
            disabled={full}
            query={query}
            onQueryChange={(q: string) => setQuery(q)}
            onValueChange={(v: unknown) => {
              if (typeof v !== "string") return;
              add(v);
              // Booking someone empties the box so the next search starts clean.
              setTimeout(() => setQuery(""), 0);
            }}
          >
            <div className="min-w-0 flex-1">
              <ComboboxLabel className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                {full ? `Lineup is full (${MAX})` : "Book a DJ"}
              </ComboboxLabel>
              <ComboboxInput autoComplete="off" spellCheck={false} className="h-11 w-full border-[1.5px] border-[var(--text)] bg-transparent px-3 text-base text-[var(--text)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)] disabled:cursor-not-allowed disabled:border-[var(--border)]" />
            </div>
            <ComboboxContent className="z-50 max-h-80 w-[var(--anchor-width,20rem)] min-w-64 overflow-y-auto border-[1.5px] border-[var(--text)] bg-[var(--bg)] shadow-[4px_4px_0_var(--text)]">
              <ComboboxList>
                {roster
                  .filter((d) => !order.includes(d.slug))
                  .map((d) => (
                    <ComboboxItem key={d.slug} value={d.slug} className="atlas-option flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm text-[var(--text)]">
                      <span className="truncate font-medium">{d.name}</span>
                      <span className="flex-none font-mono text-[11px] tabular-nums text-[var(--muted)]">
                        {d.count} {d.count === 1 ? "tape" : "tapes"}
                      </span>
                    </ComboboxItem>
                  ))}
              </ComboboxList>
              <ComboboxEmpty className="px-3 py-3 text-sm text-[var(--muted)]">No DJ in the archive by that name.</ComboboxEmpty>
            </ComboboxContent>
          </Combobox>
          <button type="button" onClick={surprise} className="poster-btn min-h-11 flex-none">
            Surprise me
          </button>
        </div>

        <p id="flyer-order-help" className="mb-2 mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
          Running order · drag to reorder, or Space to pick up and arrows to move · Delete removes
        </p>
        {order.length === 0 ? (
          <p className="border-[1.5px] border-dashed border-[var(--text)] p-5 text-[15px] text-[var(--text)]">Nobody is booked yet. Book a DJ above, or let the archive choose.</p>
        ) : (
          <Lineup value={order} onValueChange={(v: string[]) => setOrder(v)} aria-label="Running order" className="flyer-lineup border-[1.5px] border-[var(--text)]" data-proto-keys>
            {order.map((slug, i) => (
              <LineupItem
                key={slug}
                value={slug}
                aria-describedby="flyer-order-help"
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Delete" || e.key === "Backspace") remove(slug);
                }}
                className="flyer-row flex min-h-12 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)] pl-3 last:border-b-0"
              >
                <svg className="h-4 w-4 flex-none text-[var(--muted)]" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="3" r="1.3" /><circle cx="11" cy="3" r="1.3" /><circle cx="5" cy="8" r="1.3" /><circle cx="11" cy="8" r="1.3" /><circle cx="5" cy="13" r="1.3" /><circle cx="11" cy="13" r="1.3" />
                </svg>
                <span className="w-12 flex-none font-mono text-[11px] tabular-nums text-[var(--muted)]">{hour(i)}</span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[var(--text)]">{bySlug.get(slug)?.name}</span>
                <button
                  type="button"
                  tabIndex={-1}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => remove(slug)}
                  aria-label={`Remove ${bySlug.get(slug)?.name}`}
                  className="grid h-11 w-11 flex-none cursor-pointer place-items-center text-[var(--muted)] hover:text-[var(--text)]"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </LineupItem>
            ))}
          </Lineup>
        )}

        <fieldset className="mt-6">
          <legend className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Paper stock</legend>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((x) => (
              <label key={x.id} className="flyer-stock flex min-h-11 cursor-pointer items-center gap-2 border-[1.5px] border-[var(--text)] px-3 text-sm text-[var(--text)]">
                <input type="radio" name="flyer-theme" value={x.id} checked={theme === x.id} onChange={() => setTheme(x.id)} className="sr-only" />
                <span className="h-4 w-4 flex-none" style={{ background: x.bg, boxShadow: `inset 0 0 0 1px rgb(0 0 0 / 0.25), inset -6px 0 0 ${x.pop}` }} aria-hidden />
                {x.name}
              </label>
            ))}
          </div>
        </fieldset>

        <button type="button" onClick={copy} className="poster-btn mt-6 min-h-11 min-w-[15rem] !bg-[var(--text)] !text-[var(--bg)]">
          {copied ? "Link copied ✓" : "Copy a link to this night"}
        </button>
      </div>

      <div className="min-w-0 lg:sticky lg:top-8 lg:self-start">
        <article className="flyer-sheet relative aspect-[4/5] w-full overflow-hidden [container-type:inline-size]" style={{ background: t.bg, color: t.ink }} aria-label={`Flyer for ${night || "your night"}`}>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <circle key={i} cx="330" cy="70" r={26 + i * 30} fill="none" stroke={t.pop} strokeWidth="9" opacity={0.9 - i * 0.07} />
            ))}
          </svg>
          <div className="relative flex h-full flex-col p-[6cqw]">
            <p className="font-mono text-[2.4cqw] font-bold uppercase tracking-[0.3em]">Simfonik presents</p>
            <h3 className="mt-[1.5cqw] max-w-[78%] break-words font-display text-[15cqw] uppercase leading-[0.84] [text-wrap:balance]" style={{ textShadow: t.pop === t.ink ? undefined : `0.7cqw 0.7cqw 0 ${t.pop}` }}>
              {night || "Your night"}
            </h3>
            <ul className="mt-auto flex flex-col gap-[0.6cqw]">
              {order.map((slug, i) => {
                const d = bySlug.get(slug);
                if (!d) return null;
                return (
                  <li key={slug} className="flex items-baseline gap-[2cqw]">
                    <span className="w-[9cqw] flex-none font-mono text-[2.3cqw] font-bold tabular-nums">{hour(i)}</span>
                    <Link href={`/tapes/${d.tape.id}`} className={`flyer-name min-w-0 cursor-pointer truncate font-display uppercase leading-[0.92] ${SIZES[i]}`}>
                      {d.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-[3cqw] border-t-[0.5cqw] pt-[2cqw] font-mono text-[2.1cqw] font-bold uppercase tracking-[0.2em]" style={{ borderColor: t.ink }}>
              All night · every name plays a real tape · simfonik.com
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
