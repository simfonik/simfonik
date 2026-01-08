# 0002 — Assets & Hosting Conventions (Audio + Images)

## Goal
Define a simple, consistent way to associate images and audio with tapes, without reorganizing the entire existing archive. Keep v1 functionality intact while making it easy to add new tapes.

## Scope
- Document the conventions for:
  - Where images live in the repo
  - How images are referenced in `data/tapes.json`
  - How audio is linked (Dropbox direct links for now)
  - Naming conventions that tie assets to `tape.id`
- Add a small set of example assets and update sample tape entries to use them.

## Non-goals
- Migrating audio to R2
- Building an upload flow or admin UI
- Implementing inline audio playback
- Reorganizing the full existing audio archive on disk

## Conventions

### Tape ID is the primary key
- `tape.id` is the canonical, URL-safe identifier.
- Asset organization is derived from `tape.id`.

### Images live in the repo
All tape images are stored under: web/public/media/tapes/<tape.id>/

Recommended filenames:
- `cover.jpg` (or `.png` if needed)
- `sides/<side.position>.jpg`

Notes:
- `side.position` should be lowercased and URL-safe.
- Common examples: `a.jpg`, `b.jpg`, `green.jpg`, `blue.jpg`

Examples:
- `/media/tapes/green-blue-session-1996/cover.jpg`
- `/media/tapes/green-blue-session-1996/sides/green.jpg`

### Audio links are external (Dropbox for now)
- Audio is not hosted by the app.
- `audio_links[].url` must be a direct, streamable URL when possible.
- Dropbox links should use a direct file URL (not the preview page).

Preferred formats:
- `https://dl.dropboxusercontent.com/...`
- `https://www.dropbox.com/... ?raw=1`
- `https://www.dropbox.com/... ?dl=1`

The app treats audio links as opaque external URLs.

### JSON references
`tapes.json` references assets as follows:

- `tape.images.cover`  
  - Site-relative path starting with `/media/...`

- `side.image`  
  - Site-relative path starting with `/media/...`

- `side.audio_links[].url`  
  - External URL (Dropbox direct link for now)

No changes to the Tape, Side, or Track types are required.

### Side attribution (optional, no type changes)
- If a tape has different DJs per side, encode attribution in `side.title`.
- Examples:
  - `DJ Trance — Increase The Voltage`
  - `R.A.W. — What The Fuck Is This?!`
- This keeps the v1 data model unchanged while making side ownership explicit.

## Acceptance criteria
- At least 2 sample tapes in `data/tapes.json` use:
  - A local cover image at `web/public/media/tapes/<id>/cover.jpg`
  - At least one side image at `web/public/media/tapes/<id>/sides/...`
  - Audio links that clearly follow the Dropbox direct-link format
- The app renders without broken image references for the updated sample tapes
- Existing routes and pages continue to function unchanged

## Implementation plan (high level)
1) Create folder structure under `web/public/media/tapes/` for 2 sample tapes  
2) Add placeholder images (simple JPGs are fine)  
3) Update corresponding entries in `web/data/tapes.json` to reference the new paths  
4) Verify in dev server that:
   - cover image renders
   - side image renders
   - audio links still open externally  
5) Commit changes