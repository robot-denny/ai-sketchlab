# Feature: Styleguide and Component Guide

A **Styleguide** and a **Component Guide** live side by side under the site's `/guides/` section as self-updating references for site admins, content authors, and new contributors. Both are the **same kind of page**, composed in the CMS from blocks so editors can reorder sections, retitle them, and add narrative copy around the programmatic content. The Styleguide (at `/guides/styleguide`) showcases the brand's building blocks — color swatches, typefaces, the type scale, and button/table/form/rich-text styles — read live from the production CSS so design-system changes propagate automatically. The Component Guide (at `/guides/component-guide`) demonstrates every reusable content block by live example, each with a short description and a link to that block's how-to guide where one exists. Each guide renders an auto-derived left-column table of contents from its section titles, and the legacy `/styleguide` URLs 301-redirect to the new homes.

**Source spec**: `_specs/shipped/consolidated-guides.md` (consolidation); `_specs/shipped/living-style-guide.md` (original)
**Last verified**: 2026-07-24 (consolidated onto the `guidePage` doc type)

---

## Increments

- [x] 2026-04-29 — Initial styleguide page with brand summary and hardcoded showcase sections (spec: `_specs/shipped/living-style-guide.md`)
- [x] 2026-05-01 — Block-driven architecture: `colorPaletteBlock`, `typographyShowcaseBlock`, `generalElementsBlock` element types; editor-arrangeable section rows; `/styleguide/components` child page
- [x] 2026-05-11 — TipTap `styleMenu` extension manifest for editorial classes (replaces TinyMCE `/**umb_name*/` annotations); editor-iframe preview stylesheet resynced
- [x] 2026-07-24 — **Consolidated onto one `guidePage` doc type** under `/guides/`: Styleguide (`/guides/styleguide`) + Component Guide (`/guides/component-guide`) share a doc type, a Block Grid body of `guideSection` wrappers, an auto-derived TOC, and SEO + Guide Visibility controls (no section-nav toggle). Legacy `styleGuidePage` retired; `/styleguide` + `/styleguide/components` 301-redirect (spec: `_specs/shipped/consolidated-guides.md`)

---

## Behaviors

Scenarios are grouped by Rule — the business rule or acceptance criterion that the scenarios prove. Use concrete values (Specification by Example) and business language (Ubiquitous Language). See `.claude/skills/BDD.md` for guidance.

### Rule: One consolidated Guide Page doc type backs both the Styleguide and the Component Guide

```scenario
Scenario: Both guides are the same doc type under /guides/
  Given the Styleguide is published at /guides/styleguide
  And the Component Guide is published at /guides/component-guide
  When a CMS editor inspects each page's document type in the backoffice
  Then both report the "Guide Page" document type (alias guidePage)
  And both are children of the Guides parent
  And both expose the same properties and compositions
```

```scenario
Scenario: The Component Guide is no longer a parent-alias-detected content page
  Given the Component Guide is a Guide Page at /guides/component-guide
  When a visitor loads it
  Then it renders through the Guide Page template
  And no generic "content" page relies on being a child of the Styleguide to pick up guide styling
```

### Rule: The legacy /styleguide URLs 301-redirect to the new /guides/ homes

```scenario
Scenario: A crawler follows an old Styleguide bookmark
  Given a visitor or search engine requests /styleguide
  When the request reaches the site
  Then it receives a 301 redirect to /guides/styleguide
```

```scenario
Scenario: The old Component Guide URL redirects to its new home
  Given a request for /styleguide/components
  When the request reaches the site
  Then it receives a 301 redirect to /guides/component-guide
  And the shorter /styleguide rule does not capture the longer path (longest match wins)
```

```scenario
Scenario: The redirect is forgiving of casing, trailing slashes, and query strings
  Given a request for /StyleGuide?foo=bar&baz=1
  When the request reaches the site
  Then it receives a 301 redirect to /guides/styleguide?foo=bar&baz=1
  And a request for /styleguide/ (trailing slash) also 301s to /guides/styleguide
```

### Rule: A Guide Page offers SEO + search/nav/sitemap controls but no section-navigation toggle

