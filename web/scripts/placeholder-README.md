# Placeholder Generation Scripts

## Overview

Generates unique, deterministic SVG patterns for tapes missing both cover and sides images.

## Usage

### Generate Placeholders

```bash
npm run generate-placeholders
```

This will:
1. Scan `web/data/tapes.json` for tapes without cover or sides images
2. Generate unique optical illusion/mandala patterns based on artist, title, and year
3. Output SVG files to `web/public/generated/placeholders/<tapeId>.svg`

### Build Integration

Placeholders are automatically generated before each build:

```bash
npm run build  # Runs generate-placeholders then next build
```

### Manual Testing

```bash
node scripts/generate-placeholders.mjs
```

## How It Works

### Pattern Generation

- **Deterministic**: Same artist/title/year always produces the same pattern
- **Seeded RNG**: Hash of `"${artist}::${title}::${year}"` seeds the random number generator
- **8 Pattern Types**:
  1. Radial checkerboard mandala
  2. Rotating spiral
  3. Starburst rays
  4. Concentric circles
  5. Twisted spiral arms
  6. Polygon mandala (5-16 sides)
  7. Warped grid
  8. 3D tunnel perspective

### Visual Style

- **Color**: Grayish white (#d4d4d8) at 80% opacity
- **Background**: Black
- **Label area**: 337×161px with 18px margins
- **Elements**: 30-70 per pattern (optimized for performance)

### Data Layer Integration

The `enrichTapeWithPlaceholder()` function in `web/lib/data.ts` automatically:
- Checks if tape is missing both cover and sides images
- Injects `/generated/placeholders/<tapeId>.svg` as the cover path
- Happens at data load time (zero runtime cost)

## File Structure

```
scripts/
  ├── generate-placeholders.mjs       # Main generation script
  ├── lib/
  │   └── pattern-generator.mjs       # Pattern generation logic
  └── README.md                       # This file

web/
  └── public/
      └── generated/
          └── placeholders/           # Generated SVG files (gitignored)
              ├── <tapeId>.svg
              └── ...
```

## Regenerating Placeholders

Run the generation script when:
- Adding new tapes without images
- Changing pattern algorithms
- Updating visual style

The output is gitignored but deterministic, so anyone can regenerate identical files.
