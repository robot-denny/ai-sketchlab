# Plan: Metadata-Driven Image Generator

**Spec**: `_specs/shipped/image-generator/image-generator.md`
**Branch**: `claude/feature/metadata-image-generator`

## Context

Articles need unique featured images derived from their metadata. Rather than stock photos or AI-generated art, each image is a deterministic abstract flow field pattern seeded by the article's title, node ID, word count, and categories. The Python reference at `_specs/shipped/image-generator/flow_field_generator.py` provides the algorithm to port. Images are generated via CLI, uploaded to the Umbraco media library, and assigned as the article's `mainImage`.

---

## Key Decisions

- **Language**: TypeScript (ESM) — matches existing project stack; future backoffice integration will also be TS/Lit
- **Image library**: `@napi-rs/canvas` — Canvas 2D API (same as `node-canvas` but ships pre-built binaries, zero system dependencies)
- **Noise implementation**: Port `SimpleNoise` from Python reference directly (avoids external dependency, ensures determinism)
- **Seedable PRNG**: Mulberry32 (~6 lines) since `Math.random()` is not seedable
- **Performance**: Coarse grid (4px resolution) with bilinear interpolation for flow field — reduces noise evaluations from 756K to 47K
- **Test runner**: `tsx` with Node's built-in `node:test` module (lightweight, no additional framework)
- **Architecture**: 3 layers per spec's future roadmap — core generator (pure functions) / Umbraco API integration / CLI entry point
- **Property alias**: `mainImage` (confirmed from `mainImageControls` composition, MediaPicker3 format)
- **Node ID seeding**: Umbraco uses UUIDs not integers — derive integer seed via `stringToSeed(uuid)` same as title
- **Media folder**: Dedicated "Generated Images" folder in media library
- **Source location**: `scripts/image-generator/` — un-gitignore this specific path (the generator is a permanent project tool, not a throwaway script)

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading is a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Install dependencies and scaffold project structure

> **Prompt**: Implement Step 1 of `_plans/shipped/image-generator.md`. Install dependencies, un-gitignore the image generator path, create the directory structure and shared type definitions. Run `npm install` to verify.

**What to build**:

1. Install dev dependencies:
   ```bash
   npm install --save-dev @napi-rs/canvas tsx
   ```

2. Add scripts to `package.json`:
   ```json
   "test:unit": "tsx --test tests/image-generator/**/*.test.ts",
   "generate:images": "tsx scripts/image-generator/src/cli.ts"
   ```

3. Un-gitignore the image generator in `.gitignore`:
   ```
   # Local utility scripts (except image generator which is version-controlled)
   scripts/
   !scripts/image-generator/
   ```

4. Create `scripts/image-generator/src/types.ts` with shared interfaces:
   ```typescript
   export interface ArticleMetadata {
     id: string;           // Umbraco document UUID
     name: string;         // Document name
     title: string;        // Display title (from headerControls)
     wordCount: number;    // Derived from contentRows block list
     categories: string[]; // Resolved category names
   }

   export type RGBColor = [number, number, number];
   export type Palette = RGBColor[];

   export interface Particle {
     x: number;
     y: number;
     history: Array<[number, number]>;
     alive: boolean;
   }

   export interface GeneratorOptions {
     width?: number;       // Default: 1200
     height?: number;      // Default: 630
     gridScale?: number;   // Default: 4 (coarse grid resolution)
     octaves?: number;     // Default: 4
     lineWidth?: number;   // Default: 2.0
     alpha?: number;       // Default: 160
     background?: RGBColor; // Default: [15, 20, 30] (#0F141E)
   }
   ```

5. Create empty placeholder files for all modules (will be implemented in subsequent steps):
   - `scripts/image-generator/src/seed.ts`
   - `scripts/image-generator/src/palette.ts`
   - `scripts/image-generator/src/word-count.ts`
   - `scripts/image-generator/src/noise.ts`
   - `scripts/image-generator/src/flow-field.ts`
   - `scripts/image-generator/src/renderer.ts`
   - `scripts/image-generator/src/generator.ts`
   - `scripts/image-generator/src/umbraco-api.ts`
   - `scripts/image-generator/src/cli.ts`

