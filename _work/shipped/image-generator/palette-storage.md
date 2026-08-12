# Spec for Image Generator Palette Storage

branch: claude/feature/metadata-image-generator

## Summary

Move category color palette configuration from a flat JSON file (`scripts/image-generator/config/palettes.json`) into an Umbraco document type so that palette settings are managed as CMS content. This allows palette configuration to transfer between environments (dev, staging, live) through Umbraco Deploy alongside all other site content, and gives editors a familiar content-editing experience for managing palettes.

This spec resolves the open question in `image-generator.md`: "Where should category palette configuration be persisted?" The answer is: **as Umbraco content, using a dedicated document type with a Block List for palette entries.**

## Problem Statement

The current implementation stores palette configuration in a JSON file on disk. This causes three problems:

1. **No environment transfer** — When editors customize palettes in the backoffice and then transfer content to another environment (e.g., dev to live), the palette settings do not travel with the transfer. Generated images appear on the target environment, but the palette configuration that produced them does not. The target environment's settings dashboard shows stale or default values.

2. **Deployment overwrites** — Because the JSON file is tracked in git, any `git pull` or Umbraco Cloud deployment can silently overwrite palette changes that editors made through the backoffice. Editor work is lost without warning.

3. **No content workflow** — Palette changes bypass Umbraco's content pipeline entirely. There is no save/publish lifecycle, no audit trail, no rollback capability, and no integration with Umbraco's permission model.

## Functional Requirements

### Palette Settings Document Type

