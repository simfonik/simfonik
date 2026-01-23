# 0005 — Client-Side Search (Tape & DJ Filtering)

## Goal
Add instant client-side search to the home page that filters the tape grid by DJ name or tape title as the user types.

## Scope
- Add a search input field on the home page (`/`)
- Position search input on the same line as the "Mixtapes" heading
- Search box width should match one tape card width (~1/3 on large screens)
- Filter tapes in real-time based on:
  - Tape title (case-insensitive substring match with punctuation normalization)
  - DJ name (case-insensitive substring match with punctuation normalization)
  - Normalization strips periods, dashes, and spaces before comparison (e.g., "raw" matches "R.A.W.")
- Show all tapes when search input is empty
- Display a "No results" message when search returns zero matches
- Keep the site 100% static (no server-side search, no API calls)

## Non-goals
- Fuzzy search or typo tolerance (can be added later with Fuse.js)
- Advanced filters (by year, genre, etc.)
- Facets or filter UI components
- Search history or suggestions
- Separate `/search` route
- Searching track names or side titles
- URL query parameters for search state

## Implementation approach
- Extract tape grid from `app/page.tsx` into a new client component (`TapeGalleryWithSearch.tsx`)
- Keep hero section and page layout server-rendered
- Pass enriched tape data (with cover images) from server component to client component
- Client component manages search state and filters the tape array on every keystroke
- Reuse existing tape card styling and structure

## Acceptance criteria
- Search input appears on home page header row, aligned with "Mixtapes" heading
- Typing "Mark" shows tapes by "Mark E Quark" and "Mark Farina"
- Typing partial tape titles filters correctly (e.g., "live at" shows all "Live at..." tapes)
- Search is case-insensitive
- Empty search shows all tapes (default state)
- Clearing search instantly restores full tape grid
- Build still produces fully static HTML (no SSR routes added)
- `pnpm build` succeeds and shows home page as static (`○`)
- `pnpm lint` passes

## Implementation plan
1) Create `web/components/TapeGalleryWithSearch.tsx`:
   - Mark as `'use client'`
   - Accept `tapes` prop (with pre-computed cover images)
   - Add `useState` for search query
   - Implement filter logic for title and DJ name
   - Add normalization helper that strips periods, dashes, and spaces for matching
   - Render search input + filtered tape grid
   - Show "No results" message when `filteredTapes.length === 0`

2) Update `web/app/page.tsx`:
   - Import new component
   - Prepare tape data with cover images using `getCoverImageWithFallback()`
   - Pass enriched data to `<TapeGalleryWithSearch />`
   - Keep hero section server-rendered

3) Style the search input:
   - Use existing CSS variables (`--border`, `--surface`, `--accent`, etc.)
   - Match focus states and transitions with existing form elements
   - Placeholder text: "Search by DJ or Mix Title"

4) Test:
   - Verify search filters correctly
   - Verify build remains static
   - Check responsive layout on mobile

5) Commit changes
