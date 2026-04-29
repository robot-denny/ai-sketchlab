# Feature: Living Style Guide

> **Draft** — These scenarios have not yet been verified against an implementation. They will be refined during planning and verified after implementation.

A `/styleguide` page acts as a self-updating brand and design reference for site admins, content authors, and new contributors. Colors and typography render from the actual CSS so design-system changes propagate automatically. A child `/styleguide/components` page, assembled in the CMS using real Block List blocks, demonstrates each reusable content block by example.

**Source spec**: `_specs/living-style-guide.md`
**Last verified**: —

---

## Behaviors

Scenarios are grouped by Rule — the business rule or acceptance criterion that the scenarios prove. Use concrete values (Specification by Example) and business language (Ubiquitous Language). See `.claude/skills/BDD.md` for guidance.

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

---

## Edge Cases

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

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Editing the brand summary updates the live page | — | Not covered |
| An empty brand summary renders the section heading without a blank panel | — | Not covered |
| A token annotated with a swatch caption appears as a swatch | — | Not covered |
| A token without a swatch caption is excluded | — | Not covered |
| Changing a token value updates the swatch on next page load | — | Not covered |
| Heading examples render with live CSS | — | Not covered |
| Editor-available text classes render with their actual styles | — | Not covered |
| Updating a typography class in CSS is reflected in the styleguide | — | Not covered |
| Links, buttons, lists, tables, and form controls are visible | — | Not covered |
| Components page lists each block with a label, grouped by category | — | Not covered |
| Styleguide links to the components page | — | Not covered |
| No annotated tokens means an empty palette, not a broken page | — | Not covered |
| An unparseable token value is shown gracefully | — | Not covered |

---

## Revision Notes

- 2026-04-29: Draft scenarios from initial spec
- 2026-04-29: Updated to reflect resolved spec decisions — components page is a child at `/styleguide/components`, blocks grouped by category (text → media → lists), each preceded by a Rich Text Row label
- 2026-04-29: Realigned to typography.css + /**umb_swatch:LABEL**/ convention during planning.
