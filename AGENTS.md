# Mixtape Archive – Agent Rules

## Goal
Build a simple, functioning website for a DJ mixtape archive.

## Working style
- Before coding, propose a short plan and list assumptions.
- Keep implementations minimal and incremental.
- Prefer editing existing files over rewriting.
- If a requirement is ambiguous, ask before building.

## Guardrails
- Do not add auth/admin features unless explicitly requested.
- Do not introduce extra services unless explicitly requested.

## UI conventions
- All interactive elements (`<button>`, clickable icons, links styled as buttons) must use `cursor-pointer`.

## Image optimization
- All images are pre-generated as static AVIF files at build time. Do NOT use Vercel's on-demand image optimization (`/_next/image`).
- In **Client Components** (`"use client"`): use `<Image loader={imageLoader}>` from `next/image`.
- In **Server Components**: use a plain `<img>` tag with explicit AVIF paths (e.g. `/optimized/{tapeId}/800.avif`). Do NOT pass `loader` as a prop — Next.js 15 prohibits passing functions across the server/client boundary.
- `next.config.ts` intentionally has no `unoptimized: true` flag; the imageLoader handles routing to pre-generated files.
- To add a new site-level image (not a tape), add it to the site images section of `scripts/optimize-images.mjs` and add a case to `lib/imageLoader.ts`.
- Tape images are handled automatically by `scripts/optimize-images.mjs` — run it after adding any new tape.
