# 0003 — DJ Index Page (/djs)

## Goal
Add a `/djs` page that lists all DJs in the archive and links to each DJ detail page.

## Scope
- Add route: `/djs`
- Derive unique DJs from `web/data/tapes.json`
- For each DJ, show:
  - DJ name
  - Tape count (number of tapes they appear on)
  - Link to `/djs/[slug]`
- Sorting: alphabetical by DJ name

## Non-goals
- Admin UI
- Artist name variations / aliases
- Pagination
- Per-DJ images
- “Latest tape” metadata
- Search (can be a later iteration)

## Acceptance criteria
- Visiting `/djs` renders a list of all unique DJs present in `web/data/tapes.json`
- Each DJ entry links to `/djs/[slug]`
- Each DJ entry shows a correct tape count
- No changes required to existing Tape/Side/Track types or existing routes

## Implementation plan
1) Add a data helper in `web/lib/data.ts`:
   - `getAllDJs()` returns `{ name, slug, tapeCount }[]` sorted by name
2) Create `web/app/djs/page.tsx`:
   - Reads DJs via `getAllDJs()`
   - Renders a simple grid/list of DJ cards linking to `/djs/[slug]`
3) Add a link to `/djs` in the header (optional but recommended)
4) Verify locally
5) Commit changes