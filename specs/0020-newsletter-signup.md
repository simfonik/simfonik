# 0020 — Newsletter Signup

## Goal
Start capturing subscribers so I can send updates on what's been added to the archive. I want a simple email form that feeds into Resend's Contacts/Segments system.

## Scope
Add a newsletter signup CTA to the site — a button in the header that opens a modal, plus an inline form in the footer. Subscribers are stored directly in Resend via their Contacts API — no database changes needed.

## Non-goals
- Sending the actual newsletter (separate effort once I have subscribers)
- Double opt-in / confirmation email (Resend doesn't have built-in support; could add later)
- Unsubscribe page (Resend handles this automatically in sent emails)
- Admin interface for managing subscribers (use Resend dashboard)

---

## Architecture

### Storage
Subscribers go directly into a Resend Segment via the Contacts API. The API is idempotent — re-subscribing the same email just updates the existing contact. No local database table needed.

### Environment variables
- `RESEND_API_KEY` — Resend API key (synced via Vercel integration)
- `RESEND_NEWSLETTER_SEGMENT_ID` — Target segment for newsletter subscribers

---

## API route

**POST `/api/newsletter`**

Accepts `{ email }` (and optionally `firstName`). Validates email server-side, then calls `resend.contacts.create()` with the segment ID.

Returns `{ success: true }` on success, or `{ error: "message" }` with appropriate status code on failure.

---

## Form component

`NewsletterSignup.tsx` — client component exporting:
- **`NewsletterModal`** — overlay modal with email input, triggered by the header button
- **`NewsletterFooter`** — inline email form in a dedicated footer section with tagline
- **`useNewsletterModal`** — hook for open/close state

States: idle, loading, success ("You're now subscribed!"), error (inline message with reserved space to prevent layout shift).

---

## Placement

### Header (`Header.tsx`)
- Desktop: "Newsletter" button in the nav bar (accent colored), opens modal
- Mobile: "Newsletter" button next to hamburger menu, opens modal

### Footer (`layout.tsx`)
- Dedicated section above the copyright bar with subtle accent background
- Includes tagline ("Get notified when new tapes drop.") and inline email form

---

## Files created
- `app/api/newsletter/route.ts`
- `components/NewsletterSignup.tsx`
- `specs/0020-newsletter-signup.md`

## Files modified
- `app/layout.tsx` — footer newsletter section
- `components/Header.tsx` — newsletter modal button + modal
- `package.json` — added `resend` dependency

---

## Acceptance criteria

**Functionality:**
- [x] Signup form collects email
- [x] Submitting creates a contact in the Resend segment
- [x] Re-submitting the same email doesn't error (idempotent)
- [x] Server-side validation rejects empty or invalid input
- [x] Form shows loading state during submission
- [x] Form shows success confirmation after subscribing
- [x] Form shows error message if something goes wrong

**Placement:**
- [x] Inline form appears in the site footer on every page
- [x] Newsletter button appears in the desktop header nav
- [x] Newsletter button appears on mobile (opens modal)

**Styling:**
- [x] Matches existing site design language
- [x] Responsive on mobile
- [x] Inputs use site's border, background, and accent colors
