# Plan: Updated Site Footer

## Context

The current footer (`src/UmbracoProject/Views/Partials/footer.cshtml`) renders social icon links and copyright text in a centered layout. The spec calls for a redesigned footer matching the Figma design with: a Diagram logo image, a rich text description, and a footer navigation menu — all managed in Umbraco CMS. Desktop shows logo+text left / menu right; narrow screens stack menu → logo → text, all centered.

**Branch**: `claude/feature/updated-site-footer`
**Spec**: `_specs/shipped/updated-site-footer.md`
**Figma**: Footer file, nodes 1:6 (widescreen) and 1:51 (narrow)

---

## Step 1: Write E2E Tests (RED)

**Goal**: Create the test file with all tests failing. This defines the acceptance criteria in code.

**Create**: `tests/e2e/footer/updatedFooter.spec.ts`

Follow the patterns from `tests/e2e/blocks/alertBanner.spec.ts` (token helpers, API fetch, dynamic tree walk).

### Test Sections

**Section 1 — Document Type Properties**
- `footerLogo` property exists on Footer Controls composition (media picker)
- `footerDescription` property exists on Footer Controls composition (rich text)
- `footerNavigation` property exists on Footer Controls composition (multi-url picker)

Lookup approach: use `umbracoApi.documentType` helpers to find "Footer Controls" in the Compositions folder (`3503b89f-2819-4e41-86d7-d17dcc5b4212`). Use `getChildren(folderId)` as fallback per the `getByName` bug workaround.

**Section 2 — Partial View File Content**
- `footer.cshtml` exists
- References `FooterLogo`, `FooterDescription`, `FooterNavigation` (PascalCase model properties)
- Contains null checks for logo (`FooterLogo != null`) and navigation (`.Any()`)

**Section 3 — CSS File Content**
- `styles.css` contains `.site-footer` class
- Contains `border-top` rule with `6px`
- Contains `.footer-nav` with Oxanium font reference
- Contains hover color `#009171`
- Contains `@media` rule at `768px` breakpoint

**Section 4 — Browser E2E** (serial mode)
- `beforeAll`: dynamically find Home page, get its published URL
- Logo image visible in footer (desktop viewport 1200×800)
- Body text visible in footer
- Footer nav links present with valid `href` attributes
- Desktop: nav element `x` offset > logo element `x` offset
- Narrow (390×844): nav element `y` < logo element `y`
- Top border is `6px solid rgb(0, 0, 0)`
- Background is white (`rgb(255, 255, 255)`)
- Nav labels are uppercase (computed `text-transform`)

**Verify**: Run tests — all should fail (RED).
```bash
PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/footer/updatedFooter.spec.ts
```

---

## Step 2: Add CMS Properties via Umbraco MCP

**Goal**: Add three new properties to the Footer Controls composition. Document Type tests turn GREEN.

### Data Types Needed

| Name | Editor Schema | Editor UI | Config |
|------|--------------|-----------|--------|
| [MediaPicker] Image | `Umbraco.MediaPicker3` | `Umb.PropertyEditorUi.MediaPicker` | single image (check if existing data type can be reused — search via `mcp__umbraco-mcp__find-data-type`) |
| [RichText] Simple | `Umbraco.RichText` | `Umb.PropertyEditorUi.Tiptap` | (check for existing rich text data type to reuse) |
| [MultiUrlPicker] Footer Nav | `Umbraco.MultiUrlPicker` | `Umb.PropertyEditorUi.MultiUrlPicker` | `maxNumber: 0` (unlimited), `minNumber: 0` — the existing picker at `2d350d21...` is limited to 1 link, so a new one is needed |

### Properties to Add to Footer Controls Composition

Add to existing "Footer" property group (key: `19d6db90-3303-45cf-850c-c7d030452843`):

| Alias | Name | Data Type | Sort Order | Mandatory |
|-------|------|-----------|------------|-----------|
| `footerLogo` | Footer Logo | [MediaPicker] Image | 10 | No |
| `footerDescription` | Footer Description | [RichText] Simple | 15 | No |
| `footerNavigation` | Footer Navigation | [MultiUrlPicker] Footer Nav | 20 | No |

Existing `socialIconLinks` (sort order 5) stays — no breaking change.

### MCP Workflow
1. `mcp__umbraco-mcp__find-data-type` — search for existing media picker and rich text data types to reuse
2. `mcp__umbraco-mcp__create-data-type` — create "[MultiUrlPicker] Footer Navigation" if no unlimited multi-url picker exists
3. `mcp__umbraco-mcp__get-document-type-by-id` — read current Footer Controls composition
4. `mcp__umbraco-mcp__update-document-type` — add the three new properties

### Post-MCP
- Restart Umbraco (`cd src/UmbracoProject && dotnet run`) so auto-generated C# models include `FooterLogo`, `FooterDescription`, `FooterNavigation`
- Check that `umbraco/Deploy/Revision/document-type__8e37a6b6fe2a43b0adbce41822d005c4.uda` was updated with the new properties

**Verify**: Run document type tests.
```bash
PATH="..." npx playwright test tests/e2e/footer/updatedFooter.spec.ts -g "Document Type"
```

---

## Step 3: Implement CSS + Razor Partial (GREEN)

**Goal**: Write the footer CSS and rewrite the Razor partial. Partial View and CSS tests turn GREEN.

### CSS Changes

**File**: `src/UmbracoProject/wwwroot/assets/css/styles.css`
**Location**: Replace the existing `footer` rule at line 11142–11145.