**Validation**: `npm install` succeeds. `ls scripts/image-generator/src/` shows all files. `git status` shows `scripts/image-generator/` is not gitignored.

---

### Step 2 — Seed derivation, palette mapping, and word count extraction (RED then GREEN)

> **Prompt**: Implement Step 2 of `_plans/shipped/image-generator.md`. Write tests first (RED), then implement seed derivation, palette mapping, and word count extraction (GREEN). Run `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx tsx --test tests/image-generator/seed.test.ts tests/image-generator/palette.test.ts tests/image-generator/word-count.test.ts` to verify.

**Tests first**:

`tests/image-generator/seed.test.ts`:
- `stringToSeed("hello")` returns same integer every time (determinism)
- `stringToSeed("hello") !== stringToSeed("world")` (different inputs differ)
- `stringToSeed("")` returns a valid non-negative integer (empty string edge case)
- Seedable PRNG: `createPRNG(42)` produces same sequence on repeated calls with same seed
- Seedable PRNG: `createPRNG(42)` vs `createPRNG(99)` produce different sequences

`tests/image-generator/palette.test.ts`:
- `"AI & Machine Learning"` categories → cyan/blue palette
- `"Ethics of AI"` → coral/orange palette
- `"Sustainability"` → green palette
- `"Vibe Coding"` → purple palette
- Unknown category (e.g., `"Cooking"`) → default cyan
- Empty categories `[]` → default cyan
- Multiple categories `["Ethics of AI", "Sustainability"]` → first match wins (coral/orange)
- `computeParticleParams(100)` → at least 100 particles, reasonable maxSteps
- `computeParticleParams(2000)` → capped at 300 particles
- `computeParticleParams(0)` → minimum particle count (no crash)

`tests/image-generator/word-count.test.ts`:
- HTML string `"<p>Hello world</p>"` → 2
- Tiptap JSON with text nodes → correct count
- Empty/null/undefined input → 0
- Mixed blocks (some with text, some without) → counts only text

**Implementation**:

- `src/seed.ts`: `stringToSeed(s)` using `crypto.createHash('md5')`, `createPRNG(seed)` using mulberry32
- `src/palette.ts`: `getCategoryPalette(categories)` with the 4 palettes from spec, `computeParticleParams(wordCount)` with min/max bounds (particles: 100-300, maxSteps: 150-250)
- `src/word-count.ts`: `extractWordCount(contentRowsValue)` — handles HTML strings (strip tags, count words), Tiptap JSON (recursively extract `.text` nodes), and null/empty

**Run**: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx tsx --test tests/image-generator/seed.test.ts tests/image-generator/palette.test.ts tests/image-generator/word-count.test.ts`

---

### Step 3 — Noise, flow field, and particle simulation (RED then GREEN)

> **Prompt**: Implement Step 3 of `_plans/shipped/image-generator.md`. Write tests first for noise generation and particle simulation, then implement by porting from `_specs/shipped/image-generator/flow_field_generator.py`. Run `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx tsx --test tests/image-generator/flow-field.test.ts` to verify.

**Tests first** (`tests/image-generator/flow-field.test.ts`):
- `SimpleNoise(seed).noise(x, y)` returns values in [-1, 1] range
- Same seed + same coordinates → same noise value (determinism)
- Different seeds → different noise values
- `generateFlowField(seed, ...)` returns Float64Array of correct length
- Same seed → identical flow field (determinism)
- `spawnParticles(100, seed, 1200, 630)` returns 100 particles within bounds
- Same seed → same spawn positions
- `simulateParticles(...)` moves particles along flow field vectors
- Particles that exit bounds are marked `alive: false`

**Implementation** (port from Python reference):

- `src/noise.ts`: Port `SimpleNoise` class — `fade()`, `lerp()`, `gradient()`, `noise(x, y)`. Uses `createPRNG(seed)` for permutation table generation instead of `np.random`.

- `src/flow-field.ts`:
  - `generateFlowField(seed, width, height, scale, octaves, gridScale)` — **coarse grid optimization**: compute noise at every `gridScale`th pixel (default 4), store in Float64Array. Returns `{ grid: Float64Array, gridW, gridH, gridScale }`.
  - `getAngle(field, x, y)` — bilinear interpolation of surrounding 4 grid points for any pixel coordinate
  - `spawnParticles(count, seed, width, height)` — uses `createPRNG(seed)` for positions
  - `simulateParticles(particles, field, maxSteps, stepLength)` — walks particles through flow field using `getAngle()`, records history, marks dead on exit

**Key porting notes**:
- Python `np.random.seed(seed)` → `createPRNG(seed)` from Step 2
- Python `np.random.permutation(256)` → Fisher-Yates shuffle using PRNG
- Python `np.random.uniform(0, width)` → `prng() * width`
- Flow field angles stored as `(noise_val + 1) * Math.PI` (0 to 2pi range)

**Run**: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx tsx --test tests/image-generator/flow-field.test.ts`

