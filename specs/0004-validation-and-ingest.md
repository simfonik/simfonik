# 0004 — Validation + Ingest Helpers (JSON Quality + Safety Rails)

## Goal
Make it safe and fast to keep adding tapes by hand without breaking the site.

Add a small validation + ingest toolchain that:
- validates `web/data/tapes.json`
- catches common mistakes early (missing fields, duplicate ids/slugs, bad media paths, bad Dropbox links)
- optionally generates a “cleaned”/normalized output for review

This stays local-only (no admin UI, no database).

## Scope
- Add a Node script (or small set of scripts) runnable from the repo root:
  - `npm run validate` — validates `web/data/tapes.json` and exits non-zero on errors
  - `npm run validate:fix` — optional: outputs a normalized JSON file (does NOT auto-overwrite unless explicitly requested)
- Add a canonical DJ registry file:
  - `web/data/djs.json` — source of truth for DJ display names keyed by `slug`
- Validation rules cover:
  - IDs uniqueness
  - DJ slug format + canonical name consistency via `djs.json`
  - Side structure correctness
  - Audio link format for Dropbox direct streaming
  - Local image path sanity (only for paths that start with `/media/`)
  - Optional side-level DJ attribution rules

## Non-goals
- Moving audio hosting off Dropbox
- Creating an upload/ingest admin UI
- Styling changes
- Runtime validation in the Next.js app (this is a build-time/dev tool)

## Data assumptions (current model)
- Tape:
  - `id`, `title`, optional `released`, `djs[]`, optional `images.cover`, `sides[]`
- Side:
  - `position` (used for file naming like `a.jpg`, `b.jpg`)
  - optional `title`
  - optional `djs[]` (used only when different performers per side)
  - `audio_links[]` (one link per side)
  - optional `image`
  - optional `tracks[]`
- DJ registry:
  - `web/data/djs.json` contains objects:
    - `slug` (canonical key)
    - `name` (canonical display name)

## Validation rules

### Severity levels
- Errors: fail validation (exit code 1)
- Warnings: print but do not fail (exit code 0)

### Tape-level (errors unless noted)
- `tape.id` must be present, non-empty, URL-safe slug (`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
- All `tape.id` values must be unique
- `tape.title` must be present, non-empty
- `tape.released` is optional
  - If present but empty => warning
  - If present but clearly malformed (validator can do light checks) => warning
- `tape.djs` must be a non-empty array
  - Each DJ must have `slug`
  - `dj.slug` must match slug regex above
  - `dj.name` may be present, but canonical display names come from `web/data/djs.json`
- If `tape.images.cover` exists and starts with `/media/`, the file must exist at `web/public` + that path

### DJ-level (global)
- `web/data/djs.json` is required and must be valid JSON
- Every `dj.slug` referenced in `web/data/tapes.json` must exist in `web/data/djs.json` (error)
- Canonical naming:
  - A `dj.slug` maps to exactly one canonical `name` in `djs.json`
  - If a tape contains `dj.name` and it differs from the canonical name, warn (or error if you want stricter later)

### Side-level
- `side.position` must be present, non-empty (string) (error)
- `side.audio_links` must be a non-empty array (error)
  - For now: require exactly one audio link per side (error if 0 or >1)
  - Each audio link must have `url` (error)
  - `label` is optional; if present but empty, normalize it away
- If `side.image` exists and starts with `/media/`, the file must exist at `web/public` + that path (error)
- If `side.djs` exists:
  - It must be a non-empty array (error)
  - Every `side.djs[].slug` must match one of the tape-level `tape.djs[].slug` values (error)

### Dropbox URL checks
- If an audio `url` is a Dropbox link, it must be “direct/streamable”:
  - Accept:
    - `https://www.dropbox.com/...raw=1`
    - `https://dl.dropboxusercontent.com/...`
  - Reject:
    - `...dl=0` (preview page style)
- The validator should report a clear “how to fix” message:
  - “replace `dl=0` with `raw=1`” (or add `raw=1`)

## Output behavior
- `npm run validate` prints:
  - ✅ summary if clean
  - ❌ a list of errors with tape id + JSON path + message
  - ⚠️ a list of warnings with tape id + JSON path + message
- Optional `npm run validate:fix`:
  - writes `web/data/tapes.normalized.json`
  - normalization rules:
    - sort tapes by released (descending) then title
      - tapes missing `released` sort last
    - within a tape: keep sides in input order
    - within a tape: keep DJs in input order
    - strip unused `audio_links[].label` if present but empty
    - optionally (non-destructive) ensure `dj.name` matches canonical name in `djs.json` in the normalized output only
  - never edits original file unless a separate explicit command is used later

## Acceptance criteria
- Running `npm run validate` succeeds on the current data
- Introduce one intentional error (duplicate tape id) and validator fails with a clear message
- Validator checks local `/media/...` paths against `web/public/...` existence
- Validator enforces Dropbox direct/streamable rule and gives a fix suggestion
- Validator enforces DJ registry rules:
  - any DJ slug used in tapes must exist in `web/data/djs.json`

## Implementation plan (high level)
1) Add `web/scripts/validate-tapes.mjs` (or `.ts` if preferred)
2) Add `web/data/djs.json` (seed it from existing DJs in `web/data/tapes.json`)
3) Add `npm` scripts in the correct `package.json` (the one inside `web/` if that’s where Next lives)
4) Implement validations + readable error/warn output
5) (Optional) Add `validate:fix` that writes `tapes.normalized.json`
6) Commit