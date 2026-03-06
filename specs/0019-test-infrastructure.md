# 0019: Audio Player Test Infrastructure

## Objective
Introduce frontend unit testing infrastructure to verify the core logic of the `useAudioPlayer` hook, specifically ensuring its resilience against duplicate `/api/track-play` calls and race conditions during source transitions, as well as verifying high-level integration with the `PlaylistPlayer`.

## Context
The project currently lacks a frontend test runner. Following the 0018 Audio Player refactor, the complex DOM media interactions and API tracking deduplication logic are now isolated within `web/hooks/useAudioPlayer.ts`, while playlist state management remains in `web/components/PlaylistPlayer.tsx`. To prevent behavioral regressions, we need to establish a testing baseline.

## Proposed Stack
- **Test Runner:** Vitest (Native ESM support, incredibly fast, drop-in Jest replacement).
- **Environment:** jsdom (Provides a mock browser environment for React testing).
- **Libraries:** `@testing-library/react` and `@testing-library/user-event` (Standard for React hook and component testing).

## Testing Strategy
Because Node/jsdom does not implement the HTML5 `<audio>` element natively, we will need to create a robust mock for `HTMLAudioElement.prototype`. This mock must simulate `play()`, `pause()`, rejected promises on `play()`, and dispatched events (`loadedmetadata`, `timeupdate`, `ended`, `error`).

The test suite will focus strictly on the `useAudioPlayer` hook's state and transport behavior, followed by one focused integration test on `PlaylistPlayer` to verify coordinator auto-advance behavior.

### Acceptance Criteria
1. **Vitest Installation:** `vitest`, `jsdom`, `@testing-library/react`, and `@testing-library/user-event` are installed and configured via `vitest.config.ts`.
2. **`package.json` Updates:** A new `npm run test` script is available to run unit tests locally and in CI.
3. **`useAudioPlayer` Test Suite (`useAudioPlayer.test.tsx`):**
    - Verifies that `play()`, `pause()`, and `seek()` correctly update the internal hook state.
    - **Anti-Spam Verification:** Verifies that the `/api/track-play` endpoint is called exactly once per track load when playback first transitions from paused to playing (matching 0018 phrasing).
    - **Source Transition Verification:** Verifies that changing the `src` prop correctly resets `currentTime` and `error` states without interrupting explicit auto-play intent, successfully swallowing `AbortError` promise rejections.
    - **Cleanup Verification:** Verifies that event listeners are correctly removed on unmount and source changes to prevent memory leaks.
4. **`PlaylistPlayer` Integration Test (`PlaylistPlayer.test.tsx`):**
    - Verifies that when an active track finishes (the `ended` event fires), the playlist successfully auto-advances to the next track and triggers playback.
