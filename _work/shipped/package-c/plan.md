# Plan: Package C — Per-template v2 hybrid rollout

## Context

Packages A (foundation tokens + chrome CSS) and B (10 Razor partials + 4 page-CSS files under `Views/Partials/v2/` and `wwwroot/assets/css/`) have shipped and are inert until templates opt in. Package C is the per-template cutover that wires every site template to the v2 chrome, adds the small `.uda` schema additions still needed (computed reading time, manifesto fields, page-head pattern picker), seeds new dictionary keys, retargets/retires the existing E2E specs whose selectors no longer match, and finally deletes the legacy partials.

**User decisions feeding this plan:**

1. **Legacy partial cleanup:** delete `mainNavigation.cshtml`, `pageHeader.cshtml`, `footer.cshtml`, and `master.cshtml` once every template is converted. No fallbacks.
2. **`MainImage` on Home:** keep the field as latent data (open-graph / future re-use). `_HeroHome` ignores it; nothing else changes.
3. **Pattern selection:** content-editor-controlled via a dropdown. Page-head pattern picker is added as a small dedicated composition (`pageHeadPatternControls`) and applied only to doc types that route to `_PageHead.cshtml`. Per-section pattern (e.g. inside `sectionRows` blocks) is out of scope for C — flagged as a future block-settings extension.
4. **Reading time:** computed from word count at view-render time (no manual field). 225 wpm baseline; floor of 1 minute.

**Spec source-of-truth:** the locked HTML mocks in [_design-system-handoff/mocks/](../_design-system-handoff/mocks/). Match the mock; flag any divergence.

**Branch:** `claude/feature/package-c-v2-rollout` (recommend a single long-lived branch with phase commits, since templates depend on Phase 0 schema/layout work).

---

## Architecture call: opt-in via a parallel `master-v2.cshtml`

Each converted template switches its `Layout` to a new `Views/master-v2.cshtml` (which renders `_SiteHead` and `_Footer` from `Views/Partials/v2/`). Existing templates keep `Layout = "master.cshtml"` until their cutover phase. This gives one-at-a-time isolation — converting Phase N never affects an unconverted Phase N+1 template. After Phase 8 ships, `master.cshtml` is deleted and `master-v2.cshtml` is renamed to `master.cshtml` in Phase 9.

---

## Phased rollout (each phase = one fresh-context prompt, GREEN at the end)

### Phase 0 — Foundation: layout, helpers, schema, dictionary

> **Prompt:** Implement Phase 0 of `_plans/shipped/package-c.md`. Create `Views/master-v2.cshtml`, the `ReadingTime` helper, the `pageHeadPatternControls` composition (via MCP), add `readingTime` to `articleControls` only as a placeholder hidden field (so existing PageHeaderViewModel callers can reference it), and seed all 12 new dictionary keys. Run `dotnet build` to confirm.

What ships:

