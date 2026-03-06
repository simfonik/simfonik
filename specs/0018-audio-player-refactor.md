# 0018: Audio Player Refactor

## Background
The application currently features two distinct audio players: `AudioPlayer` (for single-track tapes) and `PlaylistPlayer` (for multi-side tapes). Over time, these components have accumulated duplicated state management, duplicate DOM event binding logic, and identical presentation markup. 

In addition, there are minor behavioral risks:
- Unused `requestAnimationFrame` references (`rafRef`).
- Potential play-event spamming to the `/api/track-play` endpoint when toggling play/pause rapidly.
- Mixed concerns (state, DOM interaction, UI markup, and domain logic all living in the same complex component).

## Goal
Extract the core audio logic to a reusable custom hook, abstract the shared UI into a pure presentation component, and reduce both `AudioPlayer` and `PlaylistPlayer` to simple coordinator components. The data/domain logic for "sides" or "tracks" remains entirely inside the coordinators.

## Technical Design

### 1. The Hook Layer (`useAudioPlayer`)
A new custom hook `useAudioPlayer` will be created in `web/hooks/useAudioPlayer.ts`.
- **Responsibilities:** Manages the `<audio>` element ref, binds `timeupdate`, `loadedmetadata`, `ended`, `error`, `play`, and `pause` events. Holds all playback state (`isPlaying`, `currentTime`, `duration`, `playbackRate`, `isLoading`, `error`). 
- **Tracking Demystified:** It will trigger `/api/track-play` exactly once per track load when playback first transitions from paused to playing. Successive play events for the same `src` will not fire the tracking API again.
- **Source Transitioning:** The hook resets source-specific transient state (`currentTime`, `error`, `isLoading`) when `src` changes, preserves `playbackRate` unless explicitly changed, and supports seamless handoff when the coordinator changes tracks.
- **AudioCoordinator Integration:** The hook is explicitly responsible for registering with `AudioCoordinator` to enforce single-stream playback (pausing itself if another player starts).
- **Inputs:** `src` (track URL) and an optional `onEnded` callback.
- **Outputs (State):** `ref` (to attach to the `<audio>` tag), `isPlaying`, `currentTime`, `duration`, `isLoading`, `error`.
- **Outputs (Controls):** Explicit imperatives: `play()`, `pause()`, `seek(time)`.

### 2. The Presentation Layer (`PlayerControls`)
A new pure UI component `PlayerControls` will be created in `web/components/PlayerControls.tsx`.
- **Responsibilities:** Renders the play/pause button, the loading spinner, the scrubber range input, and the time formatting.
- **Inputs:** Pure props driven entirely by the hook (`isPlaying`, `currentTime`, `duration`, `isLoading`, `onPlay`, `onPause`, `onSeek`).
- **Outputs:** None (stateless).

### 3. The Coordinator Layer
The existing components will be heavily simplified. Both coordinators render the actual `<audio>` tag and attach the hook `ref` to it.
- **`AudioPlayer`:** Calls `useAudioPlayer`, passes its controls down to `<PlayerControls>`. Knows nothing about playlists.
- **`PlaylistPlayer`:** Maintains the `currentTrackIndex` state, the track selection UI, and the auto-advance logic. It passes the active track URL to `useAudioPlayer` along with an `onEnded` callback that fires the track increment.

## Acceptance Criteria
- Track playback, pausing, and seeking behave identically to before.
- `PlaylistPlayer` successfully auto-advances to the next track upon completion without throwing `AbortError` or playing overlapping audio.
- The single-stream rule (only one player playing at a time) is maintained via the existing `AudioCoordinator`.
- No visual regressions to the player UI.
- `/api/track-play` fires exactly once per track load when playback first starts; repeat toggles do not re-fire the API.
