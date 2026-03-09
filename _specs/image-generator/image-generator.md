# Spec for Metadata-Driven Image Generator

branch: claude/feature/metadata-image-generator

## Summary
A system that generates unique abstract featured images for blog posts using the article's own metadata as creative input. Each image is reproducible, visually distinct, and tied directly to the content it represents — without relying on text prompts or generic AI image generation. Images are generated via a CLI command, uploaded to the Umbraco media library, and assigned as the article's featured image.

CMS editors can also trigger image generation directly from the backoffice — either for a single article via a generate action on the article edit page, or for all articles via a dedicated Image Generator settings dashboard. Category color palettes are managed from that same dashboard rather than being hardcoded, so editors can define and update colors as categories evolve.

## Problem Statement
The demo site needs featured images for articles and author profiles, but we want to avoid:
- Generic stock photography
- Prompt-based AI art that looks like "AI art"
- Manual image creation for every piece of content
- Images that feel disconnected from their articles

## Input (Article Metadata)
Each image is deterministically derived from these properties of the target article:
- **Node ID** — Seeds particle spawn positions
- **Title** — Seeds the flow field pattern (via hash)
- **Word Count** — Determines density/complexity (more words = more particles, longer trails)
- **Categories** — Determines color palette. Palette definitions are managed by CMS editors in the backoffice; unknown or unconfigured categories fall back to the default palette.

## Process
- Generate a Perlin noise-based flow field (an invisible force field of directional vectors)
- Spawn particles at positions determined by the node ID
- Particles flow through the field following the vector directions
- Trail paths are rendered with category-specific colors
- Result: organic, flowing abstract patterns unique to that article

**Reference `flow_field_generator.py` in this directory for an example implementation when planning.**

