# 0012 — DJ Metadata & Biographies

## Goal
Add biography support for DJs and consolidate existing DJ metadata (aliases, links) into a single data file.

## Non-goals
- Automated bio generation
- Markdown/HTML formatting in bios

## Users & primary flows
1) User visits DJ page with bio → reads biographical paragraph
2) Admin adds bio → edits `dj-data.json` with plain text

## Technical approach

**Consolidate `dj-aliases.json` + `dj-links.json` → `dj-data.json`**

Structure:
```json
{
  "dj-slug": {
    "aliases": [{ "name": "...", "slug": "..." }],
    "links": ["https://..."],
    "bio": "Plain text biography..."
  }
}
```

All fields optional.

**`lib/data.ts`** — Replace three read functions with single `readDJData()`. Add `getDJBio(slug)` export.

**`app/djs/[slug]/page.tsx`** — Display bio paragraph (if exists) between links and tape grid. Long bios truncate to 3 lines with "Read more" toggle. Max-width container, muted text, relaxed leading.

## Benefits
Single source of truth for DJ metadata. Easier to add future fields (years active, labels, etc.). SEO value from unique biographical content.