```scenario
Scenario: An editor sets a guide's visibility
  Given an editor is editing the Component Guide page
  When they open its settings
  Then they can set SEO controls (metaName, metaDescription, metaKeywords, isIndexable, isFollowable)
  And they can set "Hide From Top Navigation", "Hide From Search" (umbracoNaviHide), and "Hide From XML Sitemap"
  And there is no "Show section navigation" toggle
  And there is no "Hide from section navigation" toggle
```

```scenario
Scenario: A new Guide Page defaults to hidden from the main top navigation
  Given an editor creates a Guide Page under Guides
  When they save it for the first time without changing the visibility toggle
  Then "Hide From Top Navigation" is already set to true
  And neither the Styleguide nor the Component Guide appears in the site's top navigation
```

### Rule: A Guide Page lays out its body with Block Grid sections

```scenario
Scenario: An editor arranges styleguide sections on a grid
  Given the Styleguide page uses a Block Grid body ([BlockGrid] Guide Body)
  When an editor adds guideSection blocks, gives each a section title, fills each with content blocks, and reorders them
  Then the published Styleguide reflects the new grid arrangement on the next request
  And no code change or deploy is required
```

```scenario
Scenario: The grid body offers only guideSection at the root, with a mandatory title
  Given an editor opens the Guide Page Block Grid palette at the top level
  When they add a block
  Then the only root-level block offered is guideSection
  And each guideSection requires a section title before it can be saved
  And inside a guideSection's content area the shared site blocks (richTextRow, colorPaletteBlock, imageRow, …) are offered
```

### Rule: Each guide renders an auto-derived left-column table of contents

```scenario
Scenario: The TOC links to each on-page section
  Given a guide has sections titled "Alpha Section" and "Beta Section"
  When a visitor loads the guide
  Then the left column shows a TOC with anchors "#alpha-section" and "#beta-section"
  And each anchor resolves to exactly one on-page section id
  And each section heading renders its title
```

```scenario
Scenario: Adding a section updates the TOC without a code change
  Given a guide's TOC lists its current sections
  When an editor (or an agentic workflow) adds a new guideSection with a title and publishes
  Then the left-column TOC includes a new anchor derived from that title
  And the section id and TOC href always agree (both come from one slug map)
  And no code change or deploy was required
```

```scenario
Scenario: Two sections with the same title get distinct anchors
  Given a guide has two sections both titled "Examples"
  When a visitor loads the guide
  Then the two section ids are "examples" and "examples-2"
  And the TOC shows two anchors "#examples" and "#examples-2", each resolving to exactly one section
```

```scenario
Scenario: A single-section guide renders no table of contents
  Given a guide has exactly one section
  When a visitor loads it
  Then the section renders
  And no left-column TOC nav is rendered (the TOC appears only with more than one section)
```

### Rule: The Guides parent page is a wayfinding page linking to all three guide types

```scenario
Scenario: The Guides landing links out to each guide
  Given the Guides parent page is published at /guides/
  When a visitor loads it
  Then the page returns 200 and renders editor-composed pathways to the Styleguide, the Component Guide, and the How-To Guides
  And the how-to guides remain direct children of /guides/ alongside the two consolidated guides
  And the Guides section is hidden from the main top navigation
```

### Rule: The Styleguide showcases the brand's building blocks and patterns

```scenario
Scenario: Each programmatic block exposes an editable heading and intro
  Given a colorPaletteBlock, typographyShowcaseBlock, and generalElementsBlock are placed on the Styleguide
  When a visitor loads /guides/styleguide
  Then each block renders the editor's heading above its programmatic content
  And the swatches, type examples, and elements are still derived from the production CSS
```

```scenario
Scenario: A token annotated with a swatch caption appears as a swatch
  Given the CSS token file contains:
    /**umb_swatch:Primary action / signal red*/
    --accent-primary: #C23D2E;
  When a visitor loads /guides/styleguide
  Then the colorPaletteBlock shows a swatch for "--accent-primary"
  And the swatch displays the value "#C23D2E" and the role "Primary action / signal red"
  And a spacing token like "--space-md" is NOT surfaced as a colour swatch
```

