pnp# 0017 — Custom Audio Player

## Goal
Replace native `<audio controls>` with a custom audio player UI that is consistent across browsers, especially iOS Safari. Keep site statically generated; player is a small client component.

## Scope
- Create `AudioPlayer.tsx` client component with custom UI
- Create `PlaylistPlayer.tsx` for tapes with multiple sides
- Wire to `<audio>` element (no controls) via ref and events
- Replace all `<audio controls>` usage in tape detail pages
- Support iOS Safari constraints (no autoplay, playsInline)
- Smart detection: 2+ sides → playlist player, 1 side → individual player

## Non-goals
- Audio player libraries (Plyr, Howler.js, etc.)
- State management libraries
- Custom volume UI (iOS doesn't support programmatic volume)
- Playback rate controls (removed for simplicity)
- Autoplay functionality
- Download buttons or advanced features
- Track duration display (would require pre-fetching all audio metadata)

---

## Problem
- **Current state**: Native `<audio controls>` elements
- **Issues**: Inconsistent UI across browsers, poor iOS Safari UX, touch targets too small, no design control

---

## Approach
Build minimal custom player wrapping unstyled `<audio preload="metadata" playsInline>`. Wire custom UI to HTMLAudioElement via refs. Use `timeupdate` event (~4 updates/sec) for progress updates to avoid excessive re-renders.

### Constraints
- No external libraries, minimal JS
- iOS: no autoplay; play() from user gesture only
- Accessibility: ARIA labels, keyboard support, focus styles, 44px+ touch targets

---

## UI Specifications

### AudioPlayer (single side)
**Layout:** Compact player with tighter padding

**Controls:**
- Play/Pause button (44×44px circular)
- Time scrubber (10px height, 20px thumb for better mobile tap)
- Current time / duration (H:MM:SS format)
- Shows `--:--:--` while metadata loads

**Styling:**
- `p-2.5` padding (reduced from initial design)
- Match existing design system (CSS variables)
- Visible focus rings for keyboard navigation
- Pointer cursor on interactive elements

### PlaylistPlayer (2+ sides)
**Same player as above, plus:**
- Compact track list below player
- Click any track to play immediately
- Active track highlighted with purple background (20% opacity)
- 44px touch targets for mobile
- Play/pause icons inline with track names
- Auto-advances to next track when one ends

---

## Implementation

### Files to create
- `web/components/AudioPlayer.tsx` - Custom player for single-side tapes
- `web/components/PlaylistPlayer.tsx` - Custom player with track list for multi-side tapes

### Files to modify
- `web/app/tapes/[id]/page.tsx` - Replace `<audio controls>` with smart player detection
- `web/app/globals.css` - Add `--bg-secondary` and `--bg-hover` CSS variables

### Component structure
```typescript
// AudioPlayer.tsx
'use client';

interface AudioPlayerProps {
  src: string;
  title?: string;
}

// State: isPlaying, currentTime, duration, isLoading, error
// Events: loadedmetadata, play, pause, ended, timeupdate, seeking, error
// Progress: timeupdate event (~4x/sec, no RAF)

// PlaylistPlayer.tsx
'use client';

interface Track {
  title: string;
  url: string;
  position: string;
}

interface PlaylistPlayerProps {
  tracks: Track[];
}

// State: currentTrackIndex, isPlaying, currentTime, duration, isLoading, error
// Track selection: Click to play, auto-advance on ended
// Same audio events as AudioPlayer
```

### Audio element config
```tsx
<audio ref={audioRef} src={src} preload="metadata" playsInline />
```

### Integration point
Replace in `app/tapes/[id]/page.tsx`:

**Smart detection:**
```tsx
const playlist = tape.sides
  .filter(side => side.audio_links[0] && isStreamable(side.audio_links[0].url))
  .map(side => ({
    title: side.title ?? `Side ${side.position}`,
    url: side.audio_links[0].url,
    position: side.position,
    djs: side.djs
  }));

if (playlist.length >= 2) {
  return <PlaylistPlayer tracks={playlist} />;
}

// Individual players for 1 side
return (
  <AudioPlayer 
    src={playlist[0].url}
    title={playlist[0].title}
  />
);
```

### AudioCoordinator compatibility
Existing coordinator listens for `play` events on all `<audio>` elements. Custom player uses native `<audio>` internally, so coordinator continues working without changes.

---

## Acceptance Criteria

**Functionality:**
- [x] Custom player replaces all `<audio controls>` in codebase
- [x] Play/Pause button toggles playback
- [x] Scrubber seeks accurately and updates smoothly (timeupdate events)
- [x] Time displays (H:MM:SS format) update ~4x per second
- [x] Playlist player for 2+ sides with click-to-play tracks
- [x] Auto-advance to next track when one ends
- [x] iOS Safari: play() works from tap, playsInline prevents fullscreen
- [x] AudioCoordinator pauses other players when one plays
- [x] Zero `<audio controls>` remain (verify with grep)
- [x] Metadata cache handling (readyState check for refresh scenarios)

**Accessibility:**
- [x] All buttons have descriptive ARIA labels
- [x] Scrubber has ARIA label
- [x] Keyboard navigation works (Space/Enter, arrows on scrubber)
- [x] Visible focus styles on all interactive elements
- [x] Touch targets ≥44px
- [x] Pointer cursor on interactive elements

**Performance:**
- [x] Site remains statically generated
- [x] Bundle size <5KB gzipped (no external libraries)
- [x] timeupdate events (~4x/sec) instead of RAF (60x/sec)
- [x] No stuttering during playback
- [x] No excessive re-renders

---

## Testing

### Desktop (Chrome, Firefox, Safari)
- [ ] Play/pause, seek, rate change all work
- [ ] Multiple players: only one plays at a time
- [ ] Keyboard navigation functional

### iOS Safari
- [ ] First play works from tap (no autoplay error)
- [ ] Stays inline (no fullscreen hijack)
- [ ] Touch targets easy to tap
- [ ] Scrubber works with touch

### Build verification
```bash
pnpm tsc --noEmit   # No TypeScript errors
pnpm build          # Build succeeds
grep -r '<audio.*controls' web/  # No matches
```

---

## Future Enhancements (Out of Scope)
- Volume control (desktop only, iOS doesn't support it)
- Waveform visualization (considered but adds complexity)
- Keyboard shortcuts (J/K for skip, L for rate)
- Resume position (localStorage)
- Track duration pre-fetching (would require loading all audio metadata)
- Playback rate controls (intentionally removed for simpler UX)
