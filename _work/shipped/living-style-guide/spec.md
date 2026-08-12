# Spec for Living Style Guide

> This spec captures initial requirements and design rationale. For **current system behavior**, see `_features/living-style-guide.md`.
>
> **2026-05-01 update**: the implementation moved from a hardcoded 5-section template to a **block-driven page** authored from the CMS. Three new programmatic block element types (`colorPaletteBlock`, `typographyShowcaseBlock`, `generalElementsBlock`) replace the rigid sections. `brandSummary` stays as a top-level rich-text field. The "Brand summary" / "Color palette" / "Typography" / "General elements" / "Components reference" sections below describe the *content domain*, not the rendering structure — editors can now reorder, retitle, and add narrative copy around the programmatic blocks. See [_features/living-style-guide.md](../_features/living-style-guide.md) for current behavior and the Revision Notes there for the architecture rationale.

branch: claude/feature/living-style-guide

## Summary

A `/styleguide` page in the CMS site that serves as a brand and design reference for site admins, content authors, and new contributors. The page is "living" — colors and typography are rendered from the actual CSS so that visual changes to the design system propagate automatically. Brand summary text is editable in the CMS so editorial intent can evolve without code changes. A child `/styleguide/components` page, assembled in the CMS with real Block List blocks, demonstrates each reusable content block by example.

This is the user-facing reference — a self-updating "what does our brand look and sound like" page that a new author can read in five minutes and a designer can spot-check after CSS changes.

Phase 0 discovery is captured in [_plans/notes/living-style-guide-discovery.md](_plans/notes/living-style-guide-discovery.md). Key decisions already made:

- **Colors are CSS-first.** Swatches are derived from CSS custom properties at render time. Human-readable role captions live as inline metadata comments in the canonical token file (`typography.css`).
- **The components page uses Block List**, not Block Grid. Block Grid will get its own trial on a layout that actually wants 2D composition.
- **A new "Style Guide Page" document type** is introduced (with a brand-summary rich-text property) rather than reusing an existing Content Page. The components page can reuse the existing Content Page document type with a Block List property.
- **The components page lives as a child of the styleguide page** at `/styleguide/components`, not as a sibling under Home.
- **Both pages are hidden from the main site nav** but reachable by direct URL.
- **Exposing additional typographic classes in the TipTap class-picker dropdown is out of scope** — handled in a separate small spec.

## Functional Requirements

### /styleguide page

- A new page exists at `/styleguide` in the site's published content tree
- The page has the following sections, in order:
  1. **Brand summary** — short editorial intro describing voice, tone, visual intent
  2. **Color palette** — visual swatches grouped by semantic role
  3. **Typography** — HTML heading levels and editor-available text styles, rendered with their actual CSS
  4. **General elements** — links, buttons, lists (ordered, unordered), tables, basic form controls
  5. **Components reference** — heading + visible link to the child `/styleguide/components` page
- The styleguide page is rendered by a new "Style Guide Page" document type with a brand-summary rich-text property
- The brand summary section is CMS-editable rich text. CMS editors can change the wording, headings, and inline emphasis without code changes
- The color palette section reads token values from `typography.css` (the canonical production token file) at render time. When the CSS file is changed and the page is reloaded, the swatch values reflect the new CSS
- Each color swatch displays: visible color sample, token name (e.g. `--accent-primary`), the resolved value (e.g. `#C23D2E`), and a role caption (e.g. "Primary action / signal red")
- The role caption per swatch is sourced from an inline metadata comment associated with the token in the CSS file, using the same terse convention as `dropdownStyles.css`: `/**umb_swatch:LABEL**/` (single line, bare label after the colon, no quotes)
- Tokens not annotated with the metadata comment are excluded from the styleguide swatch grid (this lets us scope the displayed palette without listing every single token)
- The typography section renders one live example per HTML heading level (h1–h6) and per curated editor-available text class. The initial curated set is the conservative candidates: `.lead`, `.overline`, `.blockquote`, `.caption`, `.pull-quote`. (Editorially-applied classes such as `.kicker`, `.ai-authored`, `.ai-assisted` are not shown in the initial release.)
- Typography examples render with the production CSS — the same classes a content author can apply in their content
- The general elements section uses real HTML (`<a>`, `<button>`, `<ul>`, `<ol>`, `<table>`, `<input>`) so its appearance reflects current CSS
- Visitors can navigate from the top of the page to each section. The exact pattern (anchored top-of-page list, sticky sub-nav, etc.) is decided during implementation using the `frontend-design` skill