1. **`src/UmbracoProject/Views/master-v2.cshtml`** — mirrors `master.cshtml` but renders `~/Views/Partials/v2/_SiteHead.cshtml` and `~/Views/Partials/v2/_Footer.cshtml` instead of `mainNavigation` / `footer`. Same `<head>` block (Package A's `tokens-extras.css` + `site-chrome.css` already loaded by master.cshtml — keep parity). Drop `metaData.cshtml` reference unchanged (still needed for SEO).

2. **`src/UmbracoProject/Helpers/ReadingTime.cs`** — static helper `Estimate(IPublishedContent article)` returning `"N min read"`. Iterates `article.Value<BlockListModel>("contentRows")` plus `sectionRows`; for each item, looks at `Content.Properties` for rich-text-typed values, strips HTML via simple regex, splits on whitespace, sums word counts, divides by 225 wpm, applies `Math.Max(1, Math.Ceiling(...))`. Returns null if Article has no body content. Cached per request via `IMemoryCache` keyed on `article.Id + article.UpdateDate.Ticks` to avoid re-computing on multiple calls in one render.

3. **MCP — new `pageHeadPatternControls` composition:**
   - `mcp__umbraco-mcp__create-data-type` → `[Dropdown] Page Head Pattern` (Umbraco.DropDown.Flexible) with items: `none`, `scatter`, `stochastic`. PropertyEditorUi: `Umb.PropertyEditorUi.Dropdown`. Single value, default `none`.
   - `mcp__umbraco-mcp__create-document-type` → `pageHeadPatternControls` composition with one property: alias `pageHeadPattern`, name "Page Head Pattern", data type from above, sort 5, group "Header" (or new group).
   - Add this composition to: `articleList`, `authorList`, `author`, `contact`, `content`, `documentation`. **Not** to `home`, `article`. (`error` template renders without an `error` doc type — pattern stays Razor-literal for 404s.)

4. **MCP — keep `MainImage` on Home as latent data.** No change required; just confirm `home.cshtml` after conversion does NOT reference it (so it harmlessly persists for OG / future use).

5. **MCP — Dictionary keys to seed.** Use `mcp__umbraco-mcp__create-dictionary-item` (or equivalent). Keys + suggested defaults (English):

   | Key | Default value |
   |---|---|
   | `Home.HeroEyebrow` | `The Human Signal` |
   | `Home.LatestTitle` | `The latest` |
   | `Home.ArchiveLink` | `Archive — all essays` |
   | `Home.DcPullEyebrow` | `From the lab` |
   | `Footer.PublicationHeading` | `Publication` |
   | `Footer.ElsewhereHeading` | `Elsewhere` |
   | `Footer.ColophonLeft` | `Built by Diagram · wearediagram.com` |
   | `Footer.ColophonRight` | (leave empty — partial falls back to `© {year}`) |
   | `Article.By` | `By` |
   | `Article.On` | `on` |
   | `Article.Posted` | `Posted` |
   | `Navigation.MenuTitle` | `Menu` |

   Verify the existing four `Article.*` / `Navigation.MenuTitle` keys aren't already present before re-creating.

6. **`_MastheadArticle.cshtml`, `_LatestSection.cshtml`, `_ArticleCard.cshtml`** — wire `ReadingTime.Estimate(article)` into the byline render. (Currently those partials degrade to "author + date" only.) Three small edits.

7. **`Helpers/PageHeadPatternExtension.cs`** — small extension `string PageHeadPattern(this IPublishedContent page)` that reads `pageHeadPattern` if the doc type has it, else returns null. Keeps templates clean.

**Verify:** `dotnet build` from `src/UmbracoProject` is clean. Restart Umbraco, open the backoffice, confirm "Page Head Pattern" dropdown appears on (e.g.) the Blog Landing doc type. Confirm new dictionary keys are visible under Translation. The site still renders identically to before — no template uses master-v2.cshtml yet.

---

### Phase 1 — Convert `error.cshtml` (404)

> **Prompt:** Implement Phase 1 of `_plans/shipped/package-c.md`. Convert `error.cshtml` to use master-v2.cshtml + `v2/_PageHead.cshtml` + `v2/_EmptyState.cshtml`. Match the layout of `_design-system-handoff/mocks/D-404.html`. Restart Umbraco and load any 404 path to verify visually.

Lowest risk — no content-model coupling, validates the v2 chrome end-to-end.

**File:** `src/UmbracoProject/Views/error.cshtml` — full rewrite. Switch `Layout = "master-v2.cshtml"`. Replace `pageHeader` partial call with literal `_PageHead` + `_EmptyState` calls following D-404.html's structure (eyebrow "404", h1, dek, "back to publication" link as an Action).

**Verify:** Visit `/this-page-does-not-exist`. Page should render with v2 chrome (sticky `.site-head`, `.foot` footer) and the `.page-head` + `.empty-state` body.

---

### Phase 2 — Convert `contact.cshtml`

> **Prompt:** Implement Phase 2 of `_plans/shipped/package-c.md`. Convert `contact.cshtml` to master-v2 + `_PageHead`. Keep the existing Umbraco Forms `RenderForm` ViewComponent integration intact. Wrap form output in `.wrap-narrow`. Match `_design-system-handoff/mocks/D-contact.html`.

**File:** `src/UmbracoProject/Views/contact.cshtml` — switch Layout, replace pageHeader with `_PageHead` (pull eyebrow/dek from `Model.Title` / `Model.Subtitle`, pattern from `Model.PageHeadPattern()`), wrap the `RenderForm` ViewComponent invocation in `<div class="wrap-narrow">…</div>`. Bootstrap form controls keep working (Bootstrap CSS still loads via styles.css).

**Verify:** `/contact` renders form successfully. Submit form — success/error messages display correctly inside `.wrap-narrow`.

---

### Phase 3 — Convert `AuthorList.cshtml` + `Author.cshtml`

> **Prompt:** Implement Phase 3 of `_plans/shipped/package-c.md`. Convert both Author templates to master-v2 + `_PageHead`. AuthorList renders an authors grid; Author detail renders bio + a list of that author's articles using `v2/_ArticleCard.cshtml`. Match `_design-system-handoff/mocks/D-authors.html` and `_design-system-handoff/mocks/D-author.html`.

**Files:**
- `src/UmbracoProject/Views/AuthorList.cshtml` — Layout switch, `_PageHead`, then iterate authors using existing `Views/Partials/authors.cshtml` (rewrite that partial too, into the v2 grid markup from D-authors.html).
- `src/UmbracoProject/Views/Author.cshtml` — Layout switch, `_PageHead`, bio body, then an `.archive-page .entries` grid of `_ArticleCard` for the author's authored articles (query Articles where `author` includes this Author node).
- Rewrite `src/UmbracoProject/Views/Partials/authors.cshtml` markup to match D-authors.html author-grid styling.

**Verify:** `/authors` and one author detail page (e.g. `/authors/dennis-kardys`) render with v2 chrome, page head, and article-card grid.

---

### Phase 4 — Convert `articleList.cshtml` (Blog landing)

> **Prompt:** Implement Phase 4 of `_plans/shipped/package-c.md`. Convert `articleList.cshtml` to master-v2 + `_PageHead` + `.archive-page` grid using `v2/_ArticleCard.cshtml`. Group articles by year (h2.year). Wire pagination to render `.pager` markup. Match `_design-system-handoff/mocks/D-blog.html`. The `.filters` bar is out of scope for this phase (no category-filter doc type yet) — render only the count.

**Files:**
- `src/UmbracoProject/Views/articleList.cshtml` — full rewrite. Layout switch. `_PageHead`. Existing pagination infra (`Components/Pagination`) keeps working — just style its rendered output to match `.pager`.
- May need to update `src/UmbracoProject/Views/Components/Pagination/Default.cshtml` if the markup it emits doesn't match `.pager`. Replace Bootstrap pagination classes with `.pager` / `.pager .on`.

**Verify:** `/blog` (or whatever route ArticleList resolves to) renders v2 chrome + page-head + year-grouped grid + pager. Pagination still navigates pages correctly.

---

### Phase 5 — Convert `search.cshtml`

> **Prompt:** Implement Phase 5 of `_plans/shipped/package-c.md`. Convert `search.cshtml` to master-v2 + `_PageHead` + listings. Render results as `_ArticleCard`. When zero results, render `_EmptyState`. Keep the Umbraco AI Search `ISearcher` integration intact. Match `_design-system-handoff/mocks/D-search.html`.

**File:** `src/UmbracoProject/Views/search.cshtml` — preserve `ISearcherResolver.GetSearcher(...)` / `SearchAsync(indexAlias: "UmbAI_Search", ...)` logic from current implementation. Layout switch + `_PageHead` (eyebrow "Search", h1 "Results for {query}"). Iterate results, render `_ArticleCard` per Article result. Pagination via existing Pagination component.

**Verify:** `/search?query=ethics` returns v2-styled results. `/search?query=zzznoresults` shows the `_EmptyState`.

---

### Phase 6 — Convert `content.cshtml` + `documentation.cshtml` + section-nav refactor

> **Prompt:** Implement Phase 6 of `_plans/shipped/package-c.md`. Convert both Content templates to master-v2 + `_PageHead`, wrap body in the new `.content` grid with the `.section-nav` aside (when enabled), and rewrite `Views/Partials/sectionNavigation.cshtml` to emit the v2 class vocabulary. Match `_design-system-handoff/mocks/D-content.html`. Append `.section-nav` styles to `wwwroot/assets/css/site-chrome.css`. Update `tests/e2e/sectionNavigation.spec.ts` selectors.

**Files:**
- `src/UmbracoProject/Views/content.cshtml` and `src/UmbracoProject/Views/documentation.cshtml` — Layout switch, `_PageHead`, then wrap body in `<main class="content[ no-nav]"><aside class="section-nav">… (when `showSectionNavigation`)<div class="c-body">@Html.GetBlockListHtml(Model.ContentRows)</div></main>`.
- `src/UmbracoProject/Views/Partials/sectionNavigation.cshtml` — full markup rewrite to v2 vocabulary: `<aside class="section-nav" aria-label="In this section">`, `.eye` heading, `<ul>` with `.is-current` and `li.child` modifiers. Drop the Bootstrap-collapse mobile pattern (the v2 mock has no toggle — section-nav becomes a static block at narrow widths via `.section-nav { position: static }`).
- Append `.section-nav` block from D-content.html's inline `<style>` to `src/UmbracoProject/wwwroot/assets/css/site-chrome.css`. Tied to `.content` grid styles for the two-column layout.
- Update `tests/e2e/sectionNavigation.spec.ts` — retarget selectors from `.section-nav-desktop` / `.section-nav-mobile` / `.section-nav-toggle` to plain `.section-nav` + `.section-nav a.is-current` + `.section-nav li.child`. Remove mobile-toggle assertions; add `position: static` assertion at narrow viewport.

**Verify:** Existing section-nav E2E suite passes against new selectors. `/about` (or any Content page with section-nav enabled) renders the two-column layout with the v2 sidebar styling.

---

### Phase 7 — Convert `article.cshtml` + retarget `siteHeader.spec.ts`

> **Prompt:** Implement Phase 7 of `_plans/shipped/package-c.md`. Convert `article.cshtml` to master-v2 + `v2/_MastheadArticle.cshtml`. Wrap article body in `.art-body` with the v2 typography. Add the "Next up" footer block when sibling articles exist. Retarget `tests/e2e/header/siteHeader.spec.ts` from `header.masthead` to `.art-head`. Match `_design-system-handoff/mocks/D-article.html`.

**Files:**
- `src/UmbracoProject/Views/article.cshtml` — Layout switch. Replace `pageHeader` partial call with `v2/_MastheadArticle` (PageHeaderViewModel contract is unchanged). Wrap `Html.GetBlockListHtml(Model.ContentRows)` in `<div class="art-body">…</div>`. Append `.next` block when `Model.Parent.Children` has Articles before/after the current one (use `articleDate` ordering).
- `tests/e2e/header/siteHeader.spec.ts` — retarget `header.masthead` assertions at `.art-head`. Keep the `#mainNav`-related assertions BUT route them at the legacy fallback path until Phase 9 (or retire them now if no template still uses `#mainNav`). Since by Phase 7 every article uses `.art-head` and no other template still emits `header.masthead`, retiring `header.masthead` assertions outright is also acceptable — coordinate with the user.

**Verify:** Browse to any article page — text-led `.art-head` renders with kicker / h1 / dek / byline (with `ReadingTime.Estimate` populating "X min read"). Inline `.art-hero` figure shows MainImage. siteHeader.spec.ts passes.

---

### Phase 8 — Convert `home.cshtml` + Home schema additions

> **Prompt:** Implement Phase 8 of `_plans/shipped/package-c.md`. Add the Home doc-type fields needed by `_Manifesto` and `_DcPull` (manifesto* + optional pullQuote*) via MCP, then convert `home.cshtml` to render `_HeroHome` + `_LatestSection` + `_DcPull` + `_Manifesto` + master-v2 chrome. Match `_design-system-handoff/mocks/D-hybrid.html`. Verify ArticleList exists as a child of Home in the content tree.

**Schema (MCP):**

Add to the `Home` doc type (or a new `homeContentControls` composition applied only to Home):

| Alias | Name | Data type | Sort | Mandatory |
|---|---|---|---|---|
| `manifestoEyebrowLeft` | Manifesto Eyebrow (left) | Textstring | 50 | No |
| `manifestoTitle` | Manifesto Title | Textstring | 51 | No |
| `manifestoBody` | Manifesto Body | RichText | 52 | No |
| `manifestoEyebrowRight` | Manifesto Eyebrow (right) | Textstring | 53 | No |
| `manifestoAudience` | Manifesto Audience | Textarea (multi-line) | 54 | No |
| `pullQuote` | Pull Quote | Textarea | 60 | No |
| `pullQuoteAttribution` | Pull Quote Attribution | Textstring | 61 | No |

`_DcPull.cshtml` already accepts these as Razor params; if `pullQuote` is empty the section silently doesn't render. `_Manifesto.cshtml` already silent-no-ops when manifesto fields are empty (per Package B).

**File:** `src/UmbracoProject/Views/home.cshtml` — full rewrite. Layout switch. Render `_HeroHome` → `_LatestSection` → `_DcPull` (passing `Quote = home.PullQuote`, `Cite = home.PullQuoteAttribution`) → `_Manifesto`. Existing `Html.GetBlockListHtml(Model.ContentRows)` is dropped since the v2 home is composed of fixed sections, not block lists. (Confirm the user is OK with this — alternative is to keep ContentRows after Manifesto as an authoring-flexibility escape hatch.)

**Verify:** `/` renders the v2 home: hero, latest section with 4 articles from ArticleList, pull-quote, manifesto, footer. If ArticleList isn't a Home child in the content tree, _LatestSection silently returns — open backoffice to confirm tree structure.

---

### Phase 9 — Cleanup: delete legacy partials, retire/port remaining tests

> **Prompt:** Implement Phase 9 of `_plans/shipped/package-c.md`. Delete `master.cshtml`, rename `master-v2.cshtml` → `master.cshtml`, delete `mainNavigation.cshtml`, `pageHeader.cshtml`, `footer.cshtml`. Update every template's `Layout = "master-v2.cshtml"` back to `Layout = "master.cshtml"`. Port or retire `tests/e2e/footer/updatedFooter.spec.ts` and any remaining selectors locked to legacy chrome. Run the full Playwright suite.

**Files removed:**
- `src/UmbracoProject/Views/master.cshtml`
- `src/UmbracoProject/Views/Partials/mainNavigation.cshtml`
- `src/UmbracoProject/Views/Partials/pageHeader.cshtml`
- `src/UmbracoProject/Views/Partials/footer.cshtml`

**Files renamed:**
- `src/UmbracoProject/Views/master-v2.cshtml` → `src/UmbracoProject/Views/master.cshtml`
- All template `Layout = "master-v2.cshtml"` → `"master.cshtml"`

**Test work:**
- `tests/e2e/footer/updatedFooter.spec.ts` — port `footer.site-footer / .footer-brand / .footer-nav / .footer-description` selectors to `.foot / .foot .col / .foot .fm / .foot .colophon`. CSS-content tests probably retire (the new styles are in `site-chrome.css`, not `styles.css`).
- `tests/e2e/header/siteHeader.spec.ts` — `#mainNav` assertions retire; keep `.site-head`/`.site-nav` ports.
- `tests/e2e/linkStyles.spec.ts` — port `#mainNav .nav-link` to `.site-head .site-nav a`.
- `tests/e2e/articleListGridView.spec.ts` — `.article-grid-card` still used by `_ArticleCard`, should pass without change. Re-run to confirm.

**Section navigation** — `tests/e2e/sectionNavigation.spec.ts` already retargeted in Phase 6.

**Optional:** delete `src/UmbracoProject/wwwroot/assets/css/masthead-overlay.css` if no template uses `.masthead--dc`. (Currently none do.) Leaving it costs ~1.5 KB and could be useful for future image-led variants — recommend keep for now.

**Verify:** Full Playwright suite green. `dotnet build` clean. Visit every public route in a browser — every page should match its corresponding mock.

---

## Deferred / out of scope

- **Topic / Tag landing routes (D-tag.html).** No `Topic` doc type exists today and `categories` on Article aren't surfaced on a public route. Adding a tag-archive route is a future feature.
- **Filter bar on Blog landing (D-blog.html `.filters`).** No category-filter doc type yet — the v2 mock shows tabs (Essays / From Ella / Notebook). Defer to a category-filter feature; Phase 4 ships only the `.filters .count` element.
- **Per-section pattern picker.** Page-head pattern is editor-controlled; per-section pattern (block-settings dropdown on `sectionRows`) is a future block extension.
- **Article DC overlay / `masthead-overlay.css` activation.** No template uses `.masthead--dc` — file ships in case a future variant wants it.

---

## Critical files

| File | Action | Phase |
|---|---|---|
| `src/UmbracoProject/Views/master-v2.cshtml` | Create | 0 |
| `src/UmbracoProject/Helpers/ReadingTime.cs` | Create | 0 |
| `src/UmbracoProject/Helpers/PageHeadPatternExtension.cs` | Create | 0 |
| `Views/Partials/v2/_MastheadArticle.cshtml`, `_LatestSection.cshtml`, `_ArticleCard.cshtml` | Edit (wire `ReadingTime`) | 0 |
| `umbraco/Deploy/Revision/data-type__*.uda` (new dropdown) | MCP-modified | 0 |
| `umbraco/Deploy/Revision/document-type__*.uda` (new composition + applied) | MCP-modified | 0, 8 |
| `Views/error.cshtml` | Rewrite | 1 |
| `Views/contact.cshtml` | Rewrite | 2 |
| `Views/Author.cshtml`, `AuthorList.cshtml`, `Partials/authors.cshtml` | Rewrite | 3 |
| `Views/articleList.cshtml`, `Views/Components/Pagination/Default.cshtml` | Rewrite / edit | 4 |
| `Views/search.cshtml` | Rewrite | 5 |
| `Views/content.cshtml`, `documentation.cshtml`, `Partials/sectionNavigation.cshtml` | Rewrite | 6 |
| `wwwroot/assets/css/site-chrome.css` | Append `.content` + `.section-nav` rules | 6 |
| `Views/article.cshtml` | Rewrite | 7 |
| `tests/e2e/header/siteHeader.spec.ts` | Retarget | 7 |
| `Views/home.cshtml` | Rewrite | 8 |
| `Views/Partials/{mainNavigation,footer,pageHeader}.cshtml`, `Views/master.cshtml` | Delete | 9 |
| `tests/e2e/footer/updatedFooter.spec.ts`, `linkStyles.spec.ts`, `sectionNavigation.spec.ts` | Port/retire | 9 (6 for sec-nav) |

## Existing code & patterns to reuse

| Pattern | Source |
|---|---|
| `Author` resolution from Article | `Views/article.cshtml:10-11` — `Model.Author` returns `IEnumerable<Author>` |
| `home.FirstChild<ArticleList>()` + `.Children<Article>()` filter pattern | `Views/Partials/blocklist/Components/latestArticlesRow.cshtml:19` |
| Pagination ViewComponent | `Views/Components/Pagination/` |
| Search via `ISearcherResolver` / `UmbAI_Search` index | `Views/search.cshtml` (current impl) |
| Umbraco Forms `RenderForm` ViewComponent | `Views/contact.cshtml:39` |
| Block List traversal for word-count helper | `BlockListModel`/`BlockListItem` API; see how `Views/Partials/contentSectionRow.cshtml` iterates |
| Composition lookup via `getChildren(folderId)` (testhelpers bug workaround) | `tests/e2e/footer/updatedFooter.spec.ts:28` and CLAUDE.md "E2E Test Resilience Rules" |

## End-to-end verification (run after Phase 9)

1. `dotnet build` from `src/UmbracoProject` — clean.
2. `dotnet run`; visit every route in a browser at desktop and 390px-narrow widths, comparing against the corresponding `D-*.html` mock:
   - `/` (home → D-hybrid)
   - `/blog` (or whatever ArticleList resolves to → D-blog)
   - `/blog/{slug}` (article → D-article)
   - `/authors` and `/authors/{slug}` (D-authors / D-author)
   - `/contact` (D-contact)
   - `/search?query=…` and `/search?query=zzz` (D-search + empty)
   - `/about` (D-about/D-content via Content doc type)
   - `/this-does-not-exist` (D-404)
3. Run full Playwright suite:
   ```bash
   PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test
   ```
   All green.
4. Run `/check-uda` — confirm only intentional schema artifacts changed under `umbraco/Deploy/Revision/`. Discard any incidental regenerations with `git checkout --` per CLAUDE.md.
5. Verify dictionary keys in the backoffice Translation tree.
6. Verify `_Manifesto` / `_DcPull` Home content fields populate correctly when authored.
7. Smoke-check open-graph: confirm `MainImage` on Home still emits valid `og:image` metadata (it's referenced by `Views/Partials/metaData.cshtml`) — preservation goal per user decision #2.
