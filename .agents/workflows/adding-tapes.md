---
description: Steps for adding a new tape to the archive
---

# Adding a New Tape

## Checklist

1. **Add entry to `web/data/tapes.json`**
   - Append to the end of the array
   - Follow the schema below; only include fields that apply

2. **Place source images locally**
   - `web/public/media/tapes/{id}/cover.{jpg|png}`
   - `web/public/media/tapes/{id}/sides/a.{jpg|png}` *(if side images exist)*
   - `web/public/media/tapes/{id}/sides/b.{jpg|png}` *(if side images exist)*
   - **JPG**: standard photo covers, smaller file size, no transparency
   - **PNG**: covers with transparent backgrounds (e.g. cassettes cut out from a backdrop). Alpha is preserved through to the AVIF output, so transparent regions show the page bg in both light and dark mode.

// turbo
3. **Validate** — must pass before committing
   ```
   node web/scripts/validate-tapes.mjs
   ```

// turbo
4. **Run image optimization** (generates AVIF variants and OG images)
   ```
   node web/scripts/optimize-images.mjs
   ```

5. **Commit** — include `tapes.json`, source JPGs, and ALL freshly generated optimized assets in `web/public/optimized/` and `web/public/og/`. (Do NOT gitignore the generated files; tracking them locally allows Vercel to skip heavy image processing via hashing.)

---

## JSON Schema

```json
{
  "id": "dj-slug-tape-title-slug",
  "title": "Tape Title",
  "released": "YYYY",
  "created_date": "YYYY-MM-DDTHH:MM:SS",
  "source": "Source Name",
  "djs": [
    { "name": "DJ Name", "slug": "dj-slug" }
  ],
  "images": {
    "cover": "/media/tapes/{id}/cover.jpg"  // or cover.png
  },
  "sides": [
    {
      "position": "A",
      "djs": [{ "name": "DJ Name", "slug": "dj-slug" }],
      "audio_links": [{ "url": "https://audio.simfonik.com/tapes/{id}/a.mp3" }],
      "image": "/media/tapes/{id}/sides/a.jpg"
    },
    {
      "position": "B",
      "djs": [{ "name": "DJ Name", "slug": "dj-slug" }],
      "audio_links": [{ "url": "https://audio.simfonik.com/tapes/{id}/b.mp3" }],
      "image": "/media/tapes/{id}/sides/b.jpg"
    }
  ]
}
```

## Notes
- `source`, `djs` per side, and `image` per side are optional — only include if they apply
- Audio is hosted on R2 at `https://audio.simfonik.com/tapes/{id}/`
- `id` follows the pattern `{dj-slug}-{title-slug}` (primary DJ first)
- **Side DJs must be a subset of tape-level DJs** — any slug in a side's `djs` array must also appear in the top-level `djs` array
- **DJ names must be consistent** — the same slug must always use the same display name across all tapes