Key rules:
```css
footer.site-footer {
  border-top: 6px solid #000;
  background-color: #fff;
  padding: 39px;
}

.site-footer .footer-inner {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.site-footer .footer-brand { max-width: 327px; }

.site-footer .footer-brand img {
  width: 153px; height: 21px; object-fit: contain;
}

.site-footer .footer-description {
  font-family: 'Source Sans 3', sans-serif;
  font-size: 14px; line-height: 20px; color: #565656;
  margin-top: 16px;
}

.site-footer .footer-nav {
  display: flex; flex-wrap: wrap; gap: 32px;
  list-style: none; margin: 0; padding: 0;
}

.site-footer .footer-nav a {
  font-family: 'Oxanium', cursive;
  font-size: 14px; color: #000;
  text-transform: uppercase; text-decoration: none;
  padding-bottom: 6px;
  border-bottom: 1px solid #000;
  transition: border-color 0.2s ease;
}

.site-footer .footer-nav a:hover {
  border-bottom-color: #009171; color: #000;
}

@media (max-width: 767.98px) {
  footer.site-footer { padding: 36px 24px; }
  .site-footer .footer-inner {
    flex-direction: column-reverse;
    align-items: center; gap: 47px;
  }
  .site-footer .footer-brand { text-align: center; }
  .site-footer .footer-nav { justify-content: center; }
}
```

Design note: `column-reverse` on mobile makes DOM order (brand → nav) render visually as (nav → brand), matching the Figma narrow layout without duplicate markup.

### Razor Partial Rewrite

**File**: `src/UmbracoProject/Views/Partials/footer.cshtml` — full rewrite.

Patterns to follow:
- `Model.AncestorOrSelf<ContentModels.Home>()` — same as current footer
- Media picker: `homePage.FooterLogo.Url()` / `.Content.GetAltText()` (pattern from `imageRow.cshtml`)
- Multi-URL Picker: `link.Url`, `link.Target`, `link.Type`, `link.Name` (pattern from `iconLinkRow.cshtml`)
- `@using Umbraco.Cms.Core.Models` for the `LinkType` enum
- Null/empty checks for all three properties (spec edge cases)

Structure:
```
<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-brand">
      @if (FooterLogo != null) { <img ...> }
      @if (FooterDescription not empty) { <div class="footer-description">...</div> }
    </div>
    @if (FooterNavigation has items) {
      <nav><ul class="footer-nav">
        @foreach link { <li><a href target rel>@link.Name</a></li> }
      </ul></nav>
    }
  </div>
</footer>
```

**Verify**: Run partial view + CSS tests.
```bash
PATH="..." npx playwright test tests/e2e/footer/updatedFooter.spec.ts -g "Partial View|CSS"
```

---

## Step 4: Populate CMS Content + Final GREEN Tests

**Goal**: Upload logo, populate footer properties on Home, publish, and verify all browser E2E tests pass.

### Sub-steps

1. **Upload Diagram logo** to Umbraco media library via MCP
   - `mcp__umbraco-mcp__create-temporary-file` → `mcp__umbraco-mcp__create-media`
   - The logo image should be ~153×21px PNG

2. **Populate footer properties on Home document** via MCP
   - `mcp__umbraco-mcp__update-document-properties` on Home
   - `footerLogo` → media item from step 1
   - `footerDescription` → rich text with site description
   - `footerNavigation` → array of link objects (e.g. Member Login, Credits, Accessibility, Ethical Guidelines — matching the Figma design labels)

3. **Publish Home** via `mcp__umbraco-mcp__publish-document`

4. **Restart Umbraco** to clear the 60-minute partial cache

5. **Run full test suite**:
   ```bash
   PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/footer/updatedFooter.spec.ts
   ```

6. **Visual check**: Open the site in a browser at desktop and mobile widths to compare against Figma

7. **REFACTOR**: Clean up any overly specific test assertions, verify `.uda` changes are correct, discard unintended `.uda` diffs with `git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/` for unrelated files

---

## Dependency Graph

```
Step 1 (Tests — RED)
  ├──→ Step 2 (CMS Properties via MCP)
  │      │
  │      └──→ Step 3 (CSS + Razor — depends on Step 2 for C# model properties)
  │             │
  │             └──→ Step 4 (Content + GREEN tests — depends on all prior steps)
  └──────────────────┘
```

## Critical Files

| File | Action |
|------|--------|
| `tests/e2e/footer/updatedFooter.spec.ts` | Create (Step 1) |
| `src/UmbracoProject/umbraco/Deploy/Revision/document-type__8e37a6b6fe2a43b0adbce41822d005c4.uda` | Modified by MCP (Step 2) |
| `src/UmbracoProject/wwwroot/assets/css/styles.css` | Edit lines 11142+ (Step 3) |
| `src/UmbracoProject/Views/Partials/footer.cshtml` | Full rewrite (Step 3) |
| `src/UmbracoProject/Views/master.cshtml` | No changes (line 27 CachedPartialAsync stays) |

## Existing Code to Reuse

| Pattern | Source File |
|---------|------------|
| Media picker rendering (`Url()`, `GetAltText()`) | `Views/Partials/blocklist/Components/imageRow.cshtml` |
| Multi-URL Picker rendering (`link.Url`, `link.Target`, `LinkType`) | `Views/Partials/blocklist/Components/iconLinkRow.cshtml` |
| `AncestorOrSelf<Home>()` for accessing Home properties | Current `Views/Partials/footer.cshtml` |
| Token helpers, API fetch, dynamic tree walk | `tests/e2e/blocks/alertBanner.spec.ts` |
| Composition lookup via `getChildren(folderId)` | `tests/e2e/sectionNavigation.spec.ts` |