---

### Step 4 — Canvas renderer and end-to-end generator (RED then GREEN)

> **Prompt**: Implement Step 4 of `_plans/shipped/image-generator.md`. Write tests for the renderer and the orchestrating generator, then implement. The renderer uses `@napi-rs/canvas` to draw particle trails as a PNG. The generator wires everything together: metadata → seed/palette → flow field → particles → PNG buffer. Run `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx tsx --test tests/image-generator/renderer.test.ts tests/image-generator/generator.test.ts` to verify.

**Tests first**:

`tests/image-generator/renderer.test.ts`:
- Output is a valid PNG (starts with PNG magic bytes `\x89PNG`)
- Output buffer has non-zero length
- Same particles + palette → byte-identical output (determinism)
- Different particles → different output

`tests/image-generator/generator.test.ts`:
- `generateImage(metadata)` returns a Buffer
- Same metadata → byte-identical PNG (determinism, per acceptance criteria)
- Different metadata (different title, different node ID) → different PNG (distinctness)
- Edge cases: zero word count, empty title, no categories — all produce valid PNG without crashing

**Implementation**:

- `src/renderer.ts`: `renderToBuffer(particles, palette, width, height, options)`:
  - Create canvas: `createCanvas(1200, 630)`
  - Fill background: `ctx.fillStyle = 'rgb(15,20,30)'`
  - For each particle with `history.length >= 2`: draw trail segments with `ctx.beginPath/moveTo/lineTo/stroke`, cycling through palette colors, alpha fading along trail length
  - Return `canvas.toBuffer('image/png')`

- `src/generator.ts`: `generateImage(metadata, options?)`:
  - `titleSeed = stringToSeed(metadata.title)`
  - `palette = getCategoryPalette(metadata.categories)`
  - `{ numParticles, maxSteps } = computeParticleParams(metadata.wordCount)`
  - `field = generateFlowField(titleSeed, width, height, ...)`
  - `particles = spawnParticles(numParticles, stringToSeed(metadata.id), width, height)`
  - `simulateParticles(particles, field, maxSteps, 2.5)`
  - `return renderToBuffer(particles, palette, width, height, options)`

