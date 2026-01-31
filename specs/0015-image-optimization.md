# 0015 — Image Optimization

## Goal
Pre-optimize mixtape cover images at build time to eliminate Vercel Image Optimization costs and improve page load performance. Generate responsive WebP variants at multiple widths, treating optimized assets as derived output from original JPG sources.

## Non-goals
- Runtime/on-demand image optimization
- Retina (2x) variants
- AVIF format support (WebP only for simplicity)
- Optimizing images other than mixtape covers (e.g., DJ photos, site assets)

## Problem
- **Current state**: Using `next/image` with Vercel Image Optimization
- **Issue**: 300,000 cache reads/month (75% of free tier) from 488 tape covers
- **Cost trajectory**: Will exceed free tier with traffic growth
- **Root cause**: Runtime optimization generates multiple variants per request

## Approach
Pre-generate optimized WebP images at build time using `sharp`. Store as static assets organized by tape ID and width. Update components to use `next/image` with `unoptimized` prop pointing at pre-generated files.

## Output Specifications

### Widths
Generate 3 responsive variants per cover:
- **400w**: Mobile, gallery thumbnails
- **800w**: Tablet, desktop gallery
- **1200w**: Large desktop, detail pages

### Format & Quality
- **Format**: WebP only
- **Quality**: 85 (balance of size vs visual fidelity)
- **Color space**: sRGB

### Directory Structure
```
web/public/optimized/
  ├── <tape-id>/
  │   ├── 400.webp
  │   ├── 800.webp
  │   └── 1200.webp
  └── ...
```

Example:
```
public/optimized/
  ├── 1234/
  │   ├── 400.webp
  │   ├── 800.webp
  │   └── 1200.webp
```

## Build Integration

```bash
npm run optimize-images  # Standalone
npm run build            # Auto-runs optimization before Next.js build
```

### Generation Script (`scripts/optimize-images.mjs`)
- **Input**: `web/data/tapes.json` + `web/public/media/**/*.jpg`
- **Filter**: Only tapes with real cover images (skip placeholders)
- **Process**: 
  1. Read tape data
  2. For each tape with `images.cover` pointing to JPG
  3. Generate 400w, 800w, 1200w WebP variants
  4. Write to `public/optimized/<tapeId>/<width>.webp`
- **Output**: Organized by tape ID
- **Logging**: Summary of generated/skipped/failed images
- **Incremental**: Cache optimization results based on source file hash

### Caching Strategy
- Hash source JPG file contents (MD5 or similar)
- Store hash in `.optimization-cache.json`
- Skip regeneration if hash unchanged
- Dramatically speeds up incremental builds

## Data Layer (`web/lib/data.ts`)

Update `enrichTapeWithPlaceholder()` (or create new `enrichTapeWithOptimizedImage()`):

```typescript
function getOptimizedImagePath(tape: Tape, width: 400 | 800 | 1200): string {
  // Use optimized WebP if cover is a real JPG
  if (tape.images?.cover && 
      tape.images.cover.includes('/media/') && 
      tape.images.cover.endsWith('.jpg')) {
    return `/optimized/${tape.id}/${width}.webp`;
  }
  
  // Fallback to original (placeholders, SVGs, etc.)
  return tape.images?.cover || '';
}
```

Or add to tape enrichment:
```typescript
function enrichTapeWithOptimizedImages(tape: Tape): Tape {
  const hasCover = tape.images?.cover && 
                   tape.images.cover.includes('/media/') &&
                   tape.images.cover.endsWith('.jpg');
  
  if (hasCover) {
    return {
      ...tape,
      images: {
        ...tape.images,
        cover: `/optimized/${tape.id}/800.webp`,  // Default to 800w
        optimized: {
          small: `/optimized/${tape.id}/400.webp`,
          medium: `/optimized/${tape.id}/800.webp`,
          large: `/optimized/${tape.id}/1200.webp`,
        }
      },
    };
  }
  
  return tape;
}
```

## UI Updates

Use native `<img>` with `srcSet` for optimized covers, keep `next/image` for placeholders:

