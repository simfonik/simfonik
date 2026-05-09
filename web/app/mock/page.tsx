import Link from "next/link";
import { Anton } from "next/font/google";
import { getAllTapes } from "../../lib/data";
import { ThemeToggle } from "./ThemeToggle";
import { Oscilloscope } from "./Oscilloscope";
import { RotatingWord } from "./RotatingWord";
import { MockPlayer } from "./MockPlayer";
import { MockGallery } from "./MockGallery";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mock-display",
});

export const metadata = {
  title: "palette mock — simfonik",
  robots: { index: false, follow: false },
};

const SAMPLE_COMMENTS = [
  {
    author: "sam gordon aka Mushroe",
    date: "April 8, 2026",
    text: "taking me back to the sweet nights all over socal. Not to mention awesome throwback sets at Sketchpad. thank you moonpup truly made my day. Reminded me of days past that formed me as a human. First time I saw you play was at Aphrodites Temple, and at sketch, countless memories, good memories, given all the bias in the scene.  Just to get down in the living room with my 25 year old son.  Finally getting that point across. Breaks = Life\nTHANK YOU!!!!!!!!",
  },
  {
    author: "Jennifer",
    date: "April 5, 2026",
    text: "Moonpup you're so funky, so lovely, and you have such wonderful musical taste. Please don't ever stop sharing your gift with us as it's so greatly appreciated. xoxoxo",
  },
  {
    author: "Fyzical Music",
    date: "May 1, 2026",
    text: "Polyswag turned me on to this years ago and I had to ask if I could play this mix on my radio show in Houston, Texas on 90.1 FM KPFT. No, called \"Future Primitive\" (a nod to the SF scene)... I have a segment on my show called \"LEGENDS MIXTAPE SERIES\" and it would be an honor to play it in its entirety.",
  },
];

