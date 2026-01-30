# 0013 — Structured Data

## Scope
Add JSON-LD structured data to tape pages, DJ pages, and homepage.

---

## Guardrails
- No design, layout, or URL changes
- JSON-LD for entity understanding only; no guaranteed Google rich results
- Absolute URLs for all URL fields
- Exactly one JSON-LD block per page
- Tracklist support optional; emit track/ItemList only when data exists
- Omit track entirely when tracks are absent

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
- `creator`: Array of Person objects
  - With DJ page: `{ @type: "Person", @id: "https://simfonik.com/djs/{dj.slug}#person", name: dj.name, url: "https://simfonik.com/djs/{dj.slug}" }`
  - Unknown DJ: `{ @type: "Person", name: dj.name }` (no @id or url)
- `datePublished`: Year as string (`"1992"`) when available; omit if unknown

**Optional fields (when data exists):**
- `image`: Absolute URL to cover image
- `description`: Source or notes
- `genre`: Genre string
- `track`: ItemList object
  - `@type`: `ItemList`
  - `itemListOrder`: `ItemListOrderAscending`
  - `numberOfItems`: Must equal itemListElement.length
  - `itemListElement`: ListItem array
    - `@type`: `ListItem`
    - `position`: 1-based integer
    - `item`: MusicRecording
      - `@type`: `MusicRecording`
      - `name`: `"{artist} - {title}"`
      - `byArtist`: Person or MusicGroup object (optional)

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
- `generateTapeSchema(tape: Tape, djs: DJ[], tracks?: Track[]): object`
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
- DJ pages emit valid Person JSON-LD with required fields and absolute URLs
- Homepage emits valid WebSite JSON-LD with required fields and absolute URL
- Tracklists emit ItemList with ListItem structure when data exists
- Person objects in creator include @id when DJ page exists
- Schema Markup Validator shows zero errors
- One JSON-LD block per page, no duplicates
- Server-side rendering only

---

## Notes

Google structured data gallery:
https://developers.google.com/search/docs/appearance/structured-data/search-gallery

Next.js JSON-LD guide:
https://nextjs.org/docs/app/guides/json-ld