```scenario
Scenario: Typography examples use real CSS so style changes propagate automatically
  Given the Styleguide page contains a typographyShowcaseBlock
  When a visitor loads /guides/styleguide
  Then the block shows a visible h1, h2, h3, h4, h5, and h6 example rendered with the production CSS
  And it shows an example for each editor-available class: .lead, .overline, .blockquote, .caption, .pull-quote, .pull-quote-accent
```

```scenario
Scenario: The general elements block demonstrates real HTML using current CSS
  Given the Styleguide page contains a generalElementsBlock
  When a visitor loads /guides/styleguide
  Then the block contains an example link, button, ordered list, unordered list, table, text input, email input, and textarea
  And each element is rendered with the production CSS
```

### Rule: The Component Guide shows every editor-available block with a description and how-to link when one exists

```scenario
Scenario: Each showcase section carries a live example and a description
  Given the Component Guide is published at /guides/component-guide
  When a visitor loads it
  Then it renders a left-column TOC (it is multi-section)
  And every showcase section contains a rich-text description of the block's purpose
```

```scenario
Scenario: A block that has a how-to guide links to it, with no broken links
  Given a how-to guide exists for the Alert Banner block under /guides/
  When a visitor reaches the Alert Banner section in the Component Guide
  Then the section shows a link to that how-to guide
  And every in-app /guides/ link on the page resolves to a success status (not a 404/500)
```

```scenario
Scenario: Page-composition blocks are excluded from the Component Guide
  Given showcaseHero and pillarSection are page-composition blocks, not portable content specimens
  When a visitor browses the Component Guide
  Then those blocks are intentionally not demonstrated there
```

### Rule: Guide content stays editable by content editors with no deploy

```scenario
Scenario: An editor rewrites a guide section's copy
  Given a guide has a rich-text section reading "Our design system"
  When an editor changes it to "Brand & design reference" and publishes
  Then visiting the guide shows "Brand & design reference"
  And no code change or deploy is required
```

### Rule: Showcase blocks render from one shared, editor-agnostic view

```scenario
Scenario: A showcase block renders identically in Block List and Block Grid
  Given the showcase blocks each have a single view at Views/Partials/blocks/Components/{alias}.cshtml
  When a colorPaletteBlock is placed on a Block List page and inside a Guide Page's Block Grid
  Then it renders the same swatch markup in both places
  And no editor-specific duplicate view or shim file exists for it
```

```scenario
Scenario: The guide's showcase blocks are available in both editors by default
  Given palette membership is admin-configurable with parity as the default
  When a CMS editor opens either a Block List body or a Guide Page Block Grid body
  Then the showcase blocks are offered
  And the render-coverage test confirms each offered block resolves a view in both editors (guideSection is the documented grid-only exception)
```

### Rule: Editor-applied typography classes are exposed in the rich-text Style Select

```scenario
Scenario: Authors can apply editorial classes from the rich-text editor
  Given an author is editing any rich-text field in the backoffice
  When they open the Style Select dropdown in the TipTap toolbar
  Then under the "Editorial" group they see "Lead paragraph", "Overline", "Pull quote", "Pull quote (accent)", and "Caption"
  And the "Headers" group offers Page header (h2), Section header (h3), Paragraph header (h4), Minor header (h5), Fine header (h6)
  And the "Containers" group offers Block quote and Code block
  And applying an editorial entry wraps the selection in a paragraph with the corresponding class on the published page
```

### Rule: Rich-text body content renders within the reading column

```scenario
Scenario: The accent pull-quote is left-aligned behind an accent rule
  Given an author applies "Pull quote (accent)" to a paragraph
  When the content renders
  Then the quote uses the display serif, left-aligned behind a red "--accent-primary" left rule
  And it is constrained to 75% of the reading column, dropping to full width at 760px and below
```

```scenario
Scenario: Editor-inserted images never exceed the container width
  Given an author inserts a high-resolution image into a rich-text field
  When the rich-text block ".richtext" renders
  Then the image is constrained to 100% of the container width with its aspect ratio preserved
```

```scenario
Scenario: Image captions render in the caption style
  Given an author adds a caption to an inserted image (an editor "<figcaption>")
  When the rich-text block renders
  Then the figcaption uses the same muted italic style as the ".caption" class
  And it reads as ancillary to, never more prominent than, body copy
```

---

## Edge Cases

### Rule: The guide pages are robust to missing or unannotated source data

