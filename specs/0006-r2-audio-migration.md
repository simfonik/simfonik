# 0006 — Migrate Audio from Dropbox to Cloudflare R2

## Goal
Move all mixtape audio files from Dropbox share links to Cloudflare R2 for better reliability, performance, zero egress costs, and full control over audio hosting.

## Scope
- Create Cloudflare R2 bucket for audio storage
- Define consistent file naming convention based on `tape.id` and `side.position`
- Build migration scripts to extract Dropbox URLs and generate upload manifests
- Upload all audio files to R2 (~9GB currently)
- Update all `side.audio_links[].url` in `tapes.json` to point to R2 URLs
- Update validator to check R2 URL format and warn on remaining Dropbox URLs
- Keep Dropbox links as backup during migration validation period

## Non-goals
- Signed URLs or authentication (public bucket for v1; can add later if needed)
- Play tracking or analytics (separate spec)
- Image migration (images already in repo under `web/public/media/tapes/`)
- CDN configuration beyond R2's default
- Custom domain setup (can use default R2 public URL for now)
- Audio transcoding or normalization

## R2 bucket structure

All audio files organized by tape ID:

```
simfonik-audio/
  tapes/
    <tape-id>/
      <side-position>.mp3
```

Examples:
- `tapes/dj-trance-raw-wake-up-la/a.mp3`
- `tapes/dj-trance-raw-wake-up-la/b.mp3`
- `tapes/aldo-bender-happy-wednesdays/a.mp3`
- `tapes/dj-e-quest-volume-8/1a.mp3`
- `tapes/dj-e-quest-volume-8/1b.mp3`

Naming rules:
- `<tape-id>`: canonical `tape.id` from `tapes.json`
- `<side-position>`: R2 filename is mechanically derived as `side.position.toLowerCase() + '.mp3'`
  - Examples: `A` → `a.mp3`, `1A` → `1a.mp3`, `H` → `h.mp3`
- File extension: keep original (usually `.mp3`)

Side position rules:
- `side.position` is stored uppercase in `tapes.json` and must match `^([A-Z]|[1-9][0-9]*[A-Z])$`
- Valid formats: single letter (`A`-`Z`) or multi-cassette (`1A`, `2B`, etc.)
- Descriptive labels (e.g., "Heart Side", "Blue Side") belong in `side.title`, not `side.position`

Public URL format:
```
https://pub-<bucket-id>.r2.dev/tapes/<tape-id>/<side-position>.mp3
```

## Migration approach

**Phase 1: Generate manifest**
- Script extracts all Dropbox URLs from `tapes.json`
- Creates mapping file: tape ID, side position, Dropbox URL, target R2 path
- Outputs `scripts/r2-migration-manifest.json`

**Phase 2: Upload (manual)**
- Create R2 bucket via Cloudflare dashboard
- Enable public access
- Upload files using `rclone` or `wrangler` CLI with manifest as guide
- Verify uploads accessible via public URLs

**Phase 3: Update URLs**
- Script updates `tapes.json` with R2 URLs (creates backup first)
- Test locally that audio streams correctly
- Commit updated `tapes.json`

**Phase 4: Validation**
- Update validator to check R2 URL format
- Deploy to production
- Monitor for playback issues
- After 1-2 weeks, optionally remove Dropbox backup links

## Acceptance criteria
- R2 bucket created with ~9GB of audio files organized by tape ID
- All `side.audio_links[].url` in `tapes.json` point to R2
- Migration script generates manifest mapping Dropbox → R2 paths
- Update script replaces URLs in `tapes.json` and creates backup
- Validator checks R2 URL format and warns on Dropbox URLs
- Local dev server plays audio from R2 without errors
- Production deployment plays audio from R2 without errors
- At least 5 tapes manually tested for playback
- `npm run validate` passes with no errors

## Implementation plan
1) Create `web/scripts/generate-r2-manifest.mjs`:
   - Read `tapes.json`
   - Extract all Dropbox URLs with metadata (tape ID, side position)
   - Generate manifest: `{ tapeId, sidePosition, dropboxUrl, r2Path }`
   - Save to `web/scripts/r2-migration-manifest.json`

2) Create R2 bucket (manual):
   - Sign up for Cloudflare account if needed
   - Create R2 bucket named `simfonik-audio`
   - Configure public access
   - Note public URL pattern

3) Upload files to R2 (manual):
   - Use manifest to guide upload
   - Upload via `rclone` or `wrangler` CLI
   - Verify sample files accessible

4) Create `web/scripts/update-r2-urls.mjs`:
   - Read manifest and `tapes.json`
   - Replace Dropbox URLs with R2 URLs
   - Create backup: `tapes.json.backup-pre-r2`
   - Write updated `tapes.json`

5) Update `web/scripts/validate-tapes.mjs`:
   - Add R2 URL pattern check (must match bucket structure)
   - Add warning for remaining Dropbox URLs
   - Ensure validator recognizes R2 URLs as valid

6) Test and deploy:
   - Run `npm run validate`
   - Test locally (`npm run dev`)
   - Verify audio playback on multiple tapes
   - Commit changes
   - Deploy to Vercel
   - Monitor production for issues

7) Add documentation:
   - Update `web/README.md` with R2 bucket info
   - Document process for uploading audio for new tapes
