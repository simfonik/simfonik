# Mixtape Archive – Agent Rules

## Goal
Build a simple, functioning website for a DJ mixtape archive.

## Scale and audience
This is a solo personal project maintained by one non-career developer. Recommendations and patterns must match that scale:

- Suggest tooling and practices appropriate for a single maintainer, not multi-engineer teams. Don't introduce branch protection / required PR review, schema-migration frameworks, multi-environment deploy pipelines, mandatory code review bots, heavy observability, or other team-coordination overhead unless the user explicitly asks.
- The CI workflow at `.github/workflows/test.yml` is the safety net. Linting, type-checking, and tests run there. Trust that gate; don't add layers on top of it.
- "Industry best practice" is a weak argument. The right practice is what serves a one-person archive site at this scale.
- When tempted to suggest something that "future-proofs" the codebase for hypothetical scale, don't. Wait until that scale exists.

## Working style
- Before coding, propose a short plan and list assumptions.
- Keep implementations minimal and incremental.
- Prefer editing existing files over rewriting.
- If a requirement is ambiguous, ask before building.

## Issue tracking
- Every **code change** requires a Linear issue in the **Simfonik** team (`SIM-` prefix) before work begins. Doc-only changes (e.g. AGENTS.md, README, comments) don't need an issue.
- Reference the issue ID in the commit message — e.g. `feat(home): add activity module (SIM-5)`.
- Move the issue to **In Progress** when starting and **Done** when shipping.
- If a code change is requested without an existing issue, file one first.

### When to use a Linear project
A Linear project is warranted only when **both** are true:
1. The work spans 3+ discrete issues with a shared goal.
2. The total scope would take more than a day or two of human effort (even though AI often ships it faster).

Otherwise, file issues directly under the team.

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
