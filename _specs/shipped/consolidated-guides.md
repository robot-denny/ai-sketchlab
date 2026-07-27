# Spec for consolidated-guides

> This spec captures initial requirements and design rationale. For **current system behavior**, see the doc named on the **Work type** line below — the evergreen behavior of the Styleguide and Component Guide folds into `_features/styleguide-and-component-guide.md` after implementation; the Guides-parent pathway behavior cross-references `_features/editor-how-to-guides.md`.

branch: claude/feature/consolidated-guides
**Work type**: change-to styleguide-and-component-guide  — see CLAUDE.md → Workflow layers → "Work types". The Styleguide + Component Guide are already shipped, documented capabilities (`_features/styleguide-and-component-guide.md`); this reconciles/rebuilds them onto a shared consolidated doc type. Also updates the Guides-parent behavior recorded in `_features/editor-how-to-guides.md`. No new feature doc.
figma_component (if used): none

## Summary

Reconcile how "guides" are manifested on the site now that blocks render from one shared, editor-agnostic view in both Block List and Block Grid (the shim removal shipped 2026-07-16). Today the guide surfaces are fragmented: the Styleguide is its own `styleGuidePage` doc type, the Component Guide is a generic `content` page detected by a parent-alias string in `content.cshtml`, and the Guides parent is a third doc type — with two inconsistent visibility-control compositions between them.

