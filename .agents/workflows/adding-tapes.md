---
description: Steps for adding a new tape to the archive
---

# Adding a New Tape

## Checklist

1. **Add entry to `web/data/tapes.json`**
   - Append to the end of the array
   - Follow the schema below; only include fields that apply

2. **Place source images locally**
   - `web/public/media/tapes/{id}/cover.jpg`
   - `web/public/media/tapes/{id}/sides/a.jpg` *(if side images exist)*
   - `web/public/media/tapes/{id}/sides/b.jpg` *(if side images exist)*

// turbo
3. **Validate** — must pass before committing
   ```
   node web/scripts/validate-tapes.mjs
   ```

// turbo
4. **Run image optimization** (generates WebP variants — output is gitignored)
   ```
   node web/scripts/optimize-images.mjs
   ```

5. **Commit** — include `tapes.json` + source JPGs; optimized WebP files are gitignored and should not be committed

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
    "cover": "/media/tapes/{id}/cover.jpg"
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