### /styleguide/components page

- A new page exists at `/styleguide/components` (child of `/styleguide`) in the site's published content tree, linked from `/styleguide`
- The page reuses the existing Content Page document type and is assembled in the CMS using the existing Block List property (no new document type, no new property editor)
- The page contains, at minimum, one instance of each "showcaseable" block per the discovery audit, **grouped by category** (text → media → lists) in the following order:
  - **Text:** Rich Text Row, Code Snippet Row, Alert Banner
  - **Media:** Image Row, Image Carousel Row, Video Row
  - **Lists:** Latest Articles Row
- Each block is preceded by a Rich Text Row acting as a label/lead-in. The Rich Text Row holds the block's display name as a heading and optional editor notes/context (so CMS editors can annotate why a block is used or how it behaves without code changes)
- The page renders block content using the existing block dispatch (`Views/Partials/blocklist/default.cshtml`) — no per-block visual changes
- `iconLinkRow` is omitted (it is a sub-block typically composed within other blocks, not a standalone showcase candidate)

### Content authoring

- The styleguide page is intended to be created and maintained by a CMS editor, not regenerated by code on each deploy
- A single root-level styleguide page is sufficient (no localized variants required initially)
- Both pages are excluded from main site navigation but reachable by direct URL

### Caching & performance

- The styleguide page may participate in the site's normal cached-partial pattern (e.g. `Html.CachedPartialAsync()`); real-time CSS-token reflection is not required for end users. Developers iterating on tokens locally can clear the cache to verify changes
- A print stylesheet is out of scope for this release

## Possible Edge Cases

