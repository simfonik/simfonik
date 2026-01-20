# 0008 — Custom Live Comments with Vercel Postgres

## Goal
Add live commenting to tape pages with full styling control, manual moderation, and spam protection. Scale from 100 to 2000 comments/month without architecture changes.

## Non-goals
- Real-time updates (comments load on page refresh)
- User accounts or authentication for commenters
- Threaded replies
- Email notifications to commenters
- Importing WordPress comments into database (remain in JSON)

## Users & primary flows
1) Visitor submits comment (name, optional email, content) → sees "pending approval" message
2) Owner visits `/admin/comments` → approves or deletes pending comments (paginated)
3) Visitor returns to tape → sees approved comment on next page load (no rebuild)

## Data model

### Postgres tables

```sql
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  tape_id VARCHAR(255) NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  author_email VARCHAR(255),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_tape_approved ON comments(tape_id, approved);
CREATE INDEX idx_created_at_desc ON comments(created_at DESC);

CREATE TABLE rate_limits (
  ip_hash VARCHAR(64) PRIMARY KEY,
  count INTEGER DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_reset_at ON rate_limits(reset_at);
```

**Cleanup job (run daily via cron or manually):**
```sql
DELETE FROM rate_limits WHERE reset_at < NOW();
```

## Technical approach

### 1. Database setup
Create Vercel Postgres database via dashboard, run migration SQL above.

### 2. API routes

**`app/api/comments/[tapeId]/route.ts`** - GET approved comments
- Query: `SELECT id, tape_id, author_name, content, created_at FROM comments WHERE tape_id = ? AND approved = true ORDER BY created_at ASC`
- Never expose author_email
- Return JSON array

**`app/api/comments/submit/route.ts`** - POST new comment
- **Rate limiting:** Fixed window (5 per IP per hour, SHA-256 hash IP)
  - IP parsing: Use first IP in x-forwarded-for (split by comma, trim). If missing, fall back to req.ip or "unknown"
  - If reset_at < NOW(): start new window (count=1, reset_at=NOW()+1 hour)
  - Otherwise: increment count only, do not change reset_at
  - Reject with 429 if count >= 5
- **Honeypot:** Reject with 400 if hidden `website` field is non-empty
- **Validation:** name 1-100 chars, content 10-5000 chars, trim whitespace, reject empty/whitespace-only
- **Insert:** Set approved=false, store optional email only if provided
- Return: `{success: true, message: "Comment pending approval"}`

**`app/api/admin/comments/route.ts`** - Admin actions
- **Auth:** HTTP Basic Auth (timing-safe password comparison using `crypto.timingSafeEqual`)
- **Password:** From ADMIN_PASSWORD env var, reject with 401 if invalid
- **GET:** List pending (WHERE approved=false ORDER BY created_at DESC), paginate 50/page, return total count
- **POST:** Accept {action: 'approve'|'delete', commentId: number}, update/delete, return {success: true}

### 3. Frontend components

**`components/CommentForm.tsx`** - Client component
- Fields: name (required), email (optional), content textarea (required)
- Hidden field: `website` (honeypot, empty by default, hidden via CSS)
- Character counter on textarea (max 5000)
- POST to `/api/comments/submit`
- Show "Comment pending approval" success message
- Match site styling (purple submit button)

**`components/LiveComments.tsx`** - Client component
- Fetch approved comments from `/api/comments/[tapeId]` on mount
- Show loading state while fetching
- Render with same styling as archived comments:
  - Left border accent
  - Author name (bold), date (muted), content (preserve newlines with whitespace-pre-wrap)
- **Content rendering:**
  - Render escaped text plus Discogs-only links
  - Implementation may use dangerouslySetInnerHTML only after escaping all HTML (&, <, >) and applying strict Discogs URL whitelist
  - Discogs links: `<a href="..." target="_blank" rel="nofollow noopener noreferrer">...</a>`

**`app/admin/comments/page.tsx`** - Protected by HTTP Basic Auth
- Browser prompts for password (native Basic Auth dialog)
- Fetch pending comments with pagination (50/page)
- Table columns: Author, Tape (link), Content preview (truncate to 100 chars), Date
- Actions per row: Approve button (green), Delete button (red)
- Pagination: Previous/Next buttons showing page X of Y
- Auto-refresh after approve/delete action

### 4. Update tape detail page

**`app/tapes/[id]/page.tsx`** (remains SSG)
- After tracklists, add new bordered section with:
  - "Leave a Comment" heading + `<CommentForm tapeId={id} />`
  - "Comments" heading + `<LiveComments tapeId={id} />`
- Followed by existing archived comments section (unchanged)
- Live comment components use `'use client'` directive, page stays server component

### 5. Environment setup
- Add `ADMIN_PASSWORD` to `.env.local` and Vercel environment variables
- Add `@vercel/postgres` package to handle database connections

## Acceptance criteria

**Security:**
- [ ] Rate limiting: 5 per IP per hour (persisted in rate_limits table, parses x-forwarded-for correctly)
- [ ] Honeypot field rejects bot submissions
- [ ] Admin auth uses timing-safe password comparison
- [ ] No email addresses exposed in public API responses
- [ ] Content rendering: HTML entities escaped before Discogs URL whitelist applied
- [ ] SQL queries use parameterized statements (prevent injection)

**Functionality:**
- [ ] Vercel Postgres database created with comments and rate_limits tables
- [ ] Users can submit comments (name required, email optional, content required)
- [ ] Submitted comments default to approved=false
- [ ] GET `/api/comments/[tapeId]` returns only approved comments
- [ ] Admin page protected by HTTP Basic Auth (browser prompt)
- [ ] Admin lists pending comments with pagination (50/page)
- [ ] Admin can approve or delete comments
- [ ] Approved comments appear immediately on next page load (no rebuild)

**UI/UX:**
- [ ] Comments preserve newlines (whitespace-pre-wrap)
- [ ] Styling matches archived comments exactly
- [ ] Character counter on textarea (5000 max)
- [ ] Success message after submission: "Comment pending approval"
- [ ] Mobile responsive
- [ ] Tape pages remain statically generated (SSG)
- [ ] No runtime errors or console warnings

## Scaling path (for 1000+ comments/month)

If traffic grows 10x, upgrade:
- **Rate limiting:** Upstash Redis for <10ms checks
- **Admin UX:** Bulk approve, search, filtering
- **Caching:** 5-min cache on approved comments
- **Monitoring:** Spam pattern logging

Current architecture scales without rewrites.

## Future considerations (out of scope)
- Email notifications to commenters
- Periodic JSON backup export
- Comment editing by authors
- Threaded replies
