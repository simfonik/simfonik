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

## Image optimization
- All images are pre-generated as static AVIF files at build time. Do NOT use Vercel's on-demand image optimization (`/_next/image`).
- Every `<Image>` component must use `loader={imageLoader}` from `lib/imageLoader.ts` — or be replaced with a plain `<img>` tag for SVGs and non-optimizable assets.
- `next.config.ts` intentionally has no `unoptimized: true` flag; the imageLoader handles routing to pre-generated files.
- To add a new site-level image (not a tape), add it to the site images section of `scripts/optimize-images.mjs` and add a case to `lib/imageLoader.ts`.
- Tape images are handled automatically by `scripts/optimize-images.mjs` — run it after adding any new tape.
