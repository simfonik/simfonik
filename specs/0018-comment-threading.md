# 0018 — Comment Threading

## Goal
Enable users to reply to specific comments while keeping visual hierarchy flat and easy to scan.

## Scope
- Reply to any comment (top-level or nested)
- All replies display at same indent level (no deep nesting)
- @mention shows who each reply is addressing
- Maintain existing moderation workflow

## Non-goals
- Multi-level visual nesting (reply to reply to reply...)
- Collapsible threads
- Real-time updates
- Notifications

---

## Implementation

### Database
- Added `parent_id` column to `comments` table (nullable, references `comments.id`)
- Index on `parent_id` for performance
- Migration: `web/migrations/add-comment-threading.sql`

### Display Logic
- Comments with `parent_id = null` are top-level
- All replies grouped under their root parent
- Same visual indent for all replies (no recursive nesting)
- Shows `@username` for immediate parent

### UI Features
- Reply button on all comments
- Inline reply form with parent context
- Reply count badge on parent comments
- Relative timestamps (5m ago, 3d ago, Feb 18)
- Hover for full date
- Subtle background tint on replies
- Mobile responsive spacing

### Admin
- Shows parent comment context when moderating replies
- Same approval workflow as top-level comments

---

## Acceptance criteria
- Users can reply to any comment
- All replies display at same indent level under root parent
- @mention clarifies who is being replied to
- Admin sees parent context during moderation
- Mobile friendly (reduced spacing/indent)
- No performance degradation with threaded comments
