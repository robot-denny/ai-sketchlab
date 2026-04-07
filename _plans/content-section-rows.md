# Plan: Content Section Rows

**Spec**: `_specs/content-section-rows.md`
**Branch**: `claude/feature/content-section-rows`

## Context

Content editors need the ability to add styled section rows below the main content area on Content, Article, and Documentation pages. Each row wraps a block list with optional background color treatment (none / light / accent) and a choice of background width (full-bleed or container-constrained). The content inside is always capped at container max-width. Rows also support an optional heading with a configurable HTML level.

This builds on the existing block list pattern: `Content Controls` composition already holds `contentRows` (block list), and element types live in the `Elements/Content Models` and `Elements/Setting Models` folders. The three page templates (`content.cshtml`, `article.cshtml`, `documentation.cshtml`) each render `@Html.GetBlockListHtml(Model.ContentRows)` inside an `<article><div class="container">` wrapper — section rows will be rendered **outside** that container, directly after it inside `<article>`.

---

## Key Decisions

- **New composition `Section Row Controls`** rather than adding `sectionRows` directly to each document type: keeps the property in one place, matches the pattern of Content Controls / SEO Controls / Header Controls. Will be added to Content, Article, and Documentation document types.

- **Reuse `[BlockList] Main Content`** for `sectionContent` inside each row: the spec says "any existing block list components" — there is no reason to maintain a duplicate data type. If the content block allowlist changes in the future, it changes in one place.

- **Settings model carries background + spacing; content model carries title + content**: follows the established pattern where visual/layout options live in the settings model (composed with `Spacing Properties`) and editorial content lives in the content model.

- **Full-bleed vs container background is handled by wrapping HTML, not CSS tricks**: full-bleed rows are rendered directly inside `<article>` (outside `.container`), so they span 100% naturally. Container-width rows are wrapped in `<div class="container">` in the Razor partial, limiting the coloured background to container width. Content inside both cases always uses an inner `<div class="container">`.

