# Spec for Metadata-Driven Image Generator

branch: claude/feature/metadata-image-generator

## Summary
A system that generates unique abstract featured images for blog posts using the article's own metadata as creative input. Each image is reproducible, visually distinct, and tied directly to the content it represents — without relying on text prompts or generic AI image generation. Images are generated via a CLI command, uploaded to the Umbraco media library, and assigned as the article's featured image.

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
- **Categories** — Determines color palette (AI/ML = cyan, Ethics = orange, Sustainability = green, Vibe Coding = purple)

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

## Functional Requirements
- A CLI command is created that accepts an article identifier (node ID or name) and generates the flow field image
- The command fetches article metadata (title, word count, categories) from the Umbraco Management API
- The flow field algorithm uses the metadata to deterministically produce the image (same input = same output)
- The generated image is uploaded to the Umbraco media library via the Management API
- The image is assigned to the target article as its "main image" (heroImage or equivalent property) via the Management API
- A "batch" mode generates images for all articles that currently lack a featured image
- Image dimensions are 1200x630px
- Image style is a dark background with colored flow lines
- Color palettes are mapped from article categories:
  - AI & Machine Learning → cyan/blue tones
  - Ethics of AI → coral/orange tones
  - Sustainability → green tones
  - Vibe Coding → purple tones
  - Default (no matching category) → cyan
- Word count influences particle count (more words = more particles, capped at a reasonable max) and trail length

## Possible Edge Cases
- Article has no categories — should fall back to the default color palette
- Article has multiple categories — use the first matching palette (or blend palettes)
- Article has zero or very low word count — enforce a minimum particle count so the image isn't too sparse
- Article title is very short (1-2 words) — hash should still produce a well-distributed seed
- Article already has a featured image — skip unless a `--force` flag is provided
- Media library upload fails (e.g., network error, auth expired) — report the error clearly, don't leave partial state
- Multiple articles share the same title — node ID ensures spawn positions differ, so images will still be distinct
- The Umbraco instance is not running — fail fast with a clear error message

## Acceptance Criteria
- Running the command for a specific article generates a PNG and uploads it to the media library
- The generated image is assigned as the article's featured image
- Running the same command twice for the same article produces a byte-identical image (deterministic)
- Running the command for two different articles produces visually distinct images
- Batch mode processes all articles without featured images in a single run
- The command reports progress and any errors clearly to stdout
- Images render correctly as Open Graph previews (1200x630, no cropping issues)

## Open Questions
- Should the command be a standalone Python script, a Node.js script, or a .NET CLI tool? (Python has the reference implementation and numpy/Pillow ecosystem; Node.js or .NET would stay in the project's existing stack) - ideally node.js or .NET, use your discretion, but consider the future roadmap
- Which Umbraco property alias holds the "main image" for articles? (e.g., `heroImage`, `mainImage`, `articleImage`) -I believe it's `mainImage`
- Should we support author profile images with this same approach (using different metadata like author name)? -Future roadmap to use a similar approach
- Should generated images be stored in a dedicated media folder (e.g., "Generated Images") for easy identification? -Yes
- Do we need a mechanism to regenerate images when article metadata changes (e.g., title update)? -Yes

## Future Roadmap
These items are out of scope for the initial implementation but should inform architectural decisions now:

- **Backoffice integration** — Expose image generation as a backoffice action so Umbraco editors can generate/regenerate featured images directly from the content editor UI (e.g., an entity action or property action button on the main image field). This means the core generation logic should live in a reusable service/library, not be coupled to the CLI entry point.
- **Author profile images** — Use the same flow field approach for author profile photos, seeded from author-specific metadata (name, bio length, etc.) instead of article metadata. The generator should accept a generic metadata interface rather than being hardcoded to article fields.
- **Auto-regeneration on content change** — When an article's title or categories change, offer to regenerate the image. This could eventually be triggered by Umbraco content notifications/webhooks.
- **Architecture implication** — Prefer a design where the generation algorithm, Umbraco API integration, and CLI/UI entry points are separate layers. This allows the backoffice action to call the same generation + upload logic without reimplementing it.

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- Determinism: generating an image twice with the same metadata produces identical output
- Distinctness: generating images for two different articles produces different output
- Seed derivation: the string-to-seed function produces consistent, well-distributed values
- Category-to-palette mapping: correct palette is selected for each known category, and the default is used for unknown categories
- Word count scaling: particle count and trail length scale correctly within defined min/max bounds
- Edge cases: zero word count, empty title, no categories all produce valid (non-crashing) output
