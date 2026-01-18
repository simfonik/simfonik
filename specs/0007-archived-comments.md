# 0007 — Archived Comments from WordPress Site

## Goal
Display historical comments from the original simfonik.com WordPress site on corresponding tape detail pages. Preserve community history, track identifications, and Discogs links for reference.

## Non-goals
- New comment functionality (user submissions)
- Comment moderation tools
- Threaded/nested display (flatten all comments)
- User avatars or profiles
- Comment reactions or voting
- Real-time updates

## Users & primary flows
1) User visits tape detail page → scrolls to archived comments section → reads chronological history
2) User clicks Discogs link in comment → opens Discogs release page in new tab

## Data model

### Source data
WordPress SQL export → cleaned JSON with spam removed, filtered to published posts and approved comments only.

### Static data file: `web/data/tape-comments.json`
```json
{
  "tape-id": [
    {
      "author": "string",
      "date": "YYYY-MM-DD",
      "content": "string"
    }
  ]
}
```

### Comment processing rules
1. **Filtering:**
   - Only approved comments (`approved: "1"`)
   - Only from published posts (`post_status: "publish"`)

2. **Matching WordPress posts to tapes:**
   - Exact match: `post_name === tape.id`
   - Fuzzy match: Strip year/volume suffixes (`-YYYY`, `-vol-N`)
   - Manual mappings for known title variations

3. **Content processing:**
   - Keep: Discogs.com URLs (valuable for track IDs)
   - Strip: All other external links
   - Preserve: Line breaks, basic HTML entities
   - Date format: Extract date only (`YYYY-MM-DD`)

4. **Sorting:**
   - Chronological order, oldest first

## UI requirements

Add "Archived Comments" section after tracklists on tape detail page.

**Display:**
- Section header: "Archived Comments" with count
- Each comment: Author name (bold), date (muted), content (preserve line breaks)
- Visual distinction: Left border accent, slightly muted appearance
- Discogs links: Styled as links, open in new tab
- Empty state: Hide section if no comments

**Responsive:**
- Stack naturally on mobile
- Consistent spacing with other sections

## Matching statistics (baseline)
- Total tapes: 187
- WordPress posts matched: 86
- Archived comments: 1,088
- Unmatched posts: 126 (may include deleted/unreleased tapes)

## Technical approach

1. **Create matching script** (`scripts/match-wp-comments.mjs`):
   - Load WordPress export and `tapes.json`
   - Apply matching logic (exact + fuzzy + manual mappings)
   - Process comments (date format, link filtering, sort)
   - Output `data/tape-comments.json`

2. **Add TypeScript types** to `types/tape.ts`:
   ```typescript
   export type ArchivedComment = {
     author: string;
     date: string; // YYYY-MM-DD
     content: string;
   };
   ```

3. **Update data layer** (`lib/data.ts`):
   - Load comments JSON
   - Export `getCommentsForTape(tapeId): ArchivedComment[]`

4. **Update UI** (`app/tapes/[id]/page.tsx`):
   - Add archived comments section
   - Render conditionally if comments exist
   - Process Discogs links with `target="_blank"`

## Acceptance criteria
- [ ] `data/tape-comments.json` created with 1,088 comments for 86 tapes
- [ ] Matching script runnable and documented
- [ ] Comments display on tape pages with archived comments
- [ ] Comments sorted chronologically (oldest first)
- [ ] Author and date shown for each comment
- [ ] Discogs links preserved and functional (new tab)
- [ ] Non-Discogs links removed from content
- [ ] Section hidden for tapes without comments
- [ ] No runtime errors
- [ ] Responsive layout works on mobile and desktop

## Future considerations (out of scope)
- New comment submissions
