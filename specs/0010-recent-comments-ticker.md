# 0010 — Recent Comments Ticker

## Goal
Display recent comment activity on the homepage to show visitors the site has active engagement.

## Scope
Add a horizontal scrolling ticker between the hero image and tape grid showing the 10 most recent approved comments.

## Non-goals
- Real-time updates (use ISR instead)
- Client-side data fetching
- Showing comment content/previews
- Author names

---

## Placement
- Full-width bar between hero image and "Mixtapes" heading
- Above the fold on most screens

## Visual format
```
Comments: [DJ Names] - [Tape Title] (time) → | [DJ Names] - [Tape Title] (time) → | ...
```

**Example:**
```
Comments: DJ Trance - Wake Up LA (8h) → | Scott Hardkiss, Jon Williams, ... - Circa '92 (1d) → | ...
```

**Arrow icon:**
- Uses Heroicons `ArrowRightCircleIcon` (16/solid) at end of each comment
- Provides visual affordance for clickability

## Alignment
- Label "Comments:" fixed on left, aligned with page content (max-w-7xl)
- Comment items scroll horizontally
- Responsive padding: `px-4 sm:px-6`
- Responsive gap between label and content: `gap-4 sm:gap-6`

---

## Data & rendering

### Query
- Fetch 10 most recent approved comments from Postgres
- Order by `created_at DESC`
- Filter: `approved = true`

### Enrichment
Enrich each comment with tape data:
- `tape_title` from tapes.json
- `dj_names` from tape DJs (with truncation rule)

### DJ name truncation
- 1-2 DJs: Show all names, comma-separated
- 3+ DJs: Show first 2 + `...`
  - Example: `Scott Hardkiss, Jon Williams, ...`

### Time formatting
- Under 1 min: `just now`
- Under 1 hour: `5m ago`
- Under 24 hours: `8h ago`
- Under 7 days: `3d ago`
- 7+ days: `Jan 21` (month + day)

---

## Animation

### Desktop (≥640px)
- Auto-scroll horizontally, 60 second loop
- Duplicate comment list for seamless infinite scroll
- Pause animation on hover

### Mobile (<640px)
- Cycle through comments one at a time
- Fade transition between comments (200ms fade out, swap, 200ms fade in)
- Show each comment for 4 seconds
- Total cycle: ~40 seconds for 10 comments
- Long comments truncate with ellipsis (DJ/tape name only, time and arrow stay visible)
- Uses React state for cycling

### Accessibility
- Desktop: CSS-only animation
- Mobile: JavaScript-based cycling with fade transition
- Respect `prefers-reduced-motion` accessibility setting (disable all animations)

---

## Revalidation
- ISR: `revalidate = 60` (refresh every 60 seconds)
- Homepage remains statically generated
- Comments up to 60s stale (acceptable)

---

## Implementation

### Files created
- `lib/comments.ts` - `getRecentComments()` function
- `components/RecentCommentsTicker.tsx` - Ticker UI component

### Files modified
- `app/page.tsx` - Added ISR revalidate, fetch comments, render ticker

### Linking
Each comment is a clickable link to the tape detail page (`/tapes/[id]`).

### Dependencies
- `@heroicons/react` - For arrow icon

---

## Acceptance criteria
- Ticker appears between hero and tape grid
- Shows 10 most recent approved comments
- Long DJ lists truncate to 2 names + `...`
- Time displays in relative format (`8h ago`)
- Arrow icon appears after each comment
- Desktop: Scrolls continuously with seamless loop
- Desktop: Pauses when hovering
- Mobile: Cycles through comments with 200ms fade transitions
- Mobile: Long comment text truncates with ellipsis (time and arrow stay visible)
- Updates every 60 seconds via ISR
- "Comments:" label aligns with page content
- No ticker shown if zero comments exist
