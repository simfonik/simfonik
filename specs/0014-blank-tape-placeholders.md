# 0014 — Blank Tape Placeholders

## Goal
Generate unique, visually interesting placeholder images for tapes that have neither cover nor sides images. Placeholders should be deterministic (same tape = same pattern), performant (static assets), and visually distinct from real tape covers.

## Non-goals
- Runtime/client-side pattern generation
- Animation or interactive patterns
- User customization of patterns
- Generating placeholders for tapes that have ANY existing images

## Approach
Pre-generate static SVG files at build time using procedural pattern algorithms. Store as regular image assets served by CDN.

## Pattern Library
16 distinct optical illusion / mandala / kaleidoscopic patterns:
1. Radial checkerboard mandala
2. Rotating spiral
3. Starburst rays
4. Concentric circles
5. Twisted spiral arms
6. Polygon mandala
7. Warped grid
8. 3D tunnel
9. Flower mandala
10. Zigzag waves
11. Moiré interference
12. Fibonacci spiral
13. Hypnotic circles
14. Diamond tessellation
15. Rotating triangles
16. Wave interference

## Pattern Selection
- Seed: `hash(artistName::tapeTitle::year)`
- Pattern type: `seed % 16`
- Parameter variation: `Math.floor(seed / 16)`
- Ensures deterministic output and maximum variation across collection

## Visual Style
- Color: `#d4d4d8` (grayish white)
- Opacity: `50%`
- Background: Black (`#000000`)
- Canvas: Standard tape dimensions (373×233 viewBox)
- Display size: 90% scale (10% smaller than real covers)

## Build Integration
```bash
npm run generate-placeholders  # Standalone
npm run build                   # Auto-generates before Next.js build
```

### Generation Script (`scripts/generate-placeholders.mjs`)
- Input: `web/data/tapes.json`
- Filter: Tapes with NO `images.cover` AND NO `sides[].image`
- Output: `web/public/generated/placeholders/<tapeId>.svg`
- Logs: Count of generated vs skipped tapes

### Pattern Generator (`scripts/lib/pattern-generator.mjs`)
- Pure function: `generatePlaceholderSVG(artistName, tapeTitle, year) -> string`
- Seeded RNG for parameter randomization
- Self-contained (no external dependencies)

## Data Layer (`web/lib/data.ts`)
```typescript
function enrichTapeWithPlaceholder(tape: Tape): Tape {
  const hasCover = tape.images?.cover && tape.images.cover !== '/media/site/blank-tape.svg';
  const hasSides = tape.sides?.some(side => side.image);
  
  if (!hasCover && !hasSides) {
    return {
      ...tape,
      images: {
        ...tape.images,
        cover: `/generated/placeholders/${tape.id}.svg`,
      },
    };
  }
  return tape;
}
```
Applied in `getAllTapes()` and `getTapeById()`.

## UI Display
Placeholders render as standard images but at 90% scale via CSS:
```tsx
className={`... ${img.src.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
```

Applied to:
- Gallery cards (`TapeGalleryWithSearch.tsx`)
- Detail page main image (`TapeGallery.tsx`)
- Detail page thumbnails (`TapeGallery.tsx`)
- Mobile stacked images (`app/tapes/[id]/page.tsx`)

## File Structure
```
scripts/
  ├── generate-placeholders.mjs       # Build script
  ├── lib/pattern-generator.mjs       # Pattern algorithms
  └── README.md                       # Documentation

web/
  ├── public/generated/placeholders/  # Output (gitignored)
  └── .gitignore                      # + /public/generated/
```

## Acceptance Criteria
- [ ] Running `npm run generate-placeholders` creates SVG files for blank tapes
- [ ] Generated SVGs are deterministic (same input = same output)
- [ ] Each tape gets visually distinct pattern (no obvious collisions)
- [ ] Placeholders appear 10% smaller than real covers on all pages
- [ ] No runtime performance impact (static assets)
- [ ] Build succeeds with placeholders auto-generated
- [ ] Generated directory is gitignored (reproducible build)
- [ ] Script logs clear output (X generated, Y skipped)

## Performance Characteristics
- **File size**: 33-72 KB per SVG (acceptable)
- **HTML payload**: ~1 KB per placeholder (vs ~120 KB inline)
- **JS bundle**: 0 KB impact (vs +18 KB runtime generation)
- **DOM nodes**: ~30 per image (vs ~2,000 inline SVG)
- **Caching**: Perfect (static assets with content hashing)
- **Build time**: <1 second for typical collection
