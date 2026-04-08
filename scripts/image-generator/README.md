# Metadata-Driven Image Generator

Generates unique abstract featured images for blog articles using their own metadata as creative input. Each article's title seeds a Perlin noise flow field, its categories determine the color palette, and its word count controls the density of particle trails. The result is a deterministic 1200x630 PNG — the same article always produces the same image — that gets uploaded to the Umbraco media library and assigned as the article's featured image.

## How It Works

Article metadata flows through a pipeline:

```
title  ──→  flow field seed (Perlin noise pattern)
node ID ──→  particle spawn positions
word count → particle count & trail length
categories → color palette
```

Particles are spawned across the canvas and "walk" through the flow field, leaving colored trails. The output is rendered to a dark background (#0F141E) PNG via `@napi-rs/canvas`.

**Category palette mapping** is stored in the Umbraco CMS as a content document (**Home → Site Settings → Image Generator Settings**). Each category has a Block List entry with three Eye Dropper color properties (primary, mid, deep). Default fallback colors are also stored in the settings document.

The CLI reads palettes via a priority chain:
1. `--palette-json <json>` argument (used by the C# controller)
2. `--palette-from-api` flag (fetches from the CMS Management API)
3. `config/palettes.json` file (static fallback/reference)
4. Hardcoded defaults

## Prerequisites

1. **Umbraco running locally** at the URL in your `.env` (default `https://localhost:44367`)
2. **`.env` file** at the repo root with API credentials:
   ```
   UMBRACO_BASE_URL=https://localhost:44367
   UMBRACO_CLIENT_ID=your-client-id
   UMBRACO_CLIENT_SECRET=your-client-secret
   ```
3. **Dependencies installed**: `npm install` from the repo root

## Usage

All commands use `npx tsx` to run TypeScript directly. If `node` isn't on your PATH (nvm users), prefix with:
```bash
PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH"
```

### Generate for a single article (by name)

Finds the article by partial name match, generates the image, uploads it to the media library, and assigns it as the article's Main Image:

```bash
npx tsx scripts/image-generator/src/cli.ts --name "Retaining Humanity"
```

### Generate for a single article (by document ID)

```bash
npx tsx scripts/image-generator/src/cli.ts --id "550e8400-e29b-41d4-a716-446655440000"
```

### Batch mode — all articles missing a featured image

```bash
npx tsx scripts/image-generator/src/cli.ts --batch
```

Skips articles that already have a Main Image set. To regenerate everything:

```bash
npx tsx scripts/image-generator/src/cli.ts --batch --force
```

### Use CMS palette settings

Fetch palette colors from the Image Generator Settings content node:

```bash
npx tsx scripts/image-generator/src/cli.ts --name "Retaining Humanity" --palette-from-api
```

### Preview locally (no upload)

Save the PNG to disk without touching the CMS:

```bash
npx tsx scripts/image-generator/src/cli.ts --name "Retaining Humanity" --local-only --output ./preview.png
```

If `--output` is omitted, defaults to `./generated-<article-name>.png`.

## What Happens in the CMS

- Images are uploaded to a **"Generated Images"** folder in the media library (created automatically if it doesn't exist)
- Each image is assigned to the article's `mainImage` property (MediaPicker3 format)
- The article is saved as a **draft** — it is not auto-published

## Running Tests

**Unit tests** (no Umbraco required):
```bash
npx tsx --test tests/image-generator/seed.test.ts tests/image-generator/palette.test.ts tests/image-generator/word-count.test.ts tests/image-generator/flow-field.test.ts tests/image-generator/renderer.test.ts tests/image-generator/generator.test.ts
```

**Integration test** (requires running Umbraco):
```bash
npx tsx --test tests/image-generator/integration.test.ts
```

## Architecture

```
scripts/image-generator/src/
├── types.ts          # Shared interfaces (ArticleMetadata, Palette, PaletteConfig, etc.)
├── seed.ts           # String-to-seed hash + seedable PRNG (Mulberry32)
├── palette.ts        # Category → color palette mapping + particle params
├── palette-reader.ts # Reads palette config from CMS settings document (Management API)
├── word-count.ts     # Extract word count from HTML / Tiptap JSON
├── noise.ts          # Perlin noise (ported from Python reference)
├── flow-field.ts     # Flow field generation + particle simulation
├── renderer.ts       # Canvas rendering → PNG buffer
├── generator.ts      # Orchestrator: metadata → PNG (pure, no I/O)
├── umbraco-api.ts    # Umbraco Management API: auth, fetch, upload, assign
└── cli.ts            # CLI entry point
```

The core generator (`generator.ts`) is a pure function with no side effects — it takes metadata in, returns a PNG buffer. The Umbraco API layer and CLI are separate, making the generator reusable for future backoffice integration.
