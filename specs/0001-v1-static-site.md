# 0001 — v1 Static DJ Mixtape Archive Site (Tapes + Sides)

## Goal
Ship a minimal, runnable public website that lets users browse DJ mixtapes, open a tape detail page, view tracklists per side, and access audio via external links (per side). No admin, auth, or deployment concerns.

## Non-goals (explicitly out of scope)
- Hosting or uploading audio files
- User accounts, favorites, comments
- Admin UI or editing content in the browser
- Search, tags, playlists, RSS
- Backend database or API routes
- Artist name variations / aliases

## Users & primary flows
1) Browse tapes list → click tape → detail page with sides, audio links, and tracklists  
2) Browse by DJ → see tapes for a DJ → click tape  
3) Navigate back to list

## Information architecture / routes
- `/` tapes index (sorted newest first)
- `/tapes/[id]` tape detail
- `/djs/[slug]` DJ detail (tapes for that DJ)

## Data model (static)
Data lives in a single file: `data/tapes.json`

### Tape
- `id` (string, unique, URL-safe)
- `title` (string)
- `released` (string: `YYYY` or `YYYY-MM` or `YYYY-MM-DD`)
- `djs` (array of `{ name, slug }`)
- `images` (optional object)
  - `cover` (optional string URL/path)
- `sides` (array of Side, length >= 1)

### Side
- `position` (string; supports `A`, `B`, `1`, `2`, `Green`, `Blue`, etc.)
- `title` (optional string)
- `audio_links` (array of `{ label, url }`, length >= 1)
  - `url` is an external HTTPS URL (e.g. Dropbox share link)
- `image` (optional string URL/path)
- `tracks` (optional array of Track)

### Track
- `artist` (string)
- `title` (string)
- `duration` (optional string, e.g. `4:32`)

Constraints:
- Keep the JSON small and readable.
- Include 6–10 sample tapes.
- Every tape must have at least 1 DJ and at least 1 side.
- Every side must have at least 1 audio link.
- Tracklists may be omitted or short (5–15 items).

## UI requirements (minimal)
- Clean layout, readable typography
- Index page (`/`): tape cards showing Title, released, DJs
- Tape detail (`/tapes/[id]`):
  - Title, released, DJs (each links to DJ page)
  - Cover image if present
  - For each side:
    - Heading (position + optional title)
    - Side image if present
    - Audio links as buttons that open in a new tab
    - Optionally render an inline audio player if the URL is directly streamable
    - Tracklist list/table if present
- DJ page (`/djs/[slug]`): DJ name + list of tapes (newest first)

## Tech constraints
- Use Next.js (App Router) + TypeScript
- No database, no server API routes (static reading only)
- Styling: simple (Tailwind OK)
- Must run locally with: `pnpm install` then `pnpm dev`

## Acceptance criteria
- Visiting `/` shows a list of tapes populated from `data/tapes.json`
- Clicking a tape goes to `/tapes/[id]` and renders tape details plus at least one side
- Side sections render per-side audio links that open in a new tab
- DJ links go to `/djs/[slug]` showing only that DJ’s tapes
- Optional images render if provided (missing images do not crash the page)
- No runtime errors in dev console