- **CSS custom properties for colours**: light background uses `var(--bs-gray-100)` (#f8f9fa), accent background uses `var(--bs-teal)` (#005E70) with white text — both already defined in `:root` in `styles.css`. No new colour values are introduced.

- **Padding via `Spacing Properties` composition**: `sectionBackgroundColor` and `sectionBackgroundWidth` go on the settings model alongside the standard `Spacing Properties` element type (`2e1a4fd4-b695-4033-8626-1a45b54e04cb`) for configurable top/bottom/left/right padding.

---

## Key IDs (discovered via MCP)

| Entity | ID |
|--------|----|
| `[BlockList] Main Content` data type | `b5922818-d8d8-43df-88ed-4582a24c0fa6` |
| `Spacing Properties` element type | `2e1a4fd4-b695-4033-8626-1a45b54e04cb` |
| Content document type | `b871f83c-2395-4894-be0f-5422c1a71e48` |
| Article document type | `0f63b49a-5423-46bd-91fa-0e78bbd2f6d6` |
| Documentation document type | `2cf4d650-39ec-41ef-8bd6-5085ee9f780a` |
| Elements → Content Models folder | `1645b9b1-459b-40e7-90a5-ea194afda61d` |
| Elements → Setting Models folder | `a3274987-1799-46d6-885c-551ba2986c90` |
| Compositions folder | `3503b89f-2819-4e41-86d7-d17dcc5b4212` |
| Textstring data type | `0cc0eba1-9960-42c9-bf9b-60e150b429ae` |
| Generic Dropdown data type | `0b6a45e7-44ba-430d-9da5-4e46060b9e03` |

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Schema setup (Management API script)

> **Prompt**: Implement Step 1 of `_plans/content-section-rows.md`. Create `scripts/setup-content-section-rows-schema.mjs` following the pattern in `scripts/setup-image-carousel-schema.mjs`. The script must run as a single Node.js process to avoid token expiry (299 s). It should: (1) authenticate once; (2) create three dropdown data types (`[Dropdown] Section Background Color` with values `none/light/accent`, `[Dropdown] Section Background Width` with values `container/full-bleed`, `[Dropdown] Section Heading Level` with values `h2/h3/h4/h5/h6`); (3) create the `Content Section Row` element type in folder `1645b9b1-459b-40e7-90a5-ea194afda61d` with properties `sectionTitle` (Textstring `0cc0eba1-9960-42c9-bf9b-60e150b429ae`), `sectionContent` (block list `b5922818-d8d8-43df-88ed-4582a24c0fa6`), and `sectionHeadingLevel` (the new `[Dropdown] Section Heading Level` data type); (4) create `Content Section Row Settings` element type in folder `a3274987-1799-46d6-885c-551ba2986c90` with properties `sectionBackgroundColor` and `sectionBackgroundWidth` using the new dropdowns, composed with `Spacing Properties` (`2e1a4fd4-b695-4033-8626-1a45b54e04cb`); (5) create a new `[BlockList] Section Rows` data type that allows the new `Content Section Row` content type with `Content Section Row Settings`; (6) create a `Section Row Controls` composition in folder `3503b89f-2819-4e41-86d7-d17dcc5b4212` with a single `sectionRows` property using `[BlockList] Section Rows`; (7) GET then PUT the Content (`b871f83c`), Article (`0f63b49a`), and Documentation (`2cf4d650`) document types to add the new composition to each. Run with `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" node scripts/setup-content-section-rows-schema.mjs`.

**What to build**:
- `scripts/setup-content-section-rows-schema.mjs`
  - Step 1: Auth (client credentials)
  - Step 2: POST `/data-type` × 3 (background color, background width, heading level dropdowns)
  - Step 3: POST `/document-type` — `Content Section Row` (isElement: true, parent: Content Models folder)
    - Properties: `sectionTitle` (Textstring, optional), `sectionContent` (`[BlockList] Main Content`), `sectionHeadingLevel` (`[Dropdown] Section Heading Level`)
  - Step 4: POST `/document-type` — `Content Section Row Settings` (isElement: true, parent: Setting Models folder)
    - Compose with `Spacing Properties`
    - Properties: `sectionBackgroundColor`, `sectionBackgroundWidth` (new dropdowns)
  - Step 5: POST `/data-type` — `[BlockList] Section Rows` with block allowed: Content Section Row + Content Section Row Settings
  - Step 6: POST `/document-type` — `Section Row Controls` composition (isElement: false, parent: Compositions folder)
    - Property: `sectionRows` using `[BlockList] Section Rows`, tab "Content"
  - Step 7: For each of Content, Article, Documentation — GET document type, append `Section Row Controls` to `compositions[]`, PUT back
  - Log the created IDs for each entity as the script runs

**Validation**:
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" node scripts/setup-content-section-rows-schema.mjs` — exits 0 with a line per created entity
- [Manual]: In backoffice → Settings → Document Types, check that Content, Article, and Documentation each show "Section Row Controls" in their Compositions tab. Check Elements → Content Models for "Content Section Row".

---

### Step 2 — E2E test file (write first → expect RED)

> **Prompt**: Implement Step 2 of `_plans/content-section-rows.md`. Write `tests/e2e/contentSectionRows.spec.ts` following the patterns in `tests/e2e/blocks/alertBanner.spec.ts`. The tests should cover: element type exists with correct property aliases; page with no section rows has no `.section-row` element; page with a section row renders the row after the main content area; full-bleed row width is greater than the inner `.container` width; container-width row does not exceed the container; all three background color options apply distinct CSS classes; empty section row (no blocks) renders nothing. The `Content Section Row` element type ID will be known only after Step 1 runs — look it up dynamically by name in the test's `beforeAll` via the Management API. The test should be runnable (but fail / show RED on rendering tests) with `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/contentSectionRows.spec.ts`. Confirm that schema tests pass (element type exists) but browser render tests fail because the Razor partial does not exist yet.

**What to build**:
- `tests/e2e/contentSectionRows.spec.ts`
  - Section 1 — Element Type: verify `Content Section Row` exists, `isElement: true`, has `sectionTitle`, `sectionContent`, and `sectionHeadingLevel` properties; verify `Content Section Row Settings` has `sectionBackgroundColor` and `sectionBackgroundWidth`
  - Section 2 — Browser Render: 
    - `beforeAll`: clean stale test documents, create a Content page, inject two section rows (one full-bleed/accent, one container/light) + an empty row, publish, get actual URL
    - "no section rows" test: page without `sectionRows` block list has no `.section-row` in DOM
    - "renders below content area": `.section-row` appears after `article .container`
    - "full bleed wider than container": `sectionRow.boundingBox().width > container.boundingBox().width`
    - "container row ≤ container width"
    - "background colors are distinct": assert computed `background-color` for light row matches `rgb(248, 249, 250)` (Bootstrap gray-100), accent row matches the teal value, and none row has transparent/default background — test behaviour, not CSS class names
    - "accent row has light text": assert computed `color` is white (`rgb(255, 255, 255)`) on the accent row
    - "empty row not rendered": row with no blocks has no visible output
    - `afterAll`: delete test documents

**Test first**:
- Run: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/contentSectionRows.spec.ts`
- Expect: element type tests PASS, browser render tests FAIL (partial view missing / no `.section-row` in DOM) — confirm RED before moving to Step 3

---

### Step 3 — Razor partial + template integration

> **Prompt**: Implement Step 3 of `_plans/content-section-rows.md`. Create `src/UmbracoProject/Views/Partials/contentSectionRow.cshtml` that receives a `BlockListItem` whose content is a `ContentSectionRow` and settings is a `ContentSectionRowSettings`. For full-bleed rows (backgroundWidth == "full-bleed"), render `<section class="section-row section-row--bg-{color} section-row--full-bleed {spacingClasses}"><div class="container">{heading}{blocks}</div></section>` directly (no outer wrapper). For container-width rows (backgroundWidth == "container"), render `<div class="container"><section class="section-row section-row--bg-{color} section-row--container {spacingClasses}">{heading}{blocks}</section></div>`. In both cases use `@Html.GetBlockListHtml(row.SectionContent)` for blocks. Skip rendering entirely if the block list is empty. Then update `Views/content.cshtml`, `Views/article.cshtml`, and `Views/documentation.cshtml` to iterate over `sectionRows` **inside `<article>` but after the closing `</div>` of the main `.container`** — section rows live outside `.container` so full-bleed rows span the viewport, but still inside `<article>` for semantic grouping: `@if (Model.HasValue("sectionRows")) { var rows = Model.Value<BlockListModel>("sectionRows"); foreach (var row in rows) { @await Html.PartialAsync("~/Views/Partials/contentSectionRow.cshtml", row) } }`. Verify the project builds with `cd src/UmbracoProject && dotnet build`.

**What to build**:
- `src/UmbracoProject/Views/Partials/contentSectionRow.cshtml`
  - `@inherits UmbracoViewPage<BlockListItem>`
  - Extract `var row = Model.Content as ContentSectionRow;` and `var settings = Model.Settings as ContentSectionRowSettings;`
  - Guard: if `row?.SectionContent == null || !row.SectionContent.Any()` → return
  - Determine `bgClass`: `settings?.SectionBackgroundColor` → `"section-row--bg-light"` / `"section-row--bg-accent"` / `""` (none)
  - Determine `isFullBleed`: `settings?.SectionBackgroundWidth == "full-bleed"`
  - Get spacing classes via `SpacingHelper.GetSpacingClasses(...)` if settings implements `ISpacingProperties`
  - Conditionally render heading: if `row.HasValue("sectionTitle")`, render `<h2>` (or the heading level from `sectionHeadingLevel`, defaulting to `h2`)
  - Two HTML structures for full-bleed vs container (see prompt above)
- Modify `src/UmbracoProject/Views/content.cshtml` — add section rows loop inside `<article>`, after the main `.container` closing `</div>`
- Modify `src/UmbracoProject/Views/article.cshtml` — add section rows loop inside `<article>`, after the main `.container` closing `</div>`
- Modify `src/UmbracoProject/Views/documentation.cshtml` — add section rows loop inside `<article>`, after the main `.container` closing `</div>`

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build` — zero errors
- [Manual]: Load a Content page in the browser; add a section row via backoffice (background color: light, width: full-bleed, some rich text blocks) and publish. Confirm the section row appears below the page content with a light-grey background spanning the full browser width.

---

### Step 4 — CSS styles + E2E GREEN

> **Prompt**: Implement Step 4 of `_plans/content-section-rows.md`. Add section row CSS rules to `src/UmbracoProject/wwwroot/assets/css/styles.css` — append them at the end of the file after all existing rules. Required rules: `.section-row` base (no visual styles, just a block element anchor for specificity); `.section-row--bg-light` with `background-color: var(--bs-gray-100)`; `.section-row--bg-accent` with `background-color: var(--bs-teal); color: #fff;`; `.section-row--container` should add a subtle visual separator (e.g. `border-radius: 0.375rem` or `margin-bottom: 1rem`) — keep it minimal. No CSS is needed for `.section-row--full-bleed` since the element is naturally full-width outside `.container`. After adding the CSS, run the full E2E suite for this feature: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/contentSectionRows.spec.ts` — all tests should be GREEN.

**What to build**:
- Modify `src/UmbracoProject/wwwroot/assets/css/styles.css` — append at end:
  ```css
  /* ── Content Section Rows ─────────────────────────────────── */
  .section-row {
    display: block;
  }
  .section-row--bg-light {
    background-color: var(--bs-gray-100);
  }
  .section-row--bg-accent {
    background-color: var(--bs-teal);
    color: #fff;
  }
  .section-row--container {
    border-radius: 0.375rem;
  }
  ```

**Validation**:
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/contentSectionRows.spec.ts` — all tests pass (GREEN). Tests assert computed styles (background-color, color, width) not class names.
- [Manual]: 
  - Full-bleed + accent: background teal stripe spans full viewport width, white text
  - Container + light: grey background constrained to container width
  - None: no background, visually identical to no section row
  - Page with no section rows: layout unchanged

---

## File Summary

| Action | File |
|--------|------|
| Create (delete after running) | `scripts/setup-content-section-rows-schema.mjs` |
| Create | `src/UmbracoProject/Views/Partials/contentSectionRow.cshtml` |
| Modify | `src/UmbracoProject/Views/content.cshtml` |
| Modify | `src/UmbracoProject/Views/article.cshtml` |
| Modify | `src/UmbracoProject/Views/documentation.cshtml` |
| Modify | `src/UmbracoProject/wwwroot/assets/css/styles.css` |
| Create | `tests/e2e/contentSectionRows.spec.ts` |
