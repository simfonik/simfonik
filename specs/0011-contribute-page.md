# 0011 — Contribute Page

## Goal
Add a contribution form for users to submit information about mixtapes they'd like to share with the archive.

## Non-goals
- Audio file uploads or hosting
- User accounts or authentication
- Automated tape ingestion from submissions
- Real-time submission status tracking

## Users & primary flows
1) User wants to contribute mixtapes → navigates to `/contribute`
2) User fills out form (name, email, message) → submits
3) User sees success message → form submission emailed to contribute@simfonik.com

## Routes
- `/contribute` — contribution form page

## Technical approach

### 1. Form implementation
**`app/contribute/page.tsx`** — Server component page
- Page heading: "Contribute"
- Subheading: "Have old mixtapes from the 90s rave scene? We'd love to hear from you."
- Contains `<ContributeForm />` component

**`app/contribute/ContributeForm.tsx`** — Client component
- Fields:
  - Name (required, text input)
  - Email (required, email input)
  - Message (required, textarea, 8 rows)
- Label for textarea: "What would you like to contribute?"
- Placeholder: "Tell us about the mixtapes you have, DJ names, years, etc..."
- Submit button: "Send Message"
- Success message: "Thank you! Your message has been sent successfully."
- Error message: "Sorry, there was an error sending your message. Please try again."

### 2. Email delivery
- Use Web3Forms API for client-side form submission
- Public access key: `a13233a0-9133-44b1-9b22-b902329edcc9`
- POST to `https://api.web3forms.com/submit`
- Web3Forms forwards submissions to contribute@simfonik.com
- ImprovMX forwards contribute@simfonik.com to owner's personal email

### 3. Header navigation updates
**Desktop (md breakpoint and up):**
- Add "Contribute" button after "Browse DJs" and "About" links
- Style as filled button (accent color background, white text)

**Mobile (below md breakpoint):**
- Convert header to responsive hamburger menu
- "Contribute" button stays visible in header
- "Browse DJs" and "About" collapse into hamburger dropdown
- Layout: `[Logo] ... [Contribute] [☰]`
- Menu closes on:
  - Clicking any link
  - Clicking logo
  - Clicking outside header area

**`components/Header.tsx`** — Client component
- State management for mobile menu open/closed
- Uses Heroicons (Bars3Icon, XMarkIcon)
- Click-outside-to-close behavior with useEffect + ref

## UI requirements
- Form matches site styling (CSS variables for colors, borders)
- Mobile responsive (max-width container, proper spacing)
- Button hover states use `--accent-hover`
- Form validation (HTML5 required attributes)
- Loading state while submitting ("Sending...")
- Disabled state on submit button during submission

## Acceptance criteria
- [ ] `/contribute` page renders with form
- [ ] Form successfully submits to Web3Forms
- [ ] Success message appears after successful submission
- [ ] Error message appears if submission fails
- [ ] Form clears after successful submission
- [ ] "Contribute" button visible in desktop header navigation
- [ ] Mobile header shows hamburger menu with "Contribute" button exposed
- [ ] Mobile menu closes on navigation or click outside
- [ ] All links properly close mobile menu
- [ ] No console errors or warnings