## Output
- 1200x630px PNG images (optimized for social sharing / Open Graph)
- Dark background (#0F141E) with colored flow lines
- Each article produces the same image every time (deterministic / reproducible)
- Different articles produce visibly different patterns

---

## Functional Requirements

### CLI Generation
- A CLI command accepts an article identifier (node ID, UUID, or name) and generates the flow field image
- The command fetches article metadata (title, word count, categories) from the Umbraco Management API
- The flow field algorithm uses the metadata to deterministically produce the image (same input = same output)
- The generated image is uploaded to the Umbraco media library via the Management API
- The image is assigned to the target article as its `mainImage` property via the Management API
- A `--batch` mode generates images for all articles that currently lack a featured image
- A `--force` flag overrides the skip-if-exists behavior and regenerates even when a `mainImage` is already set
- A `--local-only` flag renders and saves locally without uploading or assigning to the CMS
- Image dimensions are 1200×630px with a dark background and colored flow lines

### Backoffice: Article-Level Generate Action
- On any article edit page in the Umbraco backoffice, a "Generate Image" action is available (e.g., an entity action or button in the sidebar)
- Triggering the action generates a flow field image for that specific article using the same algorithm as the CLI
- Upon completion, the generated image is uploaded to the media library and assigned as the article's `mainImage`
- The editor can still manually select or replace the `mainImage` from the media library at any time — these two options (manual selection and generate) coexist
- The action shows a loading/progress state and confirms success or reports errors inline

### Backoffice: Image Generator Dashboard
A dedicated backoffice dashboard (or section within site settings) provides CMS editors with full control over image generation:

**Category Color Management**
- Displays all currently configured category → color palette mappings
- Each category entry shows: category name, and the three colors that form its palette (primary, mid, deep)
- Editors can edit colors for any existing category using a color picker or hex input
- Editors can add palette entries for new categories (typed name + three colors)
- Editors can delete palette entries
- A "Default" palette entry is always present and cannot be deleted — it applies to any category not explicitly mapped
- Category names should come from the live Umbraco category list wherever possible (fetched from the API), with a free-text fallback for entries that pre-date any category restructuring
- Changes to palette mappings are persisted so they survive server restarts and are available to both the CLI and the backoffice generate action

**Single-Article Generation**
- A search/picker to select any article by name
- A "Generate" button that runs generation for the selected article
- Displays outcome: image thumbnail preview, media library path, and whether it was newly generated or skipped (already had image)
- A "Force" toggle that regenerates even if the article already has an image

**Batch Generation**
- A "Generate All" button that generates images for all articles currently missing a `mainImage`
- A "Regenerate All" button (with prominent confirmation prompt) that regenerates images for every article, equivalent to `--batch --force`
- Displays a progress list as generation proceeds, with per-article status (generated, skipped, error)
- Reports a summary on completion: N generated, N skipped, N errors
- Batch operations run asynchronously — the editor can leave the page and return; status is preserved

### Color Palette Logic
- Color palettes are loaded from the persisted backoffice configuration at generation time (CLI and backoffice)
- If the configuration has no entry for a given category, the default palette is used (no crash, no skip)
- The default hardcoded palettes from the original spec serve as the initial/seed values when the configuration is first created:
  - AI & Machine Learning → cyan/blue tones
  - Ethics of AI → coral/orange tones
  - Sustainability → green tones
  - Vibe Coding → purple tones
  - Default (no match) → cyan

---

## Possible Edge Cases
- Article has no categories — falls back to the default palette
- Article has multiple categories — merge all matching palettes into a single combined color pool; the renderer cycles through all merged colors
- Article has zero or very low word count — enforce a minimum particle count so the image isn't too sparse
- Article title is very short (1–2 words) — hash still produces a well-distributed seed
- Article already has a featured image — skip unless `--force` flag is provided (CLI) or Force toggle is on (backoffice)
- Media library upload fails — report the error clearly, don't leave partial state; in batch mode, continue to the next article and count it as an error
- Multiple articles share the same title — node ID ensures spawn positions differ, so images are still distinct
- The Umbraco instance is not running — fail fast with a clear error message
- A category is renamed in the CMS — existing palette entries remain under the old name; the editor can update or delete them in the dashboard. Articles with the renamed category fall back to default until the palette is updated. Nothing crashes.
- A new category is added to the CMS that has no palette entry — article images generate using the default palette without error
- A palette entry is deleted from the dashboard — affected articles regenerate with the default palette next time; no crash

---

## Acceptance Criteria
- Running the CLI command for a specific article generates a PNG, uploads it to the media library, and assigns it as `mainImage`
- Running the same command twice for the same article produces a byte-identical image (deterministic)
- Running the command for two different articles produces visually distinct images
- Batch mode (`--batch`) processes all articles without a `mainImage` in a single run
- `--force` regenerates an article that already has a `mainImage`
- The CLI reports progress and any errors clearly to stdout with a summary line
- Images render correctly as Open Graph previews (1200×630, no cropping issues)
- The "Generate Image" backoffice action on an article edit page triggers generation and assigns the result to `mainImage`
- The backoffice action coexists with manual media library selection — neither overwrites the other unless the editor explicitly triggers generation
- The Image Generator dashboard lists all category → palette mappings
- Adding, editing, and deleting palette entries in the dashboard persists the changes
- The dashboard's single-article generator produces the same result as the CLI for the same article
- Batch generation from the dashboard respects the Force toggle and shows per-article progress
- An article with a category not in the palette configuration generates without error using the default palette
- Adding a new category to the CMS does not break image generation for any existing or new articles

---

## Open Questions
- Which Umbraco property alias holds the "main image" for articles? — believed to be `mainImage`
- Where should category palette configuration be persisted? Options: a dedicated Umbraco document type ("Image Generator Settings"), a JSON config file, or the Umbraco key/value store. Consider what's easiest for the CLI to also read.
- Should the backoffice "Generate Image" button be an entity action (shown in the action menu) or a custom property action next to the `mainImage` field? A property action feels more discoverable, but entity action is simpler to implement.
- Should generated images be stored in a dedicated media folder (e.g., "Generated Images") for easy identification? — Yes
- Should the batch backoffice operation run as a background job (so the editor can navigate away), or is a long-running request acceptable for the demo? A background job is more robust but adds complexity.

---

## Future Roadmap
These items are out of scope for this implementation but should inform architectural decisions now:

- **Author profile images** — Use the same flow field approach for author profile photos, seeded from author-specific metadata (name, bio length, etc.). The generator should accept a generic metadata interface rather than being hardcoded to article fields.
- **Auto-regeneration on content change** — When an article's title or categories change, offer to regenerate the image. Could be triggered by Umbraco content notifications/webhooks.
- **Architecture implication** — Prefer a design where the generation algorithm, Umbraco API integration, and CLI/UI entry points are separate layers. The backoffice action and the CLI should call the same generation + upload logic without reimplementing it.

---

## Testing Guidelines
Create test files in the `./tests` folder for the new feature. Cover the following without going too heavy:

**Core generator (unit)**
- Determinism: generating an image twice with the same metadata produces identical output
- Distinctness: generating for two different articles produces different output
- Seed derivation: `stringToSeed()` produces consistent, well-distributed values
- Category-to-palette mapping: correct palette for each known category; default for unknown; empty categories; multiple categories (first match wins)
- Word count scaling: particle count and trail length scale correctly within defined min/max bounds
- Edge cases: zero word count, empty title, no categories — all produce valid (non-crashing) output

**Palette configuration (unit)**
- Loading palette config returns all entries including default
- Looking up a known category returns the correct palette
- Looking up an unknown category returns the default palette
- Updating an entry persists the change and is reflected on the next lookup
- Deleting an entry falls back to default on the next lookup

**Backoffice dashboard (E2E or integration)**
- Category color management: add, edit, delete palette entries
- Single-article generation from the dashboard triggers upload and `mainImage` assignment
- Batch generation processes multiple articles and shows progress
- Force option regenerates an article that already has an image

**Resilience**
- A category name not in the config does not cause generation to throw or return null
- Palette config with only the default entry generates valid images for any category
