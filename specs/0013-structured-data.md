# 0013 — Structured Data

## Scope
Add JSON-LD structured data to tape pages, DJ pages, and homepage.

---

## Guardrails
- No design, layout, or URL changes
- JSON-LD for entity understanding only; no guaranteed Google rich results
- Absolute URLs for all URL fields
- Exactly one JSON-LD block per page
- Each side represented as MusicRecording with AudioObject
- Tracklist support optional; emit track/ItemList only when data exists
- Omit track entirely when tracks are absent
- Use first audio_link when multiple exist

---

## Schemas

### Tape pages (`/tapes/[id]`)

**Type:** `MusicPlaylist`

**Required fields:**
- `@context`: `https://schema.org`
- `@type`: `MusicPlaylist`
- `@id`: `https://simfonik.com/tapes/{tape.id}#playlist`
- `name`: `tape.title`
- `url`: `https://simfonik.com/tapes/{tape.id}`
- `mainEntityOfPage`: `https://simfonik.com/tapes/{tape.id}`
- `creator`: Array of Person objects (tape-level DJs)
  - With DJ page: `{ @type: "Person", @id: "https://simfonik.com/djs/{dj.slug}#person", name: dj.name, url: "https://simfonik.com/djs/{dj.slug}" }`
  - Unknown DJ: `{ @type: "Person", name: dj.name }` (no @id or url)
- `hasPart`: Array of MusicRecording objects (one per side)
  - `@type`: `MusicRecording`
  - `@id`: `https://simfonik.com/tapes/{tape.id}#side-{position}`
  - `name`: `"{tape.title} (Side {position})"`
  - `position`: Integer (1 for Side A, 2 for Side B, etc.)
  - `isPartOf`: `{ "@id": "https://simfonik.com/tapes/{tape.id}#playlist" }`
  - `byArtist`: Array of Person objects (side-level DJs, same format as tape-level)
  - `audio`: AudioObject
    - `@type`: `AudioObject`
    - `contentUrl`: Absolute audio file URL (from first audio_link)
    - `encodingFormat`: MIME type (`audio/mpeg` for .mp3)
  - `track` (optional): ItemList object
    - `@type`: `ItemList`
    - `itemListOrder`: `ItemListOrderAscending`
    - `numberOfItems`: Must equal itemListElement.length
    - `itemListElement`: ListItem array
      - `@type`: `ListItem`
      - `position`: 1-based integer
      - `item`: MusicRecording
        - `@type`: `MusicRecording`
        - `name`: `"{artist} - {title}"`

**Optional fields (when data exists):**
- `datePublished`: Year as string (`"1992"`) when available; omit if unknown
- `image`: Absolute URL to cover image
- `description`: Source or notes
- `genre`: Genre string

---

### DJ pages (`/djs/[slug]`)

**Type:** `Person`

**Required fields:**
- `@context`: `https://schema.org`
- `@type`: `Person`
- `@id`: `https://simfonik.com/djs/{dj.slug}#person`
- `name`: `dj.name`
- `url`: `https://simfonik.com/djs/{dj.slug}`
- `mainEntityOfPage`: `https://simfonik.com/djs/{dj.slug}`

**Optional fields:**
- `description`: Bio text
- `sameAs`: Array of absolute external URLs

---

### Homepage (`/`)

**Type:** `WebSite`

**Required fields:**
- `@context`: `https://schema.org`
- `@type`: `WebSite`
- `@id`: `https://simfonik.com#website`
- `name`: `simfonik`
- `url`: `https://simfonik.com`

---

## Implementation

### Files

**Component:**
`web/components/JsonLd.tsx`
- Props: `data: object`
- Renders one `<script type="application/ld+json">` using `JSON.stringify` and `dangerouslySetInnerHTML`

**Helpers:**
`web/lib/structured-data.ts`
- `generateTapeSchema(tape: Tape): object`
- `generateDJSchema(dj: DJ, bio?: string, links?: string[]): object`
- `generateWebsiteSchema(): object`

**Page integration:**
- `web/app/tapes/[id]/page.tsx`
- `web/app/djs/[slug]/page.tsx`
- `web/app/page.tsx`

Render `<JsonLd data={schema} />` near top of page component return. Do not render in layout.tsx.

---

## Validation

**Primary:** Schema Markup Validator (https://validator.schema.org/) – must show zero errors.

**Secondary:** Google Rich Results Test – informational only; "no items detected" is acceptable.

**Test:** Tape with tracklist, tape without tracklist, tape with unknown DJ, DJ with bio, DJ without bio, homepage.

---

## Acceptance criteria
- Tape pages emit valid MusicPlaylist JSON-LD with required fields and absolute URLs
- Each tape side emits as MusicRecording with AudioObject containing contentUrl
- DJ pages emit valid Person JSON-LD with required fields and absolute URLs
- Homepage emits valid WebSite JSON-LD with required fields and absolute URL
- Tracklists emit ItemList with ListItem structure when data exists (per-side)
- Person objects in creator/byArtist include @id when DJ page exists
- AudioObject encodingFormat matches actual file type (audio/mpeg for .mp3)
- Schema Markup Validator shows zero errors
- One JSON-LD block per page, no duplicates
- Server-side rendering only

---

## Notes

Google structured data gallery:
https://developers.google.com/search/docs/appearance/structured-data/search-gallery

Next.js JSON-LD guide:
https://nextjs.org/docs/app/guides/json-ld
