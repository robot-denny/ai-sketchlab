# Plan: Living Style Guide

**Spec**: [_specs/living-style-guide.md](../_specs/living-style-guide.md)
**Feature doc**: [_features/living-style-guide.md](../_features/living-style-guide.md)
**Branch**: `claude/feature/living-style-guide`

## Context

The site needs a self-updating brand and design reference page so a new author or contributor can read it in five minutes and a designer can spot-check it after CSS changes. The spec is finalized; all open questions resolved. Three discoveries during planning shifted the implementation details:

1. **Brand color tokens live in `typography.css`** ([wwwroot/assets/css/typography.css:21-55](../src/UmbracoProject/wwwroot/assets/css/typography.css#L21-L55)), not `tokens-extras.css` (the latter only holds Dark Constructivism imagery + pattern URLs). The spec's "canonical token file" reference needs a one-line correction; tokens stay put.
2. **The metadata convention is terse**: `/**umb_name:LABEL**/` (single-line, no quotes — see [dropdownStyles.css](../src/UmbracoProject/wwwroot/css/dropdownStyles.css)). Implementation should match: `/**umb_swatch:Primary action / signal red*/`. The spec's verbose `@swatch: role: "..."` draft form is replaced with this simpler one for project consistency.
3. **The Content doc-type's top-level Block List only allows `ContentSectionRow`**; showcase blocks (alertBanner, codeSnippetRow, etc.) live nested inside each section row's `sectionContent`. So `/styleguide/components` is built as **three Section Rows** (Text / Media / Lists), each holding alternating Rich Text Row labels + showcase blocks. No schema changes needed.

All five typography classes the spec calls out (`.lead`, `.overline`, `.blockquote`, `.caption`, `.pull-quote`) already exist in `typography.css` ([lines 305–361](../src/UmbracoProject/wwwroot/assets/css/typography.css#L305-L361)). No new CSS classes need to be authored.

## Key Decisions (post-spec)

- **Token file**: annotate `typography.css` directly. Do not move tokens.
- **Metadata form**: `/**umb_swatch:LABEL**/` — bare label after the colon, single line.
- **Components page structure**: 3 × ContentSectionRow (Text / Media / Lists), each `sectionContent` alternating Rich Text Row label + showcase block.
- **No new C# unit-test project**: the project has no `.Tests.csproj` (per [CLAUDE.md](../CLAUDE.md#testing)). Parser logic is exercised via E2E + manual verification of edge cases. Adding xUnit is an optional follow-up, not part of this plan.

## Steps

### Step 1 — Realign spec + feature docs to canonical token file and metadata form

Files: [_specs/living-style-guide.md](../_specs/living-style-guide.md), [_features/living-style-guide.md](../_features/living-style-guide.md)

- Replace the four mentions of `tokens-extras.css` with `typography.css` (Summary key-decisions list, /styleguide functional requirements, Resolved Decisions section).
- Update the four scenarios that show `/* @swatch: role: "..." */` to use `/**umb_swatch:Primary action / signal red*/` instead. Adjust the prose around them.
- Append a Revision Notes line to `_features/living-style-guide.md`: "2026-04-29: Realigned to typography.css + /**umb_swatch:LABEL**/ convention during planning."

No code changes; doc-only commit.

### Step 2 — Style Guide Page document type (TDD)

**Test first** ([tests/e2e/styleguide.spec.ts](../tests/e2e/styleguide.spec.ts), Section 1 — schema):

```typescript
test('Style Guide Page document type exists with brandSummary + visibility controls', async () => {
  const docType = await api.documentType.getByName('Style Guide Page');
  expect(docType).toBeTruthy();
  expect(docType.alias).toBe('styleGuidePage');
  expect(docType.allowedAtRoot).toBe(true);
  expect(docType.allowedTemplates?.some(t => t.alias === 'styleGuidePage')).toBe(true);
  const aliases = (docType.properties ?? []).map(p => p.alias);
  expect(aliases).toContain('brandSummary');
  // Visibility controls composition provides hideFromTopNavigation
  expect(aliases).toContain('hideFromTopNavigation');
});
```

Run with `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/styleguide.spec.ts` — must fail before doc type exists.

**Implement** via Umbraco MCP tools:
- `mcp__umbraco-mcp__create-document-type` for `styleGuidePage`:
  - Name: `Style Guide Page`, alias: `styleGuidePage`, allowedAtRoot: true
  - Compositions: `VisibilityControls`, `HeaderControls`, `SEOControls`, `FooterControls`, `PageHeadPatternControls`
  - Properties: `brandSummary` (Rich Text Editor data type — match existing rich-text usage on Content/Article doc types)
  - AllowedChildren: `content` (so `/styleguide/components` can be a Content child)
- Create matching template `styleGuidePage.cshtml` (empty stub for now — Step 3 fills it).

After creation, re-run the test — expect GREEN.

### Step 3 — Annotate brand color tokens in typography.css

File: [src/UmbracoProject/wwwroot/assets/css/typography.css](../src/UmbracoProject/wwwroot/assets/css/typography.css)

Add `/**umb_swatch:LABEL**/` comments immediately above each brand-color token in the `:root` block (lines 21–55). Use these captions:

| Token | Caption |
|-------|---------|
| `--text-primary` | Primary text — warm stone |
| `--text-secondary` | Secondary text — muted stone |
| `--text-tertiary` | Tertiary text — softest stone |
| `--text-on-dark` | Text on dark surfaces |
| `--text-on-dark-secondary` | Secondary text on dark |
| `--surface-primary` | Primary surface — page background |
| `--surface-secondary` | Secondary surface — cards |
| `--surface-tertiary` | Tertiary surface — subtle wells |
| `--surface-dark` | Dark surface — masthead / on-dark sections |
| `--surface-dark-elevated` | Elevated dark surface |
| `--accent-primary` | Primary action / signal red |
| `--accent-primary-hover` | Primary action — hover |
| `--accent-secondary` | Secondary accent — warm bronze |
| `--accent-tertiary` | Tertiary accent — slate teal |
| `--status-success` | Status — success |
| `--status-warning` | Status — warning |
| `--status-error` | Status — error |
| `--status-info` | Status — info |
| `--border-light` | Border — light divider |
| `--border-medium` | Border — medium |
| `--border-dark` | Border — dark divider |

Skip subtle / variant tokens (`--accent-primary-subtle`, `--accent-primary-light`, `--surface-overlay`, `--border-accent`) and Bootstrap aliases — they're either alpha-modulated, alias references, or framework-overrides. Skip spacing / easing / font-stack tokens (not colors).

No tests for this step alone; tokens are exercised via Step 4's parser.

### Step 4 — Swatch parser + Razor partial for color palette

**Test first** ([tests/e2e/styleguide.spec.ts](../tests/e2e/styleguide.spec.ts), Section 3 — browser, after Step 6 creates the page):

```typescript
test('Color palette renders one swatch per @umb_swatch annotation with token / value / role', async ({ page }) => {
  await page.goto(styleguideUrl);
  const swatches = page.locator('[data-styleguide="swatch"]');
  await expect(swatches).not.toHaveCount(0);
  // Spot-check a known token
  const accent = page.locator('[data-styleguide-token="--accent-primary"]');
  await expect(accent).toBeVisible();
  await expect(accent.locator('[data-styleguide="value"]')).toHaveText(/#C23D2E/i);
  await expect(accent.locator('[data-styleguide="role"]')).toHaveText('Primary action / signal red');
  // Tokens without annotation must be excluded
  await expect(page.locator('[data-styleguide-token="--space-md"]')).toHaveCount(0);
});
```

**Implement**:

- New helper `src/UmbracoProject/Helpers/SwatchTokenParser.cs`:
  - Static method `IReadOnlyList<Swatch> Parse(string css)` returning `record Swatch(string Name, string Value, string Role)`.
  - Regex pair: `/\*\*umb_swatch:(?<role>[^*]+)\*+/\s*(?<name>--[\w-]+)\s*:\s*(?<value>[^;]+);/` — match the comment immediately followed by a token declaration.
  - Trim whitespace; preserve `var(...)` and `rgba(...)` values verbatim. Tokens without a preceding `umb_swatch` comment are excluded by construction.
- New partial `src/UmbracoProject/Views/Partials/StyleGuide/_ColorPalette.cshtml`:
  - Reads `~/wwwroot/assets/css/typography.css` via `IWebHostEnvironment.WebRootFileProvider`, calls `SwatchTokenParser.Parse`, renders one swatch card per entry with `data-styleguide`, `data-styleguide-token`, `data-styleguide="value"`, `data-styleguide="role"` attributes.
  - Empty-state hint when zero swatches: `<p class="text-muted">No swatches configured</p>`.
  - File-read result is cached for the request via a singleton service or `IMemoryCache` keyed on file path. (Not real-time-reflective at scale, but the page is cached anyway — see Caching note below.)
- Use `ContentSecurityPolicy`-safe `style="background-color: …"` inline (the value comes from server-parsed CSS, not user input — safe).

Inline-color edge case: when value is `var(--legacy-foo)` or otherwise unparseable, render the literal value text and omit the `style` attribute so the swatch card still renders without a broken color sample.

### Step 5 — Razor view: 5 sections in order

File: `src/UmbracoProject/Views/styleGuidePage.cshtml`

```cshtml
@inherits Umbraco.Cms.Web.Common.Views.UmbracoViewPage<ContentModels.StyleGuidePage>
@using Umbraco.Cms.Core.Strings
@{
  Layout = "_Layout.cshtml"; // or whatever the existing master uses
}

<article class="styleguide">
  <section id="brand-summary" data-styleguide-section="brand-summary">
    <h2>Brand summary</h2>
    @{
      var summary = Model.BrandSummary;
      var summaryHtml = summary?.ToString() ?? string.Empty;
    }
    @if (!string.IsNullOrWhiteSpace(summaryHtml))
    {
      <div class="styleguide__brand-summary">@Html.Raw(summaryHtml)</div>
    }
  </section>

  <section id="color-palette" data-styleguide-section="color-palette">
    <h2>Color palette</h2>
    @await Html.PartialAsync("StyleGuide/_ColorPalette")
  </section>

  <section id="typography" data-styleguide-section="typography">
    <h2>Typography</h2>
    @await Html.PartialAsync("StyleGuide/_Typography")
  </section>

  <section id="general-elements" data-styleguide-section="general-elements">
    <h2>General elements</h2>
    @await Html.PartialAsync("StyleGuide/_GeneralElements")
  </section>

  <section id="components-reference" data-styleguide-section="components-reference">
    <h2>Components reference</h2>
    <p>See the <a href="/styleguide/components">components page</a> for live examples of each block.</p>
  </section>
</article>
```

Top-of-page anchor list (`<nav class="styleguide__nav">…</nav>`) jumps to each `id`. Use the `frontend-design` skill to refine visual treatment (sticky vs static, divider style, spacing rhythm) before merge.

**Typography partial** (`_Typography.cshtml`): one `<h1>`–`<h6>` example with placeholder text + a paragraph per editor-class (`.lead`, `.overline`, `.blockquote`, `.caption`, `.pull-quote`). All use real CSS classes — no copies.

**General elements partial** (`_GeneralElements.cshtml`): one of each — `<a>`, `<button class="btn btn-primary">`, `<ul>`, `<ol>`, `<table class="table">`, `<input type="text">`, `<input type="email">`, `<textarea>`. No styling overrides.

**Test** (browser):
```typescript
test('Five sections render in order', async ({ page }) => {
  await page.goto(styleguideUrl);
  const sections = await page.locator('[data-styleguide-section]').all();
  const ids = await Promise.all(sections.map(s => s.getAttribute('data-styleguide-section')));
  expect(ids).toEqual(['brand-summary', 'color-palette', 'typography', 'general-elements', 'components-reference']);
});
test('Typography shows h1–h6 + 5 editor classes', async ({ page }) => {
  await page.goto(styleguideUrl);
  for (const h of ['h1','h2','h3','h4','h5','h6']) await expect(page.locator(`#typography ${h}`).first()).toBeVisible();
  for (const c of ['lead','overline','blockquote','caption','pull-quote']) await expect(page.locator(`#typography .${c}`).first()).toBeVisible();
});
test('General elements include link, button, lists, table, inputs', async ({ page }) => {
  await page.goto(styleguideUrl);
  for (const sel of ['a','button','ul','ol','table','input[type=text]']) await expect(page.locator(`#general-elements ${sel}`).first()).toBeVisible();
});
test('Empty brand summary renders heading without empty panel', async () => { /* fixture sets BrandSummary='', re-publishes, asserts heading present + no .styleguide__brand-summary node */ });
```

### Step 6 — Create /styleguide page via MCP + hide from main nav

Via Umbraco MCP tools (test setup, run once):

1. `mcp__umbraco-mcp__create-document` under Home with doc type `styleGuidePage`, name `Style Guide`, set `brandSummary` to a known fixture HTML (`<p>Honest human–AI collaboration</p>` for E2E spot-check).
2. Set `hideFromTopNavigation: true` on the new doc.
3. `mcp__umbraco-mcp__publish-document`.
4. Fetch its `urls[0].url` — assert it equals `/styleguide/` (or whatever URL the create returns; never hardcode).

**Test**:
```typescript
test('Styleguide page exists at /styleguide and is hidden from top nav', async ({ page }) => {
  await page.goto('/');
  // Confirm not in main nav
  await expect(page.locator('#mainNav').getByRole('link', { name: /style guide/i })).toHaveCount(0);
  // But reachable directly
  const res = await page.goto(styleguideUrl);
  expect(res?.status()).toBe(200);
});
```

### Step 7 — Create /styleguide/components page via MCP

Via Umbraco MCP tools:

1. `create-document` under the Style Guide page, doc type `content`, name `Components`. AllowedChildren on `styleGuidePage` includes `content` (Step 2).
2. Build `sectionRows` value with **3** ContentSectionRow blocks, each with a `sectionTitle` of `Text` / `Media` / `Lists` and `sectionContent` BlockList holding alternating Rich Text Row + showcase block, in spec order:
   - **Text**: rtRow("Rich Text Row") → richTextRow → rtRow("Code Snippet Row") → codeSnippetRow → rtRow("Alert Banner") → alertBanner
   - **Media**: rtRow("Image Row") → imageRow → rtRow("Image Carousel Row") → imageCarouselRow → rtRow("Video Row") → videoRow
   - **Lists**: rtRow("Latest Articles Row") → latestArticlesRow
3. Use `randomUUID()` for each block key; build `layout` / `contentData` / `expose` arrays per the existing pattern in [tests/e2e/blocks/alertBanner.spec.ts](../tests/e2e/blocks/alertBanner.spec.ts) (look at how blocks get injected).
4. Set `hideFromTopNavigation: true`. Publish.

**Test** ([tests/e2e/styleguide-components.spec.ts](../tests/e2e/styleguide-components.spec.ts)):
```typescript
test('Components page lists each showcase block, grouped by category, each preceded by a label', async ({ page }) => {
  await page.goto(componentsUrl);
  // Section row titles in order
  const titles = await page.locator('.section-row__title').allTextContents();
  expect(titles).toEqual(['Text', 'Media', 'Lists']);
  // Each block alias appears at least once
  for (const alias of ['richTextRow','codeSnippetRow','alertBanner','imageRow','imageCarouselRow','videoRow','latestArticlesRow']) {
    await expect(page.locator(`[data-block-alias="${alias}"]`).first()).toBeVisible();
  }
});
test('Styleguide links to components page', async ({ page }) => {
  await page.goto(styleguideUrl);
  const link = page.locator('#components-reference a[href*="/styleguide/components"]');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(componentsUrl);
});
```

Note: existing block partials may not emit `data-block-alias`; if not, assert against block-specific selectors (e.g. `.alert-banner`, `.code-snippet-row`). Confirm during implementation by reading each partial under `Views/Partials/blocklist/Components/`.

### Step 8 — End-to-end test setup (auth, cleanup, fixtures)

Both spec files share a `beforeAll`:

- Fresh OAuth token via the project's `freshToken()` helper pattern ([tests/e2e/auth.setup.ts](../tests/e2e/auth.setup.ts) for the format).
- `cleanStaleTestData` step searches Home's children for any document with name starting `Style Guide` or `Components` from prior failed runs and deletes them (reverse-depth order).
- Look up `styleGuidePage` doc-type id, `content` doc-type id, all 8 block element-type ids dynamically — never hardcode.
- After publish, fetch `urls[0].url` for both pages; pass to tests via shared variables.
- `afterAll`: optionally delete the test pages, or leave them as the canonical `/styleguide` content (decide during implementation — leaving them is simpler if the test data is also the production reference content).

Edge-case scenarios to cover (added to the same spec files):

- "No annotated tokens means an empty palette, not a broken page" — temporarily edit a fixture CSS file → fail-safe assertion. Skip if too implementation-coupled; rely on parser logic instead.
- "Unparseable token value is shown gracefully" — same approach.

### Step 9 — Update _features/living-style-guide.md test-coverage table

After E2E tests pass, update the **Test Coverage** table in [_features/living-style-guide.md](../_features/living-style-guide.md) to map each scenario to its test file + status (`Covered`). Append a Revision Notes line.

## File Summary

| File | Action |
|------|--------|
| [_specs/living-style-guide.md](../_specs/living-style-guide.md) | Edit — typography.css + `/**umb_swatch:` realignment |
| [_features/living-style-guide.md](../_features/living-style-guide.md) | Edit — same realignment + verified Test Coverage table at end |
| [src/UmbracoProject/wwwroot/assets/css/typography.css](../src/UmbracoProject/wwwroot/assets/css/typography.css) | Edit — add `/**umb_swatch:LABEL**/` comments to ~21 brand color tokens |
| `src/UmbracoProject/Helpers/SwatchTokenParser.cs` | Create — regex parser, returns `IReadOnlyList<Swatch>` |
| `src/UmbracoProject/Views/styleGuidePage.cshtml` | Create — 5-section layout |
| `src/UmbracoProject/Views/Partials/StyleGuide/_ColorPalette.cshtml` | Create — swatch grid renderer |
| `src/UmbracoProject/Views/Partials/StyleGuide/_Typography.cshtml` | Create — h1–h6 + 5 editor classes |
| `src/UmbracoProject/Views/Partials/StyleGuide/_GeneralElements.cshtml` | Create — links / buttons / lists / table / form inputs |
| `umbraco/Deploy/Revision/document-type__*styleGuidePage*.uda` | Auto-generated — created by MCP `create-document-type` call |
| `tests/e2e/styleguide.spec.ts` | Create — schema + browser tests for /styleguide |
| `tests/e2e/styleguide-components.spec.ts` | Create — content + browser tests for /styleguide/components |

## Verification

End-to-end sanity check after all steps land:

```bash
# 1. Build
cd src/UmbracoProject && dotnet build

# 2. Run dev server
cd src/UmbracoProject && dotnet run

# 3. Schema check
/check-uda

# 4. E2E suite (separate terminal)
PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/styleguide.spec.ts tests/e2e/styleguide-components.spec.ts

# 5. Manual QA in browser at https://localhost:44367/styleguide :
#    - 5 sections visible in order
#    - Color palette shows known swatches with values matching typography.css
#    - Edit typography.css: change --accent-primary value, refresh, swatch updates
#    - Typography shows live h1–h6 + .lead/.overline/.blockquote/.caption/.pull-quote
#    - General elements section visible
#    - Click "components page" link → /styleguide/components
#    - Components page shows 3 section rows (Text/Media/Lists), each block labelled
#    - Backoffice: edit brandSummary on Style Guide page, save+publish, refresh page → text changes
#    - Both pages absent from main top nav
```

Run the `frontend-design` skill on the rendered `/styleguide` page once Step 5 lands to refine the visual treatment of the section nav, swatch cards, and overall rhythm.

## Optional follow-ups (not in this plan)

- Add a C# unit-test project (xUnit) for `SwatchTokenParser` edge cases — the project has no test project today; adding one is scope creep.
- Expose additional typographic classes (`.kicker`, `.ai-authored`, `.ai-assisted`) in the TipTap class-picker dropdown — separate spec per the resolved decision.
- Deploy the new doc type + AI artifacts to Cloud — standard `git push` flow handles schema; verify with `/check-uda` first.

---

## Superseded — 2026-05-01

The structural decisions from Steps 2–7 above (rigid 5-section template, hardcoded `<section data-styleguide-section>` markup, single `brandSummary` field on a "Style Guide" tab) were superseded by a follow-up plan that converted the page to **block-driven authoring**:

- Three new programmatic block element types: `colorPaletteBlock`, `typographyShowcaseBlock`, `generalElementsBlock` — each with editor-controlled `heading` (TextString) + `intro` (rich text), and the original CSS-derived body.
- `styleGuidePage` doc-type now composes `SectionRowControls` (gives editors the same `sectionRows` Block List that the `content` doc-type uses); `FooterControls` was dropped (the global footer renders from Home).
- The page's property group was renamed from "Style Guide" → "Content" so `brandSummary` and `sectionRows` share a single Content tab.
- `brandSummary` stays as a top-level rich-text field rendered above the section rows.
- The legacy `Views/Partials/StyleGuide/_*.cshtml` partials were deleted; the rendering logic lives inside the new block partials under `Views/Partials/blocklist/Components/`.
- `.lead` and `.pull-quote` were added to the TipTap Style Select dropdown via `dropdownStyles.css`.

Plan + execution log lives in `~/.claude/plans/nope-let-s-do-this-resilient-mango.md`. Current behavior is the source of truth in [_features/living-style-guide.md](../_features/living-style-guide.md). The original Steps 1–9 above remain as the historical record of how the rigid version shipped.
