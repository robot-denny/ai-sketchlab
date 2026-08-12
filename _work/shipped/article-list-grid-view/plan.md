# Plan: Article List Grid View

**Spec**: `_specs/shipped/article-list-grid-view.md`
**Branch**: `claude/feature/article-list-grid-view`

## Context

The `latestArticlesRow` block component currently renders articles in a vertical stack of `.post-preview` rows. This plan adds a `displayMode` dropdown to the `latestArticlesRow` element type, letting editors switch each block between the existing **List** view and a new **Grid** view. In Grid mode, `latestArticlesRow.cshtml` reads the setting from the block itself and renders articles as equal-height Bootstrap cards with thumbnail image, title, subtitle, metadata, meta description, and category badge tags — capped at 12 articles.

---

## Key Decisions

- **Property location**: `displayMode` goes on the `latestArticlesRow` element type (not on the `articleList` document type). The block reads it from `row.Value<string>("displayMode")`. This means each block instance independently controls its display mode — multiple blocks on the same page can use different layouts even when referencing the same article list.
- **Grid layout**: Bootstrap 5 `row-cols-1 row-cols-md-2 row-cols-lg-3 g-4` for responsive columns. Cards use `h-100` so all cards in a row stretch to equal height automatically.
- **Card image**: `GetCropUrl(width: 400, height: 225)` for a 16:9 thumbnail. Wrapped in Bootstrap `ratio ratio-16x9` div so the image slot is reserved even when no image exists (shows a light grey placeholder).
- **Grid article limit**: Grid mode takes at most 12 articles from the ordered list and hides the pagination component entirely. List mode is unaffected.
- **Categories**: Rendered as `badge rounded-pill` tags (same class pattern as existing full-article list mode). Skipped if no categories.
- **metaDescription**: Read via `article.Value<string>("metaDescription")`. Skipped if empty.
- **List view regression**: No changes to existing list rendering path — separator `<hr>`, `showFullArticleOnListPage`, and pagination all remain untouched.

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading is a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Add `displayMode` property to `articleList` document type

> **Prompt**: Implement Step 1 of `_plans/shipped/article-list-grid-view.md`. Write a Node.js script at `scripts/add-article-list-display-mode.js` that uses the Umbraco Management API to add a `displayMode` dropdown property (options: `list`, `grid`) to the `articleList` document type. Run the script to verify it succeeds.

**What to build**: `scripts/add-article-list-display-mode.js`

The script (single process to avoid token expiry):
1. Authenticates via `grant_type=client_credentials` using credentials from `.env`
2. Creates a new "Article List Display Mode" data type:
   - Editor alias: `Umbraco.DropDown.Flexible`
   - Editor UI alias: `Umb.PropertyEditorUi.Dropdown`
   - Config values: `["list", "grid"]` — labels "List" and "Grid"
3. Walks the document-type tree to find the `articleList` document type by alias
4. GETs the full document type
5. Appends a `displayMode` property to the existing first group/tab (or creates a new one):
   - Alias: `displayMode`, Name: "Display Mode"
   - Data type: the newly created dropdown
6. PUTs the updated document type back

**Validation**: Script exits with no errors. Open any Article List page in the backoffice — a "Display Mode" dropdown with "List" and "Grid" options should appear in its properties.

---

### Step 2 — Update `latestArticlesRow.cshtml` to branch on display mode

> **Prompt**: Implement Step 2 of `_plans/shipped/article-list-grid-view.md`. Update `src/UmbracoProject/Views/Partials/blocklist/Components/latestArticlesRow.cshtml` to read `displayMode` from the linked article list page and render either the existing list or the new grid card layout. Run `dotnet build` from `src/UmbracoProject` to confirm no Razor errors.

**File to modify**: `src/UmbracoProject/Views/Partials/blocklist/Components/latestArticlesRow.cshtml`

After the existing article query setup, add:
```
var displayMode = row.Value<string>("displayMode");
var isGridView = string.Equals(displayMode, "grid", StringComparison.OrdinalIgnoreCase);
```

**List mode** (default, `isGridView == false`): existing `foreach` loop with `.post-preview`, `<hr>`, `showFullArticleOnListPage` block content, and the `Pagination` component — all unchanged.