```tsx
{hasOptimizedImages(tape) ? (
  <img
    src={getOptimizedSrc(tape) || ''}
    srcSet={getOptimizedSrcSet(tape) || undefined}
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
    alt={`${tape.title} mixtape cover`}
    loading="lazy"
    className="w-full h-full object-contain"
  />
) : (
  <Image
    src={tape.coverImage}
    alt={`${tape.title} mixtape cover`}
    fill
    className={`object-contain ${tape.coverImage.includes('/generated/placeholders/') ? 'scale-90' : ''}`}
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  />
)}
```

### Components to Update
- `TapeGalleryWithSearch.tsx` (gallery cards)
- `TapeGallery.tsx` (detail page images)
- `app/tapes/[id]/page.tsx` (mobile stacked view)
- `app/page.tsx` (homepage if showing covers)
- `app/djs/[slug]/page.tsx` (DJ page if showing covers)

### Placeholder Handling
Keep existing placeholder logic intact:
```tsx
const isPlaceholder = tape.coverImage.includes('/generated/placeholders/');
const isOptimized = tape.coverImage.includes('/optimized/');

className={`object-contain ${isPlaceholder ? 'scale-90' : ''}`}
```

## File Structure
```
scripts/
  ├── optimize-images.mjs         # Build script
  └── lib/
      └── image-optimizer.mjs     # Sharp wrapper utilities

web/
  ├── .next/cache/
  │   └── image-optimization.json # Hash cache (gitignored with .next/)
  ├── .npmrc                      # pnpm Sharp config
  ├── public/
  │   ├── media/                  # Original JPGs (source of truth)
  │   └── optimized/              # Generated WebP (gitignored)
  └── .gitignore                  # + /public/optimized/
```

## Dependencies
Sharp is already in devDependencies. Add pnpm configuration:

**`web/.npmrc`:**
```
# Trust sharp for native binary installation
public-hoist-pattern[]=sharp
```

## Package.json Scripts
```json
{
  "scripts": {
    "optimize-images": "node scripts/optimize-images.mjs",
    "build": "npm run generate-placeholders && npm run optimize-images && next build"
  }
}
```

## Acceptance Criteria
- [x] Running `npm run optimize-images` generates WebP files for all tape covers
- [x] 3 widths generated per cover: 400w, 800w, 1200w
- [x] Output organized in `public/optimized/<tapeId>/<width>.webp`
- [x] Incremental builds use caching (only regenerate changed images)
- [x] Original JPGs remain untouched (source of truth)
- [x] Components render optimized images using `<img srcSet>`
- [x] Placeholder images (SVGs) continue to work with `next/image`
- [x] Native `<img>` still provides lazy loading and proper sizing
- [x] Gallery and detail pages load optimized images
- [x] Build script logs summary (X generated, Y cached, Z skipped)
- [x] `public/optimized/` is gitignored
- [ ] Vercel build succeeds with optimized images (pending deployment)
- [ ] Vercel Image Optimization cache reads drop to ~0 (pending monitoring)

## Performance Targets

### File Sizes (per tape, 3 variants)
- **400w WebP**: ~15-25 KB
- **800w WebP**: ~40-60 KB
- **1200w WebP**: ~80-120 KB
- **Total per tape**: ~150-200 KB (vs ~300-400 KB original JPGs)

### Build Time
- **Initial build**: 2-5 minutes (488 tapes × 3 variants = 1,464 files)
- **Incremental build**: <10 seconds (only changed images)
- **Cache hit rate**: >95% after initial build

### Runtime Impact
- **Vercel cache reads**: 300,000/month → <1,000/month (99.7% reduction)
- **Page load improvement**: 20-40% faster (no optimization latency)
- **Bandwidth savings**: 40-50% reduction vs original JPGs
- **CDN efficiency**: Perfect caching (static assets with immutable URLs)

## Migration Path
1. Add `sharp` dependency
2. Create `scripts/optimize-images.mjs`
3. Run script manually, verify output
4. Update data layer to use optimized paths
5. Update UI components one at a time
6. Test gallery + detail pages
7. Update `prebuild` script
8. Deploy to Vercel
9. Monitor image optimization metrics (should drop to near-zero)

## Future Enhancements (out of scope)
- AVIF format support (~30% smaller than WebP)
- Retina 2x variants for high-DPI displays
- Dynamic width selection based on viewport
- Blur placeholder generation for better UX
- Automated image quality analysis