**Run**: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx tsx --test tests/image-generator/renderer.test.ts tests/image-generator/generator.test.ts`

---

### Step 5 — Umbraco API integration

> **Prompt**: Implement Step 5 of `_plans/shipped/image-generator.md`. Create the Umbraco API integration module that fetches article metadata, resolves categories, computes word counts, uploads images to the media library, and assigns them as `mainImage`. Test manually against the running Umbraco instance. Follow patterns from `scripts/add-section-nav-property.cjs` for auth and HTTP helpers.

**File**: `scripts/image-generator/src/umbraco-api.ts`

**Auth & HTTP** (follow `scripts/add-section-nav-property.cjs` pattern):
- `authenticate()` — POST `/umbraco/management/api/v1/security/back-office/token` with client credentials from `.env`
- `request(method, path, body, token)` — HTTPS wrapper with `NODE_TLS_REJECT_UNAUTHORIZED=0`
- `freshToken(cachedToken, issuedAt)` — re-authenticate if token is older than 250s

**Functions**:

1. `fetchArticles(token): Promise<ArticleMetadata[]>`
   - Walk document tree: `/tree/document/root` → find articles container (names use `variants[0].name`)
   - Get children, for each article GET `/document/{id}`
   - Extract `title` from values array (alias `title`), fall back to `variants[0].name`
   - Extract `categories` — MNTP value is array of content references, resolve to names using pre-fetched category map
   - Compute `wordCount` from `contentRows` value using `extractWordCount()` from Step 2

2. `resolveCategories(token): Promise<Map<string, string>>`
   - Walk tree to find Category List node, fetch its children
   - Build `Map<uuid, name>` — e.g., `{ "abc-123": "AI & Machine Learning" }`
   - Used to resolve MNTP references without per-article API calls

3. `ensureMediaFolder(token): Promise<string>`
   - GET `/tree/media/root` — check if "Generated Images" folder exists
   - If not, create it via POST `/media`
   - Return folder UUID

4. `uploadImage(token, folderId, fileName, pngBuffer): Promise<string>`
   - Consult Swagger at `https://localhost:44367/umbraco/swagger` for exact media upload format
   - Create media item with parent = "Generated Images" folder
   - Return media item UUID

5. `assignMainImage(token, documentId, mediaId): Promise<void>`
   - GET `/document/{id}` to read current values
   - Set `mainImage` value in MediaPicker3 format: `[{ "key": "<random-uuid>", "mediaKey": "<media-uuid>", "crops": [], "focalPoint": null }]`
   - PUT `/document/{id}` with full payload (template, values, variants)

6. `hasMainImage(token, documentId): Promise<boolean>`
   - GET `/document/{id}`, check if `mainImage` value is non-null and non-empty array

**Validation**: Run individual functions against the live Umbraco instance. Verify:
- `fetchArticles()` returns articles with resolved category names and word counts
- `uploadImage()` creates a media item visible in the backoffice "Generated Images" folder
- `assignMainImage()` shows the image on the article's Main Image field in the backoffice

---

### Step 6 — CLI entry point

> **Prompt**: Implement Step 6 of `_plans/shipped/image-generator.md`. Create the CLI entry point that ties together the generator and Umbraco API integration. Support single-article mode, batch mode, --force flag, and --local-only for preview. Test against running Umbraco.

**File**: `scripts/image-generator/src/cli.ts`

**Usage**:
```bash
# Single article by name
npx tsx scripts/image-generator/src/cli.ts --name "Retaining Humanity in AI-Generated Content"

# Single article by Umbraco document ID
npx tsx scripts/image-generator/src/cli.ts --id "abc123-..."

# Batch mode: all articles without a featured image
npx tsx scripts/image-generator/src/cli.ts --batch

# Force regenerate (even if article already has an image)
npx tsx scripts/image-generator/src/cli.ts --batch --force

# Preview locally without uploading
npx tsx scripts/image-generator/src/cli.ts --name "Article Title" --local-only --output ./preview.png
```

**Behavior**:
1. Parse args (simple `process.argv` parsing, no external library)
2. Validate: exactly one of `--name`, `--id`, or `--batch` required
3. Authenticate with Umbraco API (unless `--local-only`)
4. Resolve target article(s)
5. For each article:
   - Check `hasMainImage()` — skip unless `--force` (report "Skipping: already has image")
   - Fetch full metadata (title, categories, word count)
   - Call `generateImage(metadata)` → PNG Buffer
   - If `--local-only`: write buffer to `--output` path (or `./generated-{name}.png`)
   - Otherwise: `ensureMediaFolder()` → `uploadImage()` → `assignMainImage()`
   - Report: `"Generated: {title} ({wordCount} words, {categories}) → {mediaId}"`
6. Summary line: `"Done: N generated, N skipped, N errors"`