**Grid mode** (`isGridView == true`): Wraps a `<div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4 article-grid">` and iterates over `allArticles.Take(12)`. Each article renders as a Bootstrap `card h-100 article-grid-card` with:
- Image slot: `<div class="ratio ratio-16x9">` containing either an `<img>` from `article.MainImage.GetCropUrl(width: 400, height: 225)` or a `<div class="article-grid-card__no-image bg-light">` placeholder
- `card-body`: `<h2 class="card-title h5">` with a linked title using Bootstrap `stretched-link`; subtitle as `small text-muted` if present; meta description as `card-text small` if non-empty
- `card-footer bg-transparent`: post-meta line (existing dictionary values for Posted / By / On), then category badges if any

In grid mode, **do not** render the `Pagination` component or the block author attribution.

**Validation**: `dotnet build` passes with no errors. Toggle Display Mode to "Grid" on an article list page and visit it — cards should appear in a grid.

---

### Step 3 — Add CSS for grid card layout

> **Prompt**: Implement Step 3 of `_plans/shipped/article-list-grid-view.md`. Append CSS for the article grid card layout to `src/UmbracoProject/wwwroot/assets/css/styles.css`.

Append to the end of `src/UmbracoProject/wwwroot/assets/css/styles.css`:

```css
/* ========================
   Article List Grid View
   ======================== */

.article-grid-card {
  border-radius: 0.5rem;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.article-grid-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.article-grid-card .card-title a {
  color: #212529;
  text-decoration: none;
}

.article-grid-card .card-title a:hover {
  color: #005E70;
}

.article-grid-card__no-image {
  width: 100%;
  height: 100%;
}
```

**Validation**: Hard-refresh the article list page in Grid mode. Cards should have rounded corners, a hover shadow, and the title link should turn teal on hover.

---

### Step 4 — Write E2E tests

> **Prompt**: Implement Step 4 of `_plans/shipped/article-list-grid-view.md`. Write the Playwright E2E test file at `tests/e2e/articleListGridView.spec.ts`. Tests must create all test data via the Management API in `beforeAll`, cover the acceptance criteria, and clean up in `afterAll`. Run the tests to confirm they pass.

**File**: `tests/e2e/articleListGridView.spec.ts`

**Test setup** (`beforeAll`):
1. Clean up stale "ALGV Test" pages from prior runs (walk tree, delete in reverse depth order)
2. Re-authenticate before each phase (token expiry)
3. Create an `articleList` page named "ALGV Test Article List" under the site root with `displayMode = "list"` initially
4. Create child `article` pages:
   - "ALGV Test Article 1" — title, subtitle, articleDate, metaDescription, categories, mainImage (pick an existing media item by walking the media tree)
   - "ALGV Test Article 2" — title, subtitle, articleDate, metaDescription, categories, mainImage
   - "ALGV Test Article 3" — title, subtitle, articleDate, **no mainImage**
   - "ALGV Test Article 4" — title, subtitle, articleDate, metaDescription, **no categories**
5. Publish all pages; store the actual article list URL from the API (do not hardcode slug)

**Test cases**:
1. `displayMode = "list"` (or unset): page renders `.post-preview` elements; no `.article-grid` present
2. After updating `displayMode = "grid"` via API + publish: page renders `.article-grid`; no `.post-preview` elements
3. Grid cards contain a link to the article inside `h2.card-title`
4. Grid cards contain a `.card-text` element with the article meta description
5. Grid card with categories shows `.badge` elements
6. Grid card for article with no `mainImage` renders without a broken `<img>` (placeholder div present instead)
7. Grid card for article with no categories renders without a categories section
8. At desktop viewport (1280×800): `.article-grid` child columns have `col` class and render in a multi-column row
9. At mobile viewport (375×812): cards stack vertically (only one card visible per row)
10. Switch back to `displayMode = "list"` via API + publish: `.post-preview` items reappear (regression check)

**Teardown** (`afterAll`): delete all ALGV Test pages via Management API.

**Run**: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/articleListGridView.spec.ts`

---

## File Summary

| Action | File |
|--------|------|
| Create (delete after running) | `scripts/add-article-list-display-mode.js` |
| Modify | `src/UmbracoProject/Views/Partials/blocklist/Components/latestArticlesRow.cshtml` |
| Modify (append) | `src/UmbracoProject/wwwroot/assets/css/styles.css` |
| Create | `tests/e2e/articleListGridView.spec.ts` |
