# 0016 — Comments Page

## Goal
Create a dedicated comments feed page to showcase recent community engagement and make comments discoverable beyond the ticker.

## Scope
Add `/comments` route displaying recent approved comments with pagination, filtering, and links back to tapes.

## Non-goals
- Comment moderation interface (already exists at `/admin/comments`)
- Real-time updates (page uses ISR like homepage)
- Threaded conversations or replies
- Comment search

---

## Users & primary flows

1. **Visitor clicks ticker "Comments:" label or link** → lands on `/comments`
2. **Visitor browses recent comments** → sees what people are saying
3. **Visitor clicks tape link** → jumps to that tape's detail page
4. **Visitor paginates** → browses older comments

---

## Route & metadata

**URL:** `/comments`

**Page title:** "Recent Comments - Simfonik"

**Description:** "Recent comments from the Simfonik mixtape archive community"

**Open Graph:** Use default site OG image

---

## Data & rendering

### Query
```sql
SELECT 
  id, tape_id, author_name, content, created_at
FROM comments 
WHERE approved = true 
ORDER BY created_at DESC
LIMIT {pageSize} OFFSET {offset}
```

Also fetch total count for pagination:
```sql
SELECT COUNT(*) FROM comments WHERE approved = true
```

### Enrichment
For each comment, enrich with tape data from `tapes.json`:
- `tape_title`
- `dj_names` (full list, comma-separated)
- `tape_year`
- `cover_image` (for thumbnail display)

### Pagination
- **Page size:** 30 comments per page
- **Default:** Page 1
- **URL format:** `/comments?page=2`
- Show "Previous" and "Next" buttons
- Display "Page X of Y" indicator

### Time formatting
- Same as ticker:
  - Under 1 min: `just now`
  - Under 1 hour: `5m ago`
  - Under 24 hours: `8h ago`
  - Under 7 days: `3d ago`
  - 7+ days: `Jan 21` (month + day)

---

## Layout & styling

### Page structure
```
[Header/Nav - reuse existing]

<main class="max-w-5xl mx-auto px-4 sm:px-6 py-8">
  <h1>Recent Comments</h1>
  <p class="text-muted">Latest thoughts from the Simfonik community</p>
  
  [Comment list - 30 per page]
  
  [Pagination controls]
</main>

[Footer - reuse existing]
```

### Comment card
Each comment displays as a card with:
- **Tape cover thumbnail** (left): 80x80px (64px on mobile) image
- **Tape link** (top): "DJ Names - Tape Title (year)" - bold, clickable, accent color on hover
- **Author & time** (meta): "Author Name · 8h ago" - smaller, muted, monospace font
- **Content preview**: First 200 characters with "..." if truncated (plain text, no formatting)
- **Visual:** Left border accent (4px purple), subtle hover state with transform

**Example:**
```
┌─────────────────────────────────────────────
│ [IMG] DJ Trance, R.A.W. - Wake Up LA (1993)
│       John Smith · 8h ago
│ 
│       This mix brings back memories of 
│       late nights at What?. Raw energy...
└─────────────────────────────────────────────
```

Cards slide slightly on hover (translate-x) and have subtle background on hover. Users click the entire card to navigate to the tape detail page.

### Responsive behavior
- Desktop: Single column, max-width 5xl
- Mobile: Full-width cards with padding
- Comfortable spacing between cards (4-6 spacing units)

---

## Integration with homepage

### Desktop ticker
Update `RecentCommentsTicker` component:
- Change "Comments:" label to **"Recent Comments →"** with arrow icon
- Make entire label clickable link to `/comments`
- Style with accent color and hover state (lighter accent on hover)
- Arrow animates right on hover (translate-x)
- Remove "View All" link (consolidated into main label)
- Hide ticker entirely on mobile

### Mobile floating action button (FAB)
Add new mobile-only navigation:
- **48x48px circular button** fixed to bottom-right (24px spacing from edges)
- Chat bubble icon (white, 20px)
- Accent color background with shadow
- Links to `/comments`
- Active scale animation (0.95) on tap
- Only visible on mobile (hidden on desktop)

---

## Revalidation
- **ISR:** `revalidate = 60` (same as homepage ticker)
- Comments up to 60s stale (acceptable)
- Page remains statically generated with pagination

---

## Implementation

### Files to create
- `app/comments/page.tsx` - Main comments feed page
- `components/CommentCard.tsx` - Individual comment display component (optional, can inline)

### Files to modify
- `components/RecentCommentsTicker.tsx` - Update to "Recent Comments →", hide on mobile
- `app/page.tsx` - Add mobile FAB for comments navigation
- `lib/comments.ts` - Add `getPaginatedComments(page, pageSize)` function

### Database query additions
```typescript
// New function in lib/comments.ts
export async function getPaginatedComments(
  page: number = 1,
  pageSize: number = 30
): Promise<{ comments: Comment[], total: number, totalPages: number }> {
  // Query approved comments with pagination
  // Return enriched comments + pagination metadata
}
```

---

## Acceptance criteria

**Functionality:**
- [x] `/comments` route displays recent approved comments (30 per page)
- [x] Comments show tape cover, tape link, author, timestamp, and content preview (200 chars)
- [x] DJ names show full list (comma-separated)
- [x] Time displays in relative format
- [x] Content truncates at 200 characters with "..." if longer
- [x] Pagination works (Previous/Next buttons with page numbers)
- [x] Page indicator shows current page and total pages
- [x] Desktop ticker "Recent Comments →" links to `/comments`
- [x] Mobile FAB (floating action button) links to `/comments`

**Styling:**
- [x] Matches site design language (purple accents, typography)
- [x] Left border accent (4px) on comment cards
- [x] Tape cover thumbnails (80x80px desktop, 64x64px mobile)
- [x] Hover effects (border color change, translate, background tint)
- [x] Comfortable spacing between comments (4 spacing units)
- [x] Mobile responsive with FAB for comments access
- [x] Clean preview text (single paragraph, no formatting)

**Performance:**
- [x] Page uses ISR (revalidate: 60)
- [x] No client-side data fetching for initial load
- [x] Pagination URLs are crawlable (?page=N)

**Edge cases:**
- [x] Shows empty state if no comments exist
- [x] Handles invalid page numbers gracefully (defaults to page 1)
- [x] Handles deleted tapes gracefully (filters out comments for missing tapes)

---

## Future enhancements (out of scope)

- Filter by DJ or year
- Search comments
- Sort options (newest/oldest)
- RSS feed of recent comments
- "Jump to comment" deep links from ticker