This work introduces **one consolidated Guide Page doc type** that backs both the **Styleguide** (a reference for the brand's basic building blocks and patterns) and the **Component Guide** (a reference showing every block a CMS editor can place, regardless of page type or palette). Both share underlying CMS infrastructure, stay fully editor-editable, lay out their body with **Block Grid**, and render a **manageable left-column table of contents** (anchor links to on-page sections) in place of the contextual section-navigation sidebar. Guides keep the controls for appearing in search / nav / sitemap but drop the show/hide section-nav toggle entirely.

The Styleguide showcases brand fundamentals — color swatches, typefaces, the typographic scale, button/table/form styles, the styles an editor can apply from the rich-text editor, background patterns, and other art-direction elements. The Component Guide shows each available block with a live example, its variations, a brief description of its purpose, and — where one exists — a link to that block's how-to guide. The how-to guide (which describes fields and usage) is adapted separately but is expected to adopt conventions established here.

As the final delivery step, the Styleguide and Component Guide pages are created and their content populated via the Umbraco MCP server.

## Functional Requirements

- **Consolidated Guide Page doc type.** A single shared doc type backs both the Styleguide and the Component Guide. It replaces the current split (`styleGuidePage` + the `content`-child-under-styleguide Component Guide). Both pages are instances of the same type.
- **Shared, minimal composition set.** The Guide Page composes: SEO controls (`sEOControls` — `metaName`, `metaDescription`, `metaKeywords`, `isIndexable`, `isFollowable`) and nav/search visibility controls (`hideFromTopNavigation`, `hideFromXMLSitemap`, and "Hide From Search" / `umbracoNaviHide`). It does **not** compose the section-navigation controls (neither the `showSectionNavigation` opt-in nor `hideFromSectionNavigation`).
- **Block Grid body.** The Guide Page lays out its content elements with Block Grid (not the current nested Block List `sectionRows → contentSectionRow → sectionContent`), reusing the shared editor-agnostic block views. Because blocks now render identically in both editors, the same blocks used elsewhere on the site are available here.
- **Manageable left-column table of contents.** Both guides render a TOC in the left column whose entries are anchor links to the page's on-page sections. The TOC stays in sync as sections are added, removed, or reordered — whether by a content editor in the backoffice or by an agentic workflow — without a code change or manual duplicate edit.
- **Guides parent as a wayfinding page.** The Guides parent page (under Home) uses existing blocks to surface editor-composed pathways to the Styleguide, the Component Guide, and the How-To Guides.
- **Styleguide content.** Showcases the brand's building blocks and patterns: color swatches, typefaces, the typographic scale, button styles, table styles, form styles, the styles applicable via the CMS rich-text editor, background patterns, and other art-direction elements.
- **Component Guide content.** Shows every block a CMS editor can place on the site (regardless of page type or palette): each block appears with a live example, its variations (when it has any), and a brief description of its purpose. When a how-to guide exists for a block, the Component Guide entry links to it.
- **Editor-editable.** All guide content — sections, ordering, narrative copy, and the TOC — remains editable by content editors in the CMS with no code deploy.
- **MCP delivery.** The Styleguide and Component Guide pages are created via the Umbraco MCP server, and their content is populated via MCP.
- **Compatibility with how-to guides.** The existing how-to-guide machinery (the `guide-generator` CLI, the `howToGuidePage` type, `generationMetadata` source-signature diffing, the `/guide` command, and the AI Agent brand-voice generation) continues to function. The how-to guide's own adaptation to these conventions is out of scope for this spec.

## Possible Edge Cases

- A guide has sections with duplicate titles → their anchor links must remain unique and unambiguous.
- A section title contains punctuation or non-ASCII characters → the anchor/slug must still be valid and stable.
- A block on the Component Guide has no how-to guide yet → the entry renders without a broken/placeholder link.
- A block has no variations → the entry shows a single example without an empty "variations" affordance.
- The TOC is long enough to exceed the viewport height → it remains usable (e.g. scrolls independently) on desktop.
- Narrow/mobile viewport → the left-column TOC collapses or relocates without hiding page content.
- An empty guide (no sections yet) → the page renders gracefully with an empty or omitted TOC, not a crash.
- The existing `/styleguide` and `/styleguide/components` URLs — visitors, search engines, and the how-to-guide URL-stability scenario currently depend on them; changing the doc type must not silently 404 them.
- The Component Guide is currently a `content` page keyed off `Model.Parent.ContentType.Alias == "styleGuidePage"` in `content.cshtml` — the consolidation must not leave that string coupling dangling for other `content` pages.
- MCP is not always connected (it was disconnected during this session) → the create/populate step is gated on a live MCP connection to the running local site.
- Populating a large amount of content in one MCP/agent call can hit the large-output ceiling (see `[[project_ai_copilot_large_output_ceiling]]`) → content population may need to be chunked section-by-section.

## Acceptance Criteria

- **AC1 — One doc type, two pages.** A single consolidated Guide Page doc type backs both the Styleguide and the Component Guide; both pages are instances of the same type and share the same compositions.
- **AC2 — Correct control surface.** A Guide Page offers SEO controls and the search/nav/sitemap visibility controls, and offers **no** section-navigation show/hide toggle.
- **AC3 — Block Grid layout.** A Guide Page's body is laid out with Block Grid, and the blocks available there are the site's shared blocks.
- **AC4 — Manageable left-column TOC.** Each guide renders a left-column table of contents of anchor links to its sections, and adding or removing a section updates the TOC with no code change.
- **AC5 — Guides parent pathways.** The Guides parent page surfaces editor-composed links to the Styleguide, Component Guide, and How-To Guides.
- **AC6 — Styleguide showcases brand fundamentals.** The Styleguide presents color swatches, typefaces, the type scale, button/table/form styles, RTE-applicable styles, background patterns, and other art-direction elements.
- **AC7 — Component Guide shows every block with variations, description, and how-to link.** The Component Guide lists every editor-available block with an example, its variations, a brief description, and a link to its how-to guide when one exists.
- **AC8 — Editor-editable, no deploy.** A content editor can change a guide's sections, order, copy, and TOC and see it live without a code deploy.
- **AC9 — Created and populated via MCP.** The Styleguide and Component Guide pages are created and their content populated through the Umbraco MCP server.
- **AC10 — How-to guides keep working.** The existing how-to-guide generation and pages continue to function unchanged.

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples. These will be verified and refined after implementation. The verified versions land in `_features/styleguide-and-component-guide.md`.

### Rule: One consolidated Guide Page doc type backs both the Styleguide and the Component Guide

```scenario
Scenario: Both guides are the same doc type
  Given the consolidated Guide Page doc type exists
  When a CMS editor inspects the Styleguide page and the Component Guide page in the backoffice
  Then both report the same document type
  And both expose the same properties and compositions
```

```scenario
Scenario: The Component Guide is no longer a parent-alias-detected content page
  Given the Component Guide is a Guide Page
  When a visitor loads the Component Guide
  Then it renders through the Guide Page template
  And no generic "content" page relies on being a child of the Styleguide to pick up guide styling
```

### Rule: A Guide Page offers SEO + search/nav/sitemap controls but no section-navigation toggle

```scenario
Scenario: An editor sets a guide to be indexable and hidden from top nav
  Given an editor is editing the Component Guide page
  When they open its settings
  Then they can set "Indexable" and "Hide From Top Navigation" and "Hide From Search" and "Hide From XML Sitemap"
  And there is no "Show section navigation" toggle
  And there is no "Hide from section navigation" toggle
```

```scenario
Scenario: A guide marked non-indexable is excluded from search and sitemap consistently
  Given the Styleguide page has "Hide From Search" enabled
  When the search index is built
  Then the Styleguide does not appear in site search results
```

### Rule: Guide pages lay out their body with Block Grid

```scenario
Scenario: An editor arranges styleguide sections on a grid
  Given the Styleguide page uses a Block Grid body
  When an editor places a color-palette block and a typography-showcase block and reorders them on the grid
  Then the published Styleguide reflects the new grid arrangement on the next request
  And no code change or deploy is required
```

```scenario
Scenario: The same shared blocks are available in the guide's Block Grid
  Given blocks render from one shared editor-agnostic view in both editors
  When an editor opens the Guide Page Block Grid palette
  Then the shared site blocks (e.g. richTextRow, colorPaletteBlock, imageRow) are offered
```

### Rule: Each guide renders a manageable left-column table of contents

```scenario
Scenario: The TOC links to each on-page section
  Given the Component Guide has sections titled "Text blocks", "Media blocks", and "Layout blocks"
  When a visitor loads the Component Guide
  Then the left column shows a table of contents with entries "Text blocks", "Media blocks", "Layout blocks"
  And clicking "Media blocks" scrolls the page to the Media blocks section
```

```scenario
Scenario: Adding a section updates the TOC without a code change
  Given the Component Guide's TOC lists "Text blocks" and "Media blocks"
  When an editor (or an agentic workflow) adds a new section titled "Interactive blocks" and publishes
  Then the left-column TOC now includes an "Interactive blocks" anchor link
  And no code change or deploy was required
```

```scenario
Scenario: Two sections with the same title get distinct anchors
  Given a guide has two sections both titled "Examples"
  When a visitor loads the guide
  Then the TOC shows two entries whose anchor links resolve to different sections
```

### Rule: The Guides parent page surfaces pathways to the three guide types

```scenario
Scenario: The Guides landing links out to each guide
  Given the Guides parent page is published under Home
  When a visitor loads the Guides page
  Then they see editor-composed pathways to the Styleguide, the Component Guide, and the How-To Guides
  And the pathways are built from existing site blocks
```

### Rule: The Styleguide showcases the brand's building blocks and patterns

```scenario
Scenario: The Styleguide presents the core brand fundamentals
  Given the Styleguide page is published
  When a visitor loads it
  Then they see color swatches, typefaces, the typographic scale, button styles, table styles, form styles, the RTE-applicable text styles, and background patterns
  And the swatches and type examples are derived from the production CSS
```

### Rule: The Component Guide shows every editor-available block with its variations, a description, and a how-to link when one exists

```scenario
Scenario: A block with variations shows each variation and a description
  Given the Alert Banner block has "info", "warning", and "success" variations
  When a visitor loads the Component Guide and reaches the Alert Banner entry
  Then they see a live example of the Alert Banner
  And they see each of its variations
  And they see a brief description of the block's purpose
```

```scenario
Scenario: A block that has a how-to guide links to it
  Given a How-To Guide Page exists for the Alert Banner block
  When a visitor reaches the Alert Banner entry in the Component Guide
  Then the entry shows a link to the Alert Banner how-to guide
```

```scenario
Scenario: A block with no how-to guide renders without a broken link
  Given no How-To Guide Page exists for the Stat Callout block
  When a visitor reaches the Stat Callout entry in the Component Guide
  Then the entry shows the example and description
  And it shows no broken or placeholder how-to link
```

### Rule: Guide content stays editable by content editors with no deploy

```scenario
Scenario: An editor rewrites a guide section's copy
  Given the Styleguide has an introductory rich-text section reading "Our design system"
  When an editor changes it to "Brand & design reference" and publishes
  Then visiting the Styleguide shows "Brand & design reference"
  And no code change or deploy is required
```

### Rule: The Styleguide and Component Guide are created and populated via MCP

```scenario
Scenario: The pages are provisioned through the Umbraco MCP server
  Given the consolidated Guide Page doc type is deployed and the local site is running with MCP connected
  When the Styleguide and Component Guide are created via MCP and their content populated via MCP
  Then both pages are published and render their populated content
  And both were created without hand-authoring in the backoffice UI
```

### Rule: Existing how-to-guide behavior keeps working

```scenario
Scenario: The /guide CLI still creates and amends how-to guide pages
  Given the consolidated guides have shipped
  When Sam runs "/guide alertBanner"
  Then the how-to-guide creation/amend flow behaves as before
  And the How-To Guide Page type and generationMetadata contract are unchanged
```

## Open Questions

- **Doc type replacement vs. new type + URL strategy.** Does the consolidated Guide Page *replace* `styleGuidePage` (migrating `/styleguide` in place), or is it a new type with new URLs and redirects from the old ones? The `editor-how-to-guides` feature has a standing scenario asserting `/styleguide` and `/styleguide/components` stay reachable — the plan must preserve those URLs (URL Tracker 301s are available) or explicitly revise that scenario. --later we can revise the scenario, but we can make a new type use redirects as necessary.
- **Where does the Component Guide live in the tree?** Stays a child of the Styleguide (`/styleguide/components`), or becomes a sibling under `/guides/` (e.g. `/guides/components`)? This affects both URLs above and the Guides-parent wayfinding. --guides/ will have styleguide, component-guide, and how-to-guides and children.
- **TOC source of truth.** Is the TOC *auto-derived* from the Block Grid section headings (the approach `_StyleGuideSectionRows.cshtml` already uses — slugify each section title, emit an "On this page" nav), or an *explicitly editor-managed* list of `{label, anchor}` entries? Auto-derivation is the most maintenance-free and best satisfies "updates easily when a component is added"; an explicit list gives editors more control but must be kept in sync. **Recommended default: auto-derive from section headings**, so agentic additions surface in the TOC for free. --auto-derive
- **Block Grid data type.** Reuse the existing `[BlockGrid] Experiments Body` palette/data type, or author a new guide-specific Block Grid data type? A guide-specific one avoids coupling the guide palette to the Innovation Showcase's palette. --create new data type
- **How the Component Guide enumerates blocks.** Fully editor-placed (each block dropped in by hand), or partially/agentically generated so a newly added site block can be auto-appended? The requirement names both the manual and agentic paths — the plan should say which is authoritative and how they coexist without clobbering editor work (mirroring the `/guide` non-overwrite discipline). --manual is authoritative, so mirror the /guide non-overwrite discipline
- **"Variations" representation.** How is a block "variation" modeled for the Component Guide — multiple instances of the block with different settings, or a dedicated variations affordance? Depends per block (e.g. alertBanner level vs. a layout block's options). --it may depend, however multiple instances with different settings is acceptable
- **Section-nav feature interaction.** `_features/section-navigation.md` documents the contextual sidebar; removing it from guides is a deliberate scope of *this* capability, not a change to section-navigation broadly — confirm no shared page type regresses. --confirmed. And for (future) context: the how-to-guides will likely retain section navigation, as each block will have its own guide, and users will want to navigate from one guide to the next via the section nav. 
- **MCP prerequisite.** The create/populate step (AC9) requires MCP reconnected against the running local site (`:44367`) — currently disconnected this session. Populating long content may need chunking to avoid the AI large-output ceiling (`[[project_ai_copilot_large_output_ceiling]]`). --confirm or verify MCP connection prior to implementing steps the require it. Ensure the plan chunks content population so the ceiling doesn't crash operations. 

## Testing Guidelines

Create/extend test file(s) under `./tests` for the reconciled guides. Reuse and update the existing `tests/e2e/styleguide.spec.ts` and `tests/e2e/styleguide-components.spec.ts` (and keep `tests/e2e/guides.spec.ts` / `guides-cli.spec.ts` green) rather than duplicating. Follow the E2E resilience rules in CLAUDE.md (dynamic UUID/slug lookup, clean-before-create, regex CSS assertions, prefer browser assertions). Cover, without going too heavy:

- Both the Styleguide and Component Guide resolve to the **same consolidated doc type** (schema assertion via the Management API).
- A Guide Page exposes SEO + search/nav/sitemap controls and **no** section-navigation toggle (schema assertion).
- The Guide Page body is a **Block Grid** and offers the shared site blocks (schema/palette assertion).
- The left-column **TOC** renders one anchor link per section and each link targets an existing on-page anchor (browser assertion); adding a section adds a TOC entry (fixture-driven).
- The Styleguide renders the brand fundamentals (colors, type, buttons, tables, forms, RTE styles, background patterns) — extend the existing showcase assertions.
- The Component Guide shows each block with an example and description, links to a how-to guide when one exists, and renders no broken link when one does not.
- The Guides parent surfaces links to all three guide types.
- URL stability for `/styleguide` (and the Component Guide URL, per the resolved tree decision) — the `editor-how-to-guides` URL-stability scenario must stay green or be intentionally revised.
- Render-coverage (`BlockRenderCoverageTests.cs`) and block-parity specs stay green.