- A CSS token has the swatch metadata comment but its value cannot be parsed as a color (e.g. it's a CSS variable reference like `var(--accent-primary)`). The styleguide should resolve aliases where possible or display the raw value gracefully without breaking the swatch grid
- The CSS token file is missing or empty at render time. The colors section should render an empty state (or a clear "no swatches available" hint) rather than crashing the page
- A CMS editor leaves the brand summary rich-text property empty. The page should still render the section heading without an empty white block
- A content author adds a new block component to the codebase but forgets to add it to the `/styleguide/components` page. Spec does not require auto-discovery — manual addition is the expected workflow
- The `/styleguide/components` page is unpublished. The link from `/styleguide` should still render but lead to a 404 / unpublished state — flag in QA but not block on it
- Browser zoom or prefers-color-scheme dark mode changes the visual rendering of swatches. The styleguide should remain legible in both modes
- A token file has duplicate metadata comments for the same caption. The page should not deduplicate silently — surface the issue obviously to whoever reviews the rendered page

## Acceptance Criteria

- [ ] A published page exists at `/styleguide` with the five sections in the order specified above
- [ ] CMS editors can edit the brand summary section's rich-text content via the backoffice and the changes appear on the published page
- [ ] The color palette section displays one swatch per CSS token annotated with the swatch metadata comment, showing token name, resolved value, and role caption
- [ ] Changing a token's value in the CSS file (without code changes) is reflected in the rendered styleguide on the next page load
- [ ] The typography section shows live examples of `h1`–`h6` and the curated editor-available text classes, rendered with the production CSS classes
- [ ] The general elements section visually demonstrates links, buttons, lists, tables, and basic form controls using real HTML and current CSS
- [ ] The styleguide page contains a visible link to `/styleguide/components`
- [ ] A published page exists at `/styleguide/components` (as a child of `/styleguide`) assembled in the CMS using Block List on the existing Content Page document type
- [ ] The `/styleguide/components` page contains one instance of each showcase block (alertBanner, codeSnippetRow, imageCarouselRow, imageRow, latestArticlesRow, richTextRow, videoRow), grouped by category (text → media → lists), each preceded by a Rich Text Row label
- [ ] The styleguide page is rendered by a new "Style Guide Page" document type
- [ ] Both `/styleguide` and `/styleguide/components` are hidden from the main site navigation
- [ ] Tokens not annotated with the metadata comment do not appear as swatches
- [ ] The styleguide page renders without errors when the brand summary rich text is empty
- [ ] The styleguide page renders without errors when no CSS tokens are annotated with the swatch metadata comment

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples. These will be verified and refined after implementation.

### Rule: CMS editors can edit the brand summary text without code changes

```scenario
Scenario: Editing the brand summary updates the live page
  Given the styleguide page exists at /styleguide
  And the brand summary currently reads "Honest human–AI collaboration"
  When a CMS editor changes the brand summary to "Editorial precision and craft consciousness" and publishes
  Then visiting /styleguide shows "Editorial precision and craft consciousness" in the brand summary section
  And no code change or deploy is required
```

```scenario
Scenario: An empty brand summary renders the section heading without a blank panel
  Given the styleguide page has an empty brand summary
  When a visitor loads /styleguide
  Then the "Brand summary" section heading is visible
  And the body of the section is collapsed or shows no empty white block
```

### Rule: The color palette is derived from CSS tokens at render time

```scenario
Scenario: A token annotated with a swatch caption appears as a swatch
  Given the CSS token file contains:
    /**umb_swatch:Primary action / signal red*/
    --accent-primary: #C23D2E;
  When a visitor loads /styleguide
  Then the color palette shows a swatch labelled "--accent-primary"
  And the swatch displays the value "#C23D2E"
  And the swatch caption reads "Primary action / signal red"
  And the visible color sample matches #C23D2E
```

```scenario
Scenario: A token without a swatch caption is excluded
  Given the CSS token file contains a token "--space-md: 1rem;" with no umb_swatch annotation
  When a visitor loads /styleguide
  Then no swatch for "--space-md" appears in the color palette section
```

```scenario
Scenario: Changing a token value updates the swatch on next page load
  Given the styleguide currently renders --accent-primary as "#C23D2E"
  When a developer changes --accent-primary to "#B83A2C" in the CSS file and reloads the page
  Then the swatch for --accent-primary displays "#B83A2C"
  And the visible color sample matches #B83A2C
```

### Rule: Typography examples use real CSS so style changes propagate automatically

```scenario
Scenario: Heading examples render with live CSS
  Given the styleguide page is published
  When a visitor loads /styleguide
  Then the typography section contains a visible h1, h2, h3, h4, h5, and h6 example
  And each heading is rendered with the production CSS for that level
```

```scenario
Scenario: Editor-available text classes render with their actual styles
  Given the curated editor-available class list includes ".lead" and ".overline"
  When a visitor loads /styleguide
  Then the typography section shows an example paragraph with class "lead" rendered with .lead's CSS
  And an example with class "overline" rendered with .overline's CSS
```

```scenario
Scenario: Updating a typography class in CSS is reflected in the styleguide
  Given the styleguide currently renders ".lead" at 1.25rem
  When a developer changes .lead's font-size to "1.4rem" in CSS and reloads the page
  Then the .lead example in the typography section renders at 1.4rem
```

### Rule: The general elements section demonstrates real HTML using current CSS

```scenario
Scenario: Links, buttons, lists, tables, and form controls are visible
  When a visitor loads /styleguide
  Then the general elements section contains an example link, button, ordered list, unordered list, table, and form input
  And each element is rendered with the production CSS
```

### Rule: A child /styleguide/components page demonstrates every showcase block

```scenario
Scenario: Components page lists each block with a label, grouped by category
  Given the /styleguide/components page is published and assembled with Block List
  When a visitor loads /styleguide/components
  Then they see the showcase blocks grouped in this order: text (richTextRow, codeSnippetRow, alertBanner), media (imageRow, imageCarouselRow, videoRow), lists (latestArticlesRow)
  And each block is preceded by a Rich Text Row containing the block's display name as a heading
```

```scenario
Scenario: Styleguide links to the components page
  Given a visitor is on /styleguide
  When they reach the "Components reference" section
  Then they see a visible link to /styleguide/components
  And following the link takes them to the /styleguide/components page
```

### Rule: The styleguide page is robust to missing or unannotated source data

```scenario
Scenario: No annotated tokens means an empty palette, not a broken page
  Given the CSS token file contains tokens but none are annotated with /**umb_swatch:...*/
  When a visitor loads /styleguide
  Then the color palette section renders without crashing
  And it shows an empty-state hint (e.g. "No swatches configured")
```

```scenario
Scenario: An unparseable token value is shown gracefully
  Given a token "--accent-primary: var(--legacy-red);" has a /**umb_swatch:...*/ caption
  When a visitor loads /styleguide
  Then the swatch for --accent-primary appears
  And it displays the literal value "var(--legacy-red)" rather than a broken color sample
```

## Resolved Decisions

All initial open questions have been answered and folded into the relevant sections above. Recorded here for traceability:

- **In-page navigation pattern:** TBD during implementation — use the `frontend-design` skill to determine the best UX. The page is short enough that a top-of-page anchor list may be sufficient, but the visual treatment is a design call.
- **Token source file location:** swatch metadata lives in the production token file `typography.css` directly (rather than a separate display-only token file). Simpler, with the trade-off of coupling a display concern to production CSS.
- **Curated editor-class list for typography:** start with the conservative candidates flagged in discovery — `.lead`, `.overline`, `.blockquote`, `.caption`, `.pull-quote`. Editorially-applied classes (`.kicker`, `.ai-authored`, `.ai-assisted`) are deferred.
- **Components page block ordering:** grouped by category (text → media → lists), not alphabetical.
- **Block label format:** each block is preceded by a Rich Text Row label. This allows CMS editors to add context or notes per block without code changes.
- **Page hierarchy:** `/styleguide/components` is a child of `/styleguide`, not a sibling under Home.
- **Document type design:** create a new "Style Guide Page" document type for `/styleguide` (with the brand-summary rich-text property). The components page reuses the existing Content Page document type.
- **Backoffice/site nav exclusion:** yes — both pages are hidden from the main site nav.
- **Caching:** the styleguide page may use the standard cached-partial pattern. Users do not need real-time CSS updates; developers can clear the cache to verify token changes locally.
- **Print stylesheet:** out of scope for this release.

## Testing Guidelines

Create a Playwright E2E test file at `tests/e2e/styleguide.spec.ts` (and optionally `tests/e2e/styleguide-components.spec.ts`). Cover, without going too heavy:

- The styleguide page renders at `/styleguide` and contains the five named sections in order
- The brand summary section displays whatever rich text is currently published in the CMS (use a known fixture value set in `beforeAll`)
- The color palette section shows at least one swatch with a visible color sample, token name, resolved value, and role caption
- A token modified in CSS pre-test is reflected in the rendered swatch (skip if too implementation-specific — rely on unit-test parsing instead)
- The typography section contains live `h1`–`h6` examples
- The general elements section contains a visible link, button, list, table, and form input
- The styleguide page contains a visible anchor link to `/styleguide/components`
- The `/styleguide/components` page renders and contains a labelled instance of each showcase block alias, in the grouped order (text → media → lists)

Per the project's E2E resilience rules: do not hardcode document UUIDs; look them up dynamically. Do not assume URL slugs — fetch the actual `urls` value from the document API after publish. Clean up any pre-existing test pages by name prefix in `beforeAll` to avoid `-2` slug collisions.

For the CSS-token-parsing logic, prefer **unit tests** over E2E (parsing CSS is internal logic, not user-observable behavior). The E2E tests should assert "swatches appear" and "values match the CSS"; unit tests should cover edge cases (missing annotations, unparseable values, alias resolution).