**Error handling**:
- Umbraco not running → fail fast: `"Error: Cannot connect to Umbraco at {url}"`
- Auth failure → `"Error: Authentication failed. Check UMBRACO_CLIENT_ID/SECRET in .env"`
- Upload failure → log error, continue batch (don't halt), count as error in summary

**Validation**: Run `npx tsx scripts/image-generator/src/cli.ts --batch` with Umbraco running. Check:
- Progress output for each article
- Images appear in media library under "Generated Images" folder
- Articles show the generated image in their Main Image field in the backoffice

---

### Step 7 — Integration test

> **Prompt**: Implement Step 7 of `_plans/shipped/image-generator.md`. Write an integration test that validates the full pipeline: generate an image for a known article, verify determinism, and confirm the image can be uploaded and assigned. Run `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx tsx --test tests/image-generator/integration.test.ts` to verify.

**File**: `tests/image-generator/integration.test.ts`

**Requires**: Running Umbraco instance

**Test cases**:
1. **Fetch articles**: `fetchArticles()` returns non-empty array with valid metadata (title, categories, wordCount > 0)
2. **Generate image**: `generateImage(article)` returns a valid PNG buffer (check magic bytes, non-zero size)
3. **Determinism**: Generate twice for same article → `buffer1.equals(buffer2)` is true
4. **Distinctness**: Generate for two different articles → buffers are NOT equal
5. **Upload + assign** (if safe to test): Upload to "Generated Images" folder, assign to article, verify via GET that `mainImage` is set. Clean up uploaded media afterward.

**Run**: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx tsx --test tests/image-generator/integration.test.ts`

---

## File Summary

| Action | File |
|--------|------|
| Modify | `package.json` (add `@napi-rs/canvas`, `tsx` + scripts) |
| Modify | `.gitignore` (un-gitignore `scripts/image-generator/`) |
| Create | `scripts/image-generator/src/types.ts` |
| Create | `scripts/image-generator/src/seed.ts` |
| Create | `scripts/image-generator/src/palette.ts` |
| Create | `scripts/image-generator/src/word-count.ts` |
| Create | `scripts/image-generator/src/noise.ts` |
| Create | `scripts/image-generator/src/flow-field.ts` |
| Create | `scripts/image-generator/src/renderer.ts` |
| Create | `scripts/image-generator/src/generator.ts` |
| Create | `scripts/image-generator/src/umbraco-api.ts` |
| Create | `scripts/image-generator/src/cli.ts` |
| Create | `tests/image-generator/seed.test.ts` |
| Create | `tests/image-generator/palette.test.ts` |
| Create | `tests/image-generator/word-count.test.ts` |
| Create | `tests/image-generator/flow-field.test.ts` |
| Create | `tests/image-generator/renderer.test.ts` |
| Create | `tests/image-generator/generator.test.ts` |
| Create | `tests/image-generator/integration.test.ts` |

## Verification

1. **Unit tests** (Steps 2-4): `npx tsx --test tests/image-generator/seed.test.ts tests/image-generator/palette.test.ts tests/image-generator/word-count.test.ts tests/image-generator/flow-field.test.ts tests/image-generator/renderer.test.ts tests/image-generator/generator.test.ts` — all pass
2. **Visual check**: `npx tsx scripts/image-generator/src/cli.ts --name "..." --local-only --output ./preview.png` — open PNG, verify flow field pattern
3. **Full pipeline**: `npx tsx scripts/image-generator/src/cli.ts --batch` — images appear in Umbraco media library and are assigned to articles
4. **Determinism**: Run CLI twice for same article, compare file hashes (`md5 preview1.png preview2.png`)
5. **Distinctness**: Generate for two different articles, visually confirm different patterns
6. **Integration test**: `npx tsx --test tests/image-generator/integration.test.ts` — all pass

## Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Media upload API format unknown | Inspect Swagger docs at `https://localhost:44367/umbraco/swagger` during Step 5; may need multipart form data or two-step create+upload |
| Tiptap RTE value format (HTML vs JSON) | `extractWordCount()` handles both formats; verify against live API |
| Cross-platform PNG determinism | Byte-identical guaranteed on same platform + same `@napi-rs/canvas` version; document this limitation |
| MNTP category value format | May be `string[]` or `{ unique: string }[]`; handle both in `resolveCategories()` |
