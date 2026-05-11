# Feature: Living Style Guide

A `/styleguide` page acts as a self-updating brand and design reference for site admins, content authors, and new contributors. The page is **composed in the CMS from blocks** so editors can reorder sections, retitle them, and add narrative copy around the programmatic content. Three "programmatic" blocks (`colorPaletteBlock`, `typographyShowcaseBlock`, `generalElementsBlock`) read live from the production CSS so design-system changes propagate automatically. A child `/styleguide/components` page, also assembled in the CMS, demonstrates each reusable content block by example.

**Source spec**: `_specs/living-style-guide.md`
**Last verified**: 2026-05-01 (E2E suite green — see [Test Coverage](#test-coverage) below)

---

## Behaviors

Scenarios are grouped by Rule — the business rule or acceptance criterion that the scenarios prove. Use concrete values (Specification by Example) and business language (Ubiquitous Language). See `.claude/skills/BDD.md` for guidance.

### Rule: The styleguide page is composed of editor-arrangeable blocks

```scenario
Scenario: Editors compose the styleguide from blocks in the CMS
  Given the styleguide page exists at /styleguide
  And it has a top-level brand summary field plus a sectionRows block list
  When a CMS editor adds, reorders, or removes section rows containing showcase blocks (colorPaletteBlock, typographyShowcaseBlock, generalElementsBlock, richTextRow)
  Then the rendered /styleguide page reflects the editor's arrangement on the next request
  And no code change or deploy is required
```

```scenario
Scenario: Each programmatic block exposes an editable heading and intro
  Given a colorPaletteBlock is placed on the styleguide page with heading "Color Palette" and a rich-text intro
  When a visitor loads /styleguide
  Then the rendered block shows the editor's heading above the swatches
  And the editor's intro rich-text appears between the heading and the swatches
  And the swatches themselves are still derived from typography.css
```

### Rule: CMS editors can edit the brand summary text without code changes

```scenario
Scenario: Editing the brand summary updates the live page
  Given the styleguide page exists at /styleguide
  And the brand summary currently reads "Honest human–AI collaboration"
  When a CMS editor changes the brand summary to "Editorial precision and craft consciousness" and publishes
  Then visiting /styleguide shows "Editorial precision and craft consciousness" near the top of the page
  And no code change or deploy is required
```

```scenario
Scenario: An empty brand summary is omitted gracefully
  Given the styleguide page has an empty brand summary
  When a visitor loads /styleguide
  Then no empty .styleguide__brand-summary panel renders above the section rows
  And the section rows below render normally
```

### Rule: The color palette is derived from CSS tokens at render time

```scenario
Scenario: A token annotated with a swatch caption appears as a swatch
  Given the CSS token file contains:
    /**umb_swatch:Primary action / signal red*/
    --accent-primary: #C23D2E;
  When a visitor loads /styleguide
  Then the colorPaletteBlock shows a swatch labelled "--accent-primary"
  And the swatch displays the value "#C23D2E"
  And the swatch caption reads "Primary action / signal red"
  And the visible color sample matches #C23D2E
```

```scenario
Scenario: A token without a swatch caption is excluded
  Given the CSS token file contains a token "--space-md: 1rem;" with no umb_swatch annotation
  When a visitor loads /styleguide
  Then no swatch for "--space-md" appears in the colorPaletteBlock
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
  Given the styleguide page contains a typographyShowcaseBlock
  When a visitor loads /styleguide
  Then the block contains a visible h1, h2, h3, h4, h5, and h6 example
  And each heading is rendered with the production CSS for that level
```

```scenario
Scenario: Editor-available text classes render with their actual styles
  Given the curated editor-available class list is .lead, .overline, .blockquote, .caption, .pull-quote
  When a visitor loads /styleguide
  Then the typographyShowcaseBlock shows an example for each class rendered with its production CSS
```

```scenario
Scenario: Updating a typography class in CSS is reflected in the styleguide
  Given the styleguide currently renders ".lead" at 1.25rem
  When a developer changes .lead's font-size to "1.4rem" in CSS and reloads the page
  Then the .lead example in the typographyShowcaseBlock renders at 1.4rem
```

### Rule: The general elements block demonstrates real HTML using current CSS

```scenario
Scenario: Links, buttons, lists, tables, and form controls are visible
  Given the styleguide page contains a generalElementsBlock
  When a visitor loads /styleguide
  Then the block contains an example link, button, ordered list, unordered list, table, and form input
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
  When they reach the section row containing the components-reference link
  Then they see a visible link to /styleguide/components
  And following the link takes them to the /styleguide/components page
```

### Rule: Editor-applied typography classes are exposed in the rich-text Style Select

```scenario
Scenario: Authors can apply editorial classes from the rich-text editor
  Given an author is editing any rich-text field in the backoffice
  When they open the Style Select dropdown in the TipTap toolbar
  Then under the "Editorial" group they see "Lead paragraph", "Overline", "Pull quote", and "Caption"
  And the "Headers" group offers Page header (h2), Section header (h3), Paragraph header (h4), Minor header (h5), Fine header (h6)
  And the "Containers" group offers Block quote and Code block
  And applying an editorial entry wraps the selection in a paragraph with the corresponding class on the published page
```

---

## Edge Cases

### Rule: The styleguide page is robust to missing or unannotated source data

```scenario
Scenario: No annotated tokens means an empty palette, not a broken page
  Given the CSS token file contains tokens but none are annotated with /**umb_swatch:...*/
  When a visitor loads /styleguide
  Then the colorPaletteBlock renders without crashing
  And it shows an empty-state hint (e.g. "No swatches configured")
```

```scenario
Scenario: An unparseable token value is shown gracefully
  Given a token "--accent-primary: var(--legacy-red);" has a /**umb_swatch:...*/ caption
  When a visitor loads /styleguide
  Then the swatch for --accent-primary appears
  And it displays the literal value "var(--legacy-red)" rather than a broken color sample
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Editors compose the styleguide from blocks in the CMS | [styleguide.spec.ts:126](../tests/e2e/styleguide.spec.ts#L126) (composition + sectionRows), [:184](../tests/e2e/styleguide.spec.ts#L184) (3 element types exist), [:288](../tests/e2e/styleguide.spec.ts#L288) (block rendering) | Covered |
| Each programmatic block exposes an editable heading and intro | [styleguide.spec.ts:184](../tests/e2e/styleguide.spec.ts#L184) (schema), [:288](../tests/e2e/styleguide.spec.ts#L288) (rendered heading) | Covered |
| Editing the brand summary updates the live page | — | Manual QA — covered by the [verification section](../_plans/living-style-guide.md#verification) of the original plan |
| An empty brand summary is omitted gracefully | — | Not yet automated — `if (hasSummary)` guard in [styleGuidePage.cshtml](../src/UmbracoProject/Views/styleGuidePage.cshtml); manual QA |
| A token annotated with a swatch caption appears as a swatch | [styleguide.spec.ts:240](../tests/e2e/styleguide.spec.ts#L240) | Covered |
| A token without a swatch caption is excluded | [styleguide.spec.ts:240](../tests/e2e/styleguide.spec.ts#L240) (same test asserts `--space-md` absent) | Covered |
| Changing a token value updates the swatch on next page load | — | Manual QA — implementation re-reads `typography.css` per request via [SwatchTokenParser.cs](../src/UmbracoProject/Helpers/SwatchTokenParser.cs); E2E mutation of fixture CSS skipped per original plan |
| Heading examples render with live CSS | [styleguide.spec.ts:305](../tests/e2e/styleguide.spec.ts#L305) | Covered |
| Editor-available text classes render with their actual styles | [styleguide.spec.ts:305](../tests/e2e/styleguide.spec.ts#L305) (asserts `.lead`, `.overline`, `.blockquote`, `.caption`, `.pull-quote`) | Covered |
| Updating a typography class in CSS is reflected in the styleguide | — | Manual QA — same rationale as the swatch-mutation scenario |
| Links, buttons, lists, tables, and form controls are visible | [styleguide.spec.ts:316](../tests/e2e/styleguide.spec.ts#L316) | Covered |
| Components page lists each block with a label, grouped by category | [styleguide-components.spec.ts:638](../tests/e2e/styleguide-components.spec.ts#L638) (section row order), [:644](../tests/e2e/styleguide-components.spec.ts#L644) (label per block), [:665](../tests/e2e/styleguide-components.spec.ts#L665) (text), [:685](../tests/e2e/styleguide-components.spec.ts#L685) (media), [:695](../tests/e2e/styleguide-components.spec.ts#L695) (lists) | Covered |
| Styleguide links to the components page | [styleguide.spec.ts:335](../tests/e2e/styleguide.spec.ts#L335) (link visible), [styleguide-components.spec.ts:707](../tests/e2e/styleguide-components.spec.ts#L707) (link click navigates) | Covered |
| Authors can apply editorial classes from the rich-text editor | — | Manual QA — Style Menu manifest in [richtext/manifest.ts](../src/HelloWorld/Client/src/richtext/manifest.ts) (alias `Site.Tiptap.Toolbar.StyleSelect`, `overwrites: 'Umb.Tiptap.Toolbar.StyleSelect'` so the built-in toolbar entry is replaced without any data-type edit); [dropdownStyles.css](../src/UmbracoProject/wwwroot/css/dropdownStyles.css) is loaded into the editor iframe for in-editor preview |
| No annotated tokens means an empty palette, not a broken page | — | Skipped — too implementation-coupled (would require fixture CSS mutation); empty-state hint is in place in [colorPaletteBlock.cshtml](../src/UmbracoProject/Views/Partials/blocklist/Components/colorPaletteBlock.cshtml) |
| An unparseable token value is shown gracefully | — | Skipped — same rationale; literal-value fallback is implemented in [colorPaletteBlock.cshtml](../src/UmbracoProject/Views/Partials/blocklist/Components/colorPaletteBlock.cshtml) |

---

## Revision Notes

- 2026-04-29: Draft scenarios from initial spec
- 2026-04-29: Updated to reflect resolved spec decisions — components page is a child at `/styleguide/components`, blocks grouped by category (text → media → lists), each preceded by a Rich Text Row label
- 2026-04-29: Realigned to typography.css + /**umb_swatch:LABEL**/ convention during planning.
- 2026-04-30: Plan Steps 7–8 shipped. Test Coverage table refreshed against the live E2E suite (16 tests across both specs); doc-type / element-type ids resolved dynamically per Step 8.
- 2026-05-01: Architecture change. The styleguide page is now block-driven: three new programmatic block element types (`colorPaletteBlock`, `typographyShowcaseBlock`, `generalElementsBlock`) replace the hardcoded sections. `brandSummary` stays as a top-level field. The Footer Controls composition was dropped (the global footer is rendered from Home, not per-page). `.lead` and `.pull-quote` were added to the TipTap Style Select dropdown. Behaviors and Test Coverage rewritten against the new structure (19 tests now passing).
- 2026-05-11: Rich-text Style Select rebuilt as a TipTap `styleMenu` extension manifest (TipTap doesn't parse the TinyMCE `/**umb_name:Label*/` annotation). Added `Overline`, `Caption`, `Minor header` (h5), `Fine header` (h6) entries alongside the existing Headers / Editorial / Containers groups. The manifest declares `overwrites: 'Umb.Tiptap.Toolbar.StyleSelect'`, so the built-in entry is replaced in-place — no data type edit needed. Editor-iframe preview stylesheet `dropdownStyles.css` resynced with `typography.css` (the TipTap editor prepends its `/css` root path, so the persisted `/dropdownStyles.css` value resolves correctly to `/css/dropdownStyles.css`).