export default function MockPage() {
  const tapes = getAllTapes();
  const galleryTapes = tapes
    .filter(
      (t) =>
        t.images?.cover &&
        !t.images.cover.includes("placeholders") &&
        !t.images.cover.includes("blank-tape"),
    )
    .slice(0, 9);
  const featured =
    tapes.find((t) => t.id === "destructo-intrance") ?? galleryTapes[0];
  if (!featured) return null;
  const totalTapes = tapes.length;

  return (
    <>
      <PaletteStyles />
      <div className={`${anton.variable} mock-root min-h-screen`}>
        {/* Header */}
        <header className="bg-[var(--mock-bg)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <Link href="/mock" className="inline-block">
                <div className="mock-display text-3xl leading-none text-[var(--mock-text)]">
                  simfonik
                </div>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  href="#"
                  className="mock-mono text-[12px] uppercase tracking-[0.1em] text-[var(--mock-text)] hover:text-[var(--mock-accent-text)] transition-colors font-semibold"
                >
                  Browse DJs
                </Link>
                <Link
                  href="#"
                  className="mock-mono text-[12px] uppercase tracking-[0.1em] text-[var(--mock-text)] hover:text-[var(--mock-accent-text)] transition-colors font-semibold"
                >
                  About
                </Link>
                <Link
                  href="#"
                  className="mock-mono text-[12px] uppercase tracking-[0.1em] text-[var(--mock-text)] hover:text-[var(--mock-accent-text)] transition-colors font-semibold"
                >
                  Contribute
                </Link>
                <ThemeToggle />
                <button type="button" className="mock-btn">
                  Subscribe
                </button>
              </nav>
            </div>
          </div>
        </header>

        {/* Hero — minimal oscilloscope waveform */}
        <div
          className="mock-hero relative h-[70px] sm:h-[100px] lg:h-[140px] w-full overflow-hidden"
          aria-hidden
        >
          <Oscilloscope className="absolute inset-0" />
        </div>

        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          {/* Mixtapes section header */}
          <div className="mb-10">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <h1 className="mock-display text-4xl sm:text-5xl lg:text-6xl leading-[0.95] text-[var(--mock-text)]">
                Mixtapes
              </h1>
              <div className="w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.333rem)] relative pb-1 border-b-[1.5px] border-[var(--mock-text)] flex items-center gap-2">
                <svg
                  className="w-4 h-4 flex-shrink-0 text-[var(--mock-muted)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="search"
                  placeholder="Search by DJ, title, or year"
                  className="mock-mono w-full bg-transparent py-1.5 text-[12px] tracking-wide text-[var(--mock-text)] placeholder:text-[var(--mock-muted)] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Tape grid — chrome stripped, art-catalog style */}
          <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {galleryTapes.map((tape, i) => {
              const number = String(totalTapes - i).padStart(3, "0");
              return (
                <article key={tape.id} className="group relative">
                  <Link
                    href="#"
                    className="absolute inset-0"
                    aria-label={`View ${tape.title}`}
                  />
                  <div className="mock-cover-frame relative w-full aspect-[3/2] mb-5 border-[1.5px] border-[var(--mock-text)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/optimized/${tape.id}/800.avif`}
                      alt={`${tape.title} mixtape cover`}
                      className="absolute inset-0 w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <span className="mock-mono text-[10px] uppercase tracking-[0.25em] text-[var(--mock-muted)]">
                      № {number}
                    </span>
                    {tape.released && (
                      <span className="mock-mono text-[10px] uppercase tracking-[0.25em] text-[var(--mock-muted)]">
                        {tape.released}
                      </span>
                    )}
                  </div>
                  <h2 className="mock-display text-2xl sm:text-3xl leading-[1.05] text-[var(--mock-text)] mb-3 group-hover:text-[var(--mock-accent-text)] transition-colors">
                    {tape.title}
                  </h2>
                  <div className="dj-pill-row flex flex-wrap gap-2">
                    {tape.djs.map((dj) => (
                      <span
                        key={dj.slug}
                        className="mock-pill relative pointer-events-auto"
                      >
                        {dj.name}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Featured tape detail */}
          <section className="mt-24 pt-14 border-t-[1.5px] border-[var(--mock-border)]">
            <div className="grid lg:grid-cols-[1fr_500px] gap-10 items-start">
              <MockGallery
                images={[
                  {
                    src: `/optimized/${featured.id}/1200.avif`,
                    thumb: `/optimized/${featured.id}/400.avif`,
                    label: `${featured.title} cover`,
                  },
                  ...(featured.sides ?? [])
                    .filter((s) => s.image)
                    .map((s) => ({
                      src: `/optimized/${featured.id}/sides/${s.position.toLowerCase()}/1200.avif`,
                      thumb: `/optimized/${featured.id}/sides/${s.position.toLowerCase()}/400.avif`,
                      label: `${featured.title} side ${s.position}`,
                    })),
                ]}
              />
              <div>
                <h1 className="mock-display text-4xl sm:text-5xl leading-[0.95] text-[var(--mock-text)] mb-6">
                  {featured.title}
                </h1>
                <div className="dj-pill-row flex gap-2 flex-wrap mb-6">
                  {featured.djs.map((dj) => (
                    <span key={dj.slug} className="mock-pill">
                      {dj.name}
                    </span>
                  ))}
                </div>
                <div className="space-y-1 mock-mono text-[11px] uppercase tracking-[0.22em] text-[var(--mock-muted)] mb-8">
                  {featured.released && <p>Released · {featured.released}</p>}
                  {featured.source && <p>Source · {featured.source}</p>}
                  <p>Origin · Los Angeles</p>
                </div>

                <div className="space-y-3 mt-6">
                  {featured.sides?.map((side) => (
                    <div
                      key={side.position}
                      className="border-[1.5px] border-[var(--mock-text)] bg-[var(--mock-surface)] p-4"
                    >
                      <h2 className="mock-display text-xl leading-tight text-[var(--mock-text)] mb-2">
                        {side.title ?? `Side ${side.position}`}
                      </h2>
                      {side.djs && side.djs.length > 0 && (
                        <p className="mock-mono text-[10px] uppercase tracking-[0.22em] text-[var(--mock-muted)] mb-3">
                          By {side.djs.map((d) => d.name).join(", ")}
                        </p>
                      )}
                      <MockPlayer
                        seed={side.position.charCodeAt(0)}
                        duration={side.position === "A" ? "47:18" : "44:52"}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Comments */}
          <section className="border-t-[1.5px] border-[var(--mock-border)] pt-14 mt-16">
            <div className="max-w-3xl">
              <h2 className="mock-display text-4xl sm:text-5xl leading-[0.95] text-[var(--mock-text)] mb-8">
                Comments
              </h2>
              <div className="space-y-6">
                {SAMPLE_COMMENTS.map((c, i) => (
                  <div
                    key={i}
                    className="border-l-4 border-[var(--mock-accent)] pl-4 py-1"
                  >
                    <div className="mb-2">
                      <div className="mock-display text-xl leading-tight text-[var(--mock-text)]">
                        {c.author}
                      </div>
                      <div className="mock-mono text-[10px] uppercase tracking-[0.22em] text-[var(--mock-muted)] mt-1">
                        {c.date}
                      </div>
                    </div>
                    <div className="text-[var(--mock-text)] whitespace-pre-wrap leading-relaxed">
                      {c.text}
                    </div>
                  </div>
                ))}
              </div>

              <h2 className="mock-display text-3xl sm:text-4xl leading-[0.95] text-[var(--mock-text)] mb-6 mt-14">
                <RotatingWord />
              </h2>
              <form className="space-y-5 mb-10">
                <div>
                  <label
                    htmlFor="m-name"
                    className="block mock-mono text-[10px] uppercase tracking-[0.25em] text-[var(--mock-muted)] mb-2"
                  >
                    Name <span className="text-[var(--mock-accent-text)]">*</span>
                  </label>
                  <input
                    type="text"
                    id="m-name"
                    className="mock-mono w-full border-[1.5px] border-[var(--mock-text)] bg-[var(--mock-bg)] px-3 py-2 text-sm text-[var(--mock-text)] placeholder:text-[var(--mock-muted)] focus:outline-none focus:bg-[var(--mock-surface)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="m-email"
                    className="block mock-mono text-[10px] uppercase tracking-[0.25em] text-[var(--mock-muted)] mb-2"
                  >
                    Email{" "}
                    <span className="normal-case tracking-normal opacity-60">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="email"
                    id="m-email"
                    className="mock-mono w-full border-[1.5px] border-[var(--mock-text)] bg-[var(--mock-bg)] px-3 py-2 text-sm text-[var(--mock-text)] focus:outline-none focus:bg-[var(--mock-surface)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="m-comment"
                    className="block mock-mono text-[10px] uppercase tracking-[0.25em] text-[var(--mock-muted)] mb-2"
                  >
                    Comment <span className="text-[var(--mock-accent-text)]">*</span>
                  </label>
                  <textarea
                    id="m-comment"
                    rows={6}
                    className="w-full border-[1.5px] border-[var(--mock-text)] bg-[var(--mock-bg)] px-3 py-2 text-[var(--mock-text)] focus:outline-none focus:bg-[var(--mock-surface)] resize-y"
                  />
                  <div className="mock-mono text-[10px] uppercase tracking-[0.22em] text-[var(--mock-muted)] mt-2">
                    0 / 5000 characters
                  </div>
                </div>
                <button type="submit" className="mock-btn">
                  Post Comment
                </button>
              </form>
            </div>
          </section>
        </main>

        {/* Newsletter footer */}
        <footer className="mt-auto">
          <div className="mock-newsletter-band border-t-[1.5px] border-[var(--mock-border)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
              <div className="text-center">
                <h3 className="mock-display text-3xl sm:text-4xl lg:text-5xl leading-[0.95] text-[var(--mock-text)] mb-3">
                  Get notified when new tapes drop.
                </h3>
                <p className="mock-mono text-[11px] uppercase tracking-[0.25em] text-[var(--mock-muted)] mb-8">
                  No spam. Just new recordings added to the archive.
                </p>
                <form className="flex flex-col sm:flex-row items-stretch gap-3 max-w-md mx-auto">
                  <input
                    type="email"
                    placeholder="you@email.com"
                    className="mock-mono w-full sm:flex-1 border-[1.5px] border-[var(--mock-text)] bg-[var(--mock-bg)] px-4 py-2.5 text-sm text-[var(--mock-text)] placeholder:text-[var(--mock-muted)] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="mock-btn whitespace-nowrap"
                  >
                    Subscribe
                  </button>
                </form>
              </div>
            </div>
          </div>
          <div className="border-t-[1.5px] border-[var(--mock-border)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mock-mono text-[10px] uppercase tracking-[0.22em] text-[var(--mock-muted)]">
              <p>© respective artists & rights holders · non-commercial</p>
              <div className="flex gap-6">
                <Link
                  href="#"
                  className="hover:text-[var(--mock-accent-text)] transition-colors"
                >
                  About
                </Link>
                <Link
                  href="#"
                  className="hover:text-[var(--mock-accent-text)] transition-colors"
                >
                  Contribute
                </Link>
                <Link
                  href="#"
                  className="hover:text-[var(--mock-accent-text)] transition-colors"
                >
                  Rights & Takedown
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

function PaletteStyles() {
  const css = `
    /* ============================================
       Type
       ============================================ */
    .mock-root {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    .mock-root .mock-display {
      font-family: var(--font-mock-display), Impact, "Helvetica Neue Condensed", sans-serif;
      font-weight: 400;
      letter-spacing: 0.005em;
    }
    .mock-root .mock-mono {
      font-family: var(--font-geist-mono), ui-monospace, monospace;
      font-weight: 500;
    }

    /* ============================================
       Oscilloscope hero — color via currentColor,
       fades at horizontal edges so the wave never
       touches the container walls
       ============================================ */
    .mock-root .mock-oscilloscope {
      color: var(--mock-text);
      -webkit-mask-image: linear-gradient(to right, transparent 0%, black 9%, black 91%, transparent 100%);
      mask-image: linear-gradient(to right, transparent 0%, black 9%, black 91%, transparent 100%);
    }

    /* ============================================
       Hard borders stripped in both modes
       ============================================ */
    .mock-root .mock-cover-frame { border-width: 0; }

    /* ============================================
       Rotating word in "Leave a [word]"
       Scramble — letters cycle through random chars
       before settling left-to-right onto the target.
       ============================================ */
    .mock-rotating-word {
      display: inline-block;
      white-space: nowrap;
    }

    /* ============================================
       Cassette cover frames
       ============================================ */
    .mock-cover-frame {
      position: relative;
      isolation: isolate;
      overflow: hidden;
    }


    /* ============================================
       Sticker DJ pills
       ============================================ */
    .mock-pill {
      display: inline-flex;
      align-items: center;
      position: relative;
      border: 1.5px solid transparent;
      background: transparent;
      color: var(--mock-text);
      font-family: var(--font-geist-mono), ui-monospace, monospace;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 0.25rem 0.5rem;
      border-radius: 0.125rem;
      font-size: 0.75rem;
      transition:
        transform 0.22s cubic-bezier(0.34, 1.16, 0.5, 1),
        box-shadow 0.18s,
        border-color 0.18s;
      cursor: pointer;
      line-height: 1.4;
    }
    .mock-pill:hover {
      border-color: var(--mock-text);
      transform: translate(-2px, -2px);
      box-shadow: 3px 3px 0 var(--mock-text);
    }

    /* ============================================
       Search input — clear (X) button
       ============================================ */
    .mock-root input[type="search"]::-webkit-search-cancel-button {
      -webkit-appearance: none;
      appearance: none;
      height: 14px;
      width: 14px;
      background-color: var(--mock-muted);
      -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' fill='black'/></svg>");
      mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' fill='black'/></svg>");
      -webkit-mask-size: contain;
      mask-size: contain;
      -webkit-mask-repeat: no-repeat;
      mask-repeat: no-repeat;
      cursor: pointer;
    }
    .mock-root input[type="search"]::-webkit-search-cancel-button:hover {
      background-color: var(--mock-text);
    }

    /* ============================================
       Poster-block buttons
       ============================================ */
    .mock-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: relative;
      border: 1.5px solid var(--mock-text);
      font-family: var(--font-geist-mono), ui-monospace, monospace;
      font-weight: 700;
      font-size: 0.8125rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 0.55rem 1.1rem;
      border-radius: 0.125rem;
      transition:
        transform 0.22s cubic-bezier(0.34, 1.16, 0.5, 1),
        box-shadow 0.18s;
      cursor: pointer;
      line-height: 1;
    }
    .mock-btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: 4px 4px 0 var(--mock-text);
    }


    /* ============================================
       Structural vars — palette-independent
       ============================================ */
    .mock-root {
      --mock-bg: #ffffff;
      --mock-bg-hover: #f4f4f5;
      --mock-surface: #ffffff;
      --mock-border: #e5e7eb;
      --mock-text: #0a0a0a;
      --mock-muted: #6b7280;

      /* Mono accent (default) */
      --mock-accent: #1a1a1a;
      --mock-accent-hover: #000000;
      --mock-on-accent: #ffffff;
      --mock-accent-text: #1a1a1a;
      --mock-glow: rgba(0, 0, 0, 0.10);

      background: var(--mock-bg);
      color: var(--mock-text);
    }

    .mock-dark .mock-root {
      --mock-bg: #0a0a0a;
      --mock-bg-hover: #1a1a1a;
      --mock-surface: #131316;
      --mock-border: #27282d;
      --mock-text: #f5f5f5;
      --mock-muted: #a1a1aa;

      --mock-accent: #f5f5f5;
      --mock-accent-hover: #ffffff;
      --mock-on-accent: #0a0a0a;
      --mock-accent-text: #f5f5f5;
      --mock-glow: rgba(255, 255, 255, 0.08);
    }

    @media (prefers-color-scheme: dark) {
      :root:not(.mock-light) .mock-root {
        --mock-bg: #0a0a0a;
        --mock-bg-hover: #1a1a1a;
        --mock-surface: #131316;
        --mock-border: #27282d;
        --mock-text: #f5f5f5;
        --mock-muted: #a1a1aa;

        --mock-accent: #f5f5f5;
        --mock-accent-hover: #ffffff;
        --mock-on-accent: #0a0a0a;
        --mock-accent-text: #f5f5f5;
        --mock-glow: rgba(255, 255, 255, 0.08);
      }
    }

    .mock-root ::selection {
      background: var(--mock-accent);
      color: var(--mock-on-accent);
    }
  `;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