```scenario
Scenario: No annotated tokens means an empty palette, not a broken page
  Given the CSS token file contains tokens but none are annotated with /**umb_swatch:...*/
  When a visitor loads the Styleguide
  Then the colorPaletteBlock renders without crashing
  And it shows an empty-state hint (e.g. "No swatches configured")
```

```scenario
Scenario: An unparseable token value is shown gracefully
  Given a token "--accent-primary: var(--legacy-red);" has a /**umb_swatch:...*/ caption
  When a visitor loads the Styleguide
  Then the swatch for --accent-primary appears
  And it displays the literal value "var(--legacy-red)" rather than a broken color sample
```

```scenario
Scenario: A blank section title still produces a stable, non-degenerate anchor
  Given a guideSection has an empty or whitespace-only title
  When the TOC and section ids are derived
  Then the section receives a synthetic slug ("section", then "section-2", …)
  And no anchor id is empty or starts with a hyphen
```

```scenario
Scenario: A trashed or unpublished section element is skipped, not fatal
  Given a guideSection's content element was trashed while its grid layout entry remains
  When a visitor loads the guide
  Then that entry is skipped from the TOC and body rather than throwing
  And the rest of the page renders normally
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Both guides are the same doc type; compositions correct; no section-nav property | [styleguide.spec.ts:61](../tests/e2e/styleguide.spec.ts#L61) | Covered |
| Guide Page body is a Block Grid | [styleguide.spec.ts:109](../tests/e2e/styleguide.spec.ts#L109) | Covered |
| Grid root offers only guideSection with a mandatory sectionTitle | [styleguide.spec.ts:120](../tests/e2e/styleguide.spec.ts#L120) | Covered |
| Three programmatic block element types exist with heading + intro | [styleguide.spec.ts:142](../tests/e2e/styleguide.spec.ts#L142) | Covered |
| Guide Visibility Controls composition (hideFromTopNavigation / umbracoNaviHide / hideFromXMLSitemap; default-true) | [guides.spec.ts:106](../tests/e2e/guides.spec.ts#L106) | Covered |
| Guides parent allows guidePage + howToGuidePage children; expected compositions | [guides.spec.ts:146](../tests/e2e/guides.spec.ts#L146) | Covered |
| /guides/ returns 200 and renders the landing page | [guides.spec.ts:280](../tests/e2e/guides.spec.ts#L280) | Covered |
| Guides section hidden from main top navigation | [guides.spec.ts:287](../tests/e2e/guides.spec.ts#L287) | Covered |
| /styleguide → 301 /guides/styleguide (+ trailing-slash variant) | [guide-redirects.spec.ts:22](../tests/e2e/guide-redirects.spec.ts#L22), [:28](../tests/e2e/guide-redirects.spec.ts#L28) | Covered |
| /styleguide/components → 301 /guides/component-guide; longest-match wins | [guide-redirects.spec.ts:34](../tests/e2e/guide-redirects.spec.ts#L34), [:60](../tests/e2e/guide-redirects.spec.ts#L60) | Covered |
| Redirect is case-insensitive and preserves the query string | [guide-redirects.spec.ts:48](../tests/e2e/guide-redirects.spec.ts#L48), [:54](../tests/e2e/guide-redirects.spec.ts#L54) | Covered |
| Styleguide reachable at /guides/styleguide + hidden from top nav | [styleguide.spec.ts:175](../tests/e2e/styleguide.spec.ts#L175) | Covered (RED on Dev until canonical content lands — see Deployment / follow-ups) |
| Color palette renders one swatch per annotation with token / value / role | [styleguide.spec.ts:185](../tests/e2e/styleguide.spec.ts#L185) | Covered (canonical-content-gated) |
| Each programmatic block renders its editable heading | [styleguide.spec.ts:202](../tests/e2e/styleguide.spec.ts#L202) | Covered (canonical-content-gated) |
| Typography block shows h1–h6 plus the six editor classes | [styleguide.spec.ts:217](../tests/e2e/styleguide.spec.ts#L217) | Covered (canonical-content-gated) |
| General elements block includes link, button, lists, table, inputs | [styleguide.spec.ts:228](../tests/e2e/styleguide.spec.ts#L228) | Covered (canonical-content-gated) |
| Canonical Styleguide TOC: one anchor per section, each resolving to an id | [styleguide.spec.ts:247](../tests/e2e/styleguide.spec.ts#L247) | Covered (canonical-content-gated) |
| Multi-section guide derives one TOC anchor per section (self-contained fixture) | [styleguide.spec.ts:407](../tests/e2e/styleguide.spec.ts#L407) | Covered |
| A single-section guide renders no TOC | [styleguide.spec.ts:433](../tests/e2e/styleguide.spec.ts#L433) | Covered |
| Duplicate section titles get distinct anchors | [styleguide.spec.ts:441](../tests/e2e/styleguide.spec.ts#L441) | Covered |
| Component Guide reachable at /guides/component-guide + hidden from top nav | [styleguide-components.spec.ts:73](../tests/e2e/styleguide-components.spec.ts#L73), [:79](../tests/e2e/styleguide-components.spec.ts#L79) | Covered (canonical-content-gated) |
| Component Guide renders a left-column TOC (multi-section) | [styleguide-components.spec.ts:86](../tests/e2e/styleguide-components.spec.ts#L86) | Covered (canonical-content-gated) |
| Every showcase section carries a rich-text description | [styleguide-components.spec.ts:98](../tests/e2e/styleguide-components.spec.ts#L98) | Covered (canonical-content-gated) |
| Links to how-to guides where one exists, and no /guides link is broken | [styleguide-components.spec.ts:111](../tests/e2e/styleguide-components.spec.ts#L111) | Covered (canonical-content-gated) |
| Slugify produces a stable slug (punctuation, casing, spacing, non-ASCII) | [GuideTocTests.cs:14](../tests/UmbracoProject.Tests/GuideTocTests.cs#L14) | Covered |
| Duplicate titles de-dupe to `examples` / `examples-2` / `examples-3` | [GuideTocTests.cs:20](../tests/UmbracoProject.Tests/GuideTocTests.cs#L20), [:28](../tests/UmbracoProject.Tests/GuideTocTests.cs#L28) | Covered |
| Blank titles get stable, non-degenerate synthetic slugs | [GuideTocTests.cs:43](../tests/UmbracoProject.Tests/GuideTocTests.cs#L43), [:51](../tests/UmbracoProject.Tests/GuideTocTests.cs#L51) | Covered |
| A showcase block renders identically in Block List and Block Grid (guideSection is the grid-only exception) | [BlockRenderCoverageTests.cs](../tests/UmbracoProject.Tests/BlockRenderCoverageTests.cs), [blockParity.spec.ts](../tests/e2e/blocks/blockParity.spec.ts) | Covered |
| Editing the brand summary / a guide section's copy updates the live page | — | Manual QA — Umbraco-native editability; no regression risk |
| Changing a CSS token / typography class value updates the showcase on next load | — | Manual QA — colorPaletteBlock / typographyShowcaseBlock re-read the CSS per request; fixture CSS mutation skipped per original plan |
| Authors can apply editorial classes from the rich-text Style Select | — | Manual QA — Style Menu manifest in [richtext/manifest.ts](../src/HelloWorld/Client/src/richtext/manifest.ts) (`overwrites: 'Umb.Tiptap.Toolbar.StyleSelect'`); [dropdownStyles.css](../src/UmbracoProject/wwwroot/css/dropdownStyles.css) loaded into the editor iframe |
| Accent pull-quote layout / RTE image + caption styling | — | Manual QA — layout in [typography.css](../src/UmbracoProject/wwwroot/assets/css/typography.css); visibility asserted by [styleguide.spec.ts:217](../tests/e2e/styleguide.spec.ts#L217) |
| Empty palette / unparseable token render gracefully | — | Skipped — implementation-coupled; empty-state + literal-value fallback in [colorPaletteBlock.cshtml](../src/UmbracoProject/Views/Partials/blocks/Components/colorPaletteBlock.cshtml) |
| Trashed/unpublished section element is skipped, not fatal | — | Guarded in [guidePage.cshtml](../src/UmbracoProject/Views/guidePage.cshtml) and `GuideToc.BuildSlugMap`; not separately automated |

---

## Deployment / follow-ups

- **Cloud content-before-schema.** The legacy `styleGuidePage` doc-type deletion (shipped locally) only applies safely on a Cloud environment once that environment's published `/styleguide` + `/styleguide/components` **content** has been removed there first — content flows local → Live, and Dev is mirrored from Live. Until then the environment keeps the old nodes; the `GuideRedirectMiddleware` 301s cover the old URLs throughout, so visitors are never 404'd during the transition.
- **Screenshot baselines are the pixel gate, still pending.** The guide-page and retargeted-block Linux screenshot baselines must be regenerated via `update-snapshots.yml` once the canonical Styleguide/Component-Guide content reaches Dev. Until the content is present on Dev, the canonical-content + screenshot E2E specs (the rows marked "canonical-content-gated" above) read RED on Dev — this is expected, not a regression, and clears when Step 6's content lands and the baselines are regenerated.

---

## Revision Notes

- 2026-04-29: Draft scenarios from initial spec; realigned to `typography.css` + `/**umb_swatch:LABEL*/` convention.
- 2026-04-30 / 2026-05-01: Block-driven architecture — three programmatic block element types (`colorPaletteBlock`, `typographyShowcaseBlock`, `generalElementsBlock`) replaced the hardcoded sections; components page added at `/styleguide/components`.
- 2026-07-11: Blog content styles — added the `.pull-quote-accent` rich-text style; constrained RTE-inserted images and applied `.caption` to image `<figcaption>`s.
- 2026-07-16: Block editor parity — showcase blocks render from one shared, editor-agnostic view bound to `IBlockReference<IPublishedElement, IPublishedElement>`; render-coverage xUnit test gates that every offered block resolves a view in both editors.
- 2026-05-11: Rich-text Style Select rebuilt as a TipTap `styleMenu` extension manifest (`overwrites: 'Umb.Tiptap.Toolbar.StyleSelect'`); editor-iframe preview stylesheet resynced.
- 2026-07-24: **Consolidation onto `guidePage` (spec: `_specs/shipped/consolidated-guides.md`, shipped 2026-07-22 → 2026-07-24).** The Styleguide and Component Guide are now two instances of **one `guidePage` doc type** under the `Guides` parent (`/guides/styleguide`, `/guides/component-guide`), replacing the legacy root-level `styleGuidePage` (retired) and the `content`-page-under-styleguide Component Guide (which was detected by a parent-alias string in `content.cshtml`). Each guide's body is a **Block Grid** (`[BlockGrid] Guide Body`) of top-level `guideSection` wrappers — each a mandatory `sectionTitle` plus a content area holding the shared editor-agnostic blocks — and the **TOC is auto-derived** from those titles via a single dedup-aware slug map (`GuideToc.BuildSlugMap` → `_GuideToc.cshtml`), so section `<section id>` and TOC `href` always agree, duplicate titles get distinct anchors, and the nav appears only with more than one section. The control surface composes **SEO Controls** + **Guide Visibility Controls** (hideFromTopNavigation / umbracoNaviHide "Hide From Search" / hideFromXMLSitemap) and drops the section-navigation toggle entirely (`showSectionNavigation` / `hideFromSectionNavigation` are absent). Legacy `/styleguide` and `/styleguide/components` **301-redirect** to the new homes via `GuideRedirectMiddleware` (case-insensitive, trailing-slash tolerant, query preserved, longest-match wins). The Component Guide demonstrates every editor-available Guide-Body block with a rich-text description and a how-to link where one exists; page-composition blocks (`showcaseHero`, `pillarSection`) are intentionally excluded. Art direction (block-grid-css-portability increment): the grid body is constrained to the `.styleguide` reading container (780px, no longer full-bleed), sections use the `.styleguide__section-anchor` rhythm, and the heading hierarchy is resolved (section title `h2` dominant, block headings subordinate). How-to guides are untouched — they remain direct children of `/guides/` and the `guide-generator` CLI / `howToGuidePage` / `generationMetadata` contract is unchanged. Behaviors, Edge Cases, and Test Coverage rewritten against the shipped `guidePage`; the URL-stability scenario in `_features/editor-how-to-guides.md` was revised to the redirect behavior. See **Deployment / follow-ups** for the Cloud content-before-schema and screenshot-baseline caveats.