- A document type named "Image Generator Settings" (or similar) exists in the CMS
- It is not available as a root-level document — it lives under a designated parent (e.g., a "Site Settings" folder in the content tree, or wherever the site's configuration nodes are kept)
- Exactly one instance of this document type should exist in the content tree
- The document type contains:
  - A **Block List** property for category palette entries
  - A **Default Palette** group with color properties that define the fallback palette used when an article's categories have no matching entry

### Category Palette Block (Element Type)

- Each block in the Block List represents one category-to-palette mapping
- Each block contains:
  - A reference to the category (content picker pointing to the category node, or a text/label field showing the category name — whichever aligns with how categories are modeled in the CMS)
  - Three color properties representing the palette colors (primary, mid, deep) — using Umbraco's Eye Dropper color picker, which returns hex values
- Editors can add, remove, and reorder palette entries using the standard Block List UI
- The initial set of palette entries is seeded from the existing defaults (AI & Machine Learning, Ethics, Sustainability, Agentic Coding) when the settings document is first created

### Default Palette

- The settings document has a separate group (not inside the Block List) with three color properties for the default palette
- The default palette is used when an article's categories do not match any configured entry
- The default palette cannot be deleted — the properties are always present on the document type
- Initial default colors are seeded from the current defaults

### Editor Experience

- Editors navigate to the Image Generator Settings document in the content tree to manage palettes
- Adding a new category palette is done by adding a block to the Block List — standard Umbraco workflow
- Changing colors is done by clicking the Eye Dropper color picker on each color property — standard Umbraco workflow
- Editors save and publish the settings document to make changes take effect
- No custom backoffice dashboard is needed for palette editing — the standard Umbraco content editor provides the UI

### Image Generator Dashboard (Revised Scope)

- The existing Image Generator dashboard in the Settings section retains the **generation controls** only:
  - Single-article generation (article picker, generate button, force toggle)
  - Batch generation (generate missing, regenerate all, progress display)
- The **palette editor section is removed** from the dashboard — palette management is handled entirely through the settings document described above
- The dashboard may include a link or reference to the settings document for convenience

### CLI and Generation Integration

- The CLI and the backoffice generate action both read palette configuration from the Umbraco content API at generation time (fetching the settings document and extracting the Block List values)
- The C# controller that serves the generation endpoints is responsible for reading the settings document and translating it into the palette format the generator expects
- If the settings document does not exist or is unpublished, generation falls back to hardcoded defaults — it never fails due to missing configuration
- Palette data flows: Settings document (Umbraco content) -> C# controller reads via Content API -> passes to CLI/generator as structured input

### Environment Transfer

- Because the settings document is standard Umbraco content, it transfers between environments through Umbraco Deploy's normal content transfer mechanism
- When an editor queues content for transfer (e.g., dev to live), the palette settings transfer alongside articles, media, and other content
- When content is restored from a downstream environment (e.g., live to dev), palette settings come with it
- No special deploy connectors, artifacts, or transfer handlers are needed — this is automatic

## Possible Edge Cases

- **Settings document doesn't exist yet** — Generation uses hardcoded defaults. The dashboard and CLI work without error. A note or prompt could suggest creating the settings document.
- **Settings document exists but is not published** — Same as not existing; generation uses defaults. Editors must publish for changes to take effect.
- **Block List is empty (no category entries, only default)** — All articles generate with the default palette. This is valid.
- **Category referenced in a palette block is deleted from the CMS** — The palette entry becomes orphaned. It does not break generation; it simply never matches. Editors can clean it up manually.
- **Category is renamed in the CMS** — If the block references the category by content picker (node reference), the rename is transparent. If by text field, the entry becomes orphaned (same as above).
- **Two palette blocks reference the same category** — Both palettes merge into a combined pool for that category (consistent with the multi-category merge behavior described in the main spec). Alternatively, treat as a configuration error and use only the first match — this is a design choice for the implementer.
- **Eye Dropper returns hex values but the generator expects RGB arrays** — The C# controller or CLI adapter converts hex to RGB at read time. This is a data format translation, not a functional concern.
- **Multiple "Image Generator Settings" documents exist** — The system reads the first published instance found. Implementers may add validation to prevent creating duplicates (e.g., by limiting the document type to a specific parent with a max-children constraint).
- **Editor changes palettes but does not regenerate images** — Existing images retain their old colors. This is expected. The editor must trigger regeneration (single or batch) for new colors to appear in images.

## Acceptance Criteria

- An "Image Generator Settings" document type exists with a Block List property for category palettes and a default palette group
- Editors can create, edit, and publish palette configuration through the standard Umbraco content editor
- Adding a palette block for a new category and publishing makes that palette available to the generator immediately
- Deleting a palette block and publishing causes affected articles to fall back to the default palette on next generation
- Changing default palette colors and publishing affects all articles with unmatched categories on next generation
- The CLI reads palette configuration from the Umbraco content API, not from a file on disk
- The backoffice generate action reads palette configuration from the same source as the CLI
- If the settings document is missing or unpublished, generation succeeds using hardcoded defaults
- Palette configuration transfers between environments via Umbraco Deploy's standard content transfer — no manual steps required
- Restoring content from a downstream environment brings palette settings with it
- The Image Generator dashboard no longer contains a palette editor section
- The dashboard's generation controls (single-article, batch) continue to work, reading palettes from the settings document
- Existing generated images are unaffected by this change — they retain their current appearance until explicitly regenerated

## Migration from File-Based Storage

- The existing `palettes.json` file is no longer the source of truth after this change
- A one-time migration is needed: create the settings document and populate its Block List from the current `palettes.json` values
- After migration, `palettes.json` can be removed from the repository or retained as a static fallback/reference
- The migration can be manual (an editor creates the document and enters the values) or scripted (a CLI command or setup script creates it via the Management API)

## Open Questions

- Should the settings document live under a "Site Settings" folder, or somewhere else in the content tree? This depends on how the site's content architecture organizes configuration nodes. --We can add a Site Settings folder if it does not yet exist. 
- Should the category reference in each palette block be a content picker (node reference) or a text field? A content picker is more robust (survives renames) but requires categories to be Umbraco content nodes. A text field is simpler but can become stale. --Content Picker
- Should the system prevent creating multiple "Image Generator Settings" documents? If so, how — document type validation, max-children on the parent, or a runtime check? --It should prevent creating multuple image generator settings docs. Let's try doc type validation.
- Is the three-color-per-palette model (primary, mid, deep) sufficient long-term, or should the Block List allow a variable number of colors per entry? The current generator uses exactly three, but future algorithms might want more. --Three is sufficient for now.

## Testing Guidelines

Create test files in the `./tests` folder for this feature. Cover the following without going too heavy:

**Palette reading from content (unit/integration)**
- Reading the settings document returns all configured palette entries and the default
- A category with a matching palette entry returns the correct colors
- A category with no matching entry returns the default palette
- Hex-to-RGB conversion produces correct values for known inputs

**Environment transfer (manual verification)**
- Create/edit palette settings on one environment, transfer content, verify settings appear on target environment
- Restore content from downstream, verify palette settings arrive on the upstream environment

**Generation with content-based palettes (integration)**
- Generating an image after changing a palette in the settings document produces an image with the updated colors
- Generating an image when the settings document is missing or unpublished uses default colors without error

**Dashboard (E2E)**
- The dashboard no longer shows a palette editor section
- The dashboard's generation controls still function correctly
- Single-article generation uses palettes from the settings document
