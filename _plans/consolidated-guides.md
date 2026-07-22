# Plan: Consolidated Guides

**Spec**: `_specs/consolidated-guides.md`
**Branch**: `claude/feature/consolidated-guides` (already checked out)
**Work type**: change-to `styleguide-and-component-guide` — carried from the spec; drives the final step. Also touches `_features/editor-how-to-guides.md` behavior (Guides-parent wayfinding + how-to guides stay reachable). No new `_features/consolidated-guides.md`.

## Context

Today the "guides" surfaces are fragmented: the Styleguide is its own `styleGuidePage` doc type (root-level, `/styleguide`), the Component Guide is a generic `content` page detected by a parent-alias string in `content.cshtml` (`/styleguide/components`), and `Guides` is a third doc type parenting the how-to guides. This work introduces **one consolidated `guidePage` doc type** that backs both the Styleguide and the Component Guide, lays out its body with a **new guide-specific Block Grid**, renders an **auto-derived left-column table of contents**, and drops the section-navigation toggle. Both pages move under `/guides/` (`/guides/styleguide`, `/guides/component-guide`) with 301 redirects from the legacy URLs. How-to guides (the `guides.cshtml` parent, `howToGuidePage`, the guide-generator CLI) are untouched and must stay green.

Grounding facts discovered during planning (see **Key Decisions** for IDs). `_StyleGuideSectionRows.cshtml` is already the shared Block-**List** section renderer for `styleGuidePage`, the styleguide-tree `content` page, `guides`, and `howToGuidePage` — it stays for the how-to (Block List) path and is **not** refactored here. The new guide body is Block **Grid**, so it gets its own renderer.

---

## Key Decisions

- **Reuse existing compositions — no new one.** `guidePage` composes **SEO Controls** (`sEOControls`, id `9090575e-290c-4585-91a4-b72ec30ff41f` — `metaName`/`metaDescription`/`metaKeywords`/`isIndexable`/`isFollowable`) + **Guide Visibility Controls** (`guideVisibilityControls`, id `e0a344ad-686a-4b23-b31b-8801ee6d1c61` — `hideFromTopNavigation`/`umbracoNaviHide`="Hide From Search"/`hideFromXMLSitemap`). Verified via MCP: this pair is exactly the spec's control surface and carries **no** section-nav toggle. It's the same pair `guides`/`howToGuidePage` use → consistent `/guides/` family. Do **not** compose `Section Navigation Controls` (`ef741d00-fa22-4ab6-b5ba-1b450850a350`) or the legacy `Visibility Controls` (`7cebdc47-…`, which carries `showSectionNavigation`).
- **Sections are a grid-only `guideSection` wrapper block (title + one content area).** This is the "section heading" the TOC auto-derives from — deterministic, matches the editor's existing `sectionRows → sectionContent` mental model, and cleanly satisfies the edge cases (duplicate titles, empty guide). It's grid-only (uses Block Grid *areas*, like `pillarSection`) → its view lives at `Views/Partials/blockgrid/Components/guideSection.cshtml` and it's a **documented render-coverage exception** (offered only in the Guide Body grid, never in a Block List). The shared editor-agnostic content blocks (richTextRow, imageRow, colorPaletteBlock, …) are placed **inside** a guideSection's area.
- **TOC auto-derives from `guideSection` titles via a shared, dedupe-aware slug map.** A C# helper `GuideToc.BuildSlugMap(BlockGridModel)` (in the Features RCL) slugifies each top-level `guideSection`'s `sectionTitle` and dedupes collisions (`examples`, `examples-2`, …), returning `IReadOnlyDictionary<Guid,string>` keyed on `block.Content.Key`. The `guidePage` template builds it once, stashes it in `ViewData["GuideSlugMap"]`, renders `_GuideToc.cshtml` from it, then renders the grid; `guideSection.cshtml` reads its own slug from `ViewData` by key (fallback to plain slugify). One source of truth → TOC anchors and section `id`s always agree. Slugify rules mirror the existing hand-rolled one in `_StyleGuideSectionRows.cshtml` (lowercase, letters/digits kept, everything else → single dash, trimmed).
- **New Block Grid data type `[BlockGrid] Guide Body`.** Per resolved open question — do not reuse `[BlockGrid] Experiments Body`. Root blocks = `[guideSection]`; the guideSection area allows the shared content palette (mirror `[BlockList] Main Content`'s content blocks) **plus** the three programmatic styleguide blocks: Color Palette Block (`66b8b35f-597b-4068-bb92-bc47257eec0c`), Typography Showcase Block (`00299553-22a8-4f14-9d76-4ba46e92d833`), General Elements Block (`a5d1d688-2f37-4cb2-8c0c-08a288982e6e`).
- **Tree & URLs.** New `guidePage` instances live under `Guides` (`d977a895-b890-4bed-8742-a89a1926f55d`): `/guides/styleguide` + `/guides/component-guide`. `guidePage` is **not** `allowedAsRoot`; add it to Guides' allowed children (alongside the existing `howToGuidePage`). How-to guides **stay direct children of `/guides/`** (`/guides/how-to-use-…`) — do NOT introduce a `/guides/how-to-guides/` parent node (would break the guide-generator CLI and AC10). "How-To Guides" in the wayfinding is a *link to the collection*, not a new node.
- **Legacy-URL redirects via middleware, not DB entries.** Since the new pages are new nodes (not renamed ones), URL Tracker won't auto-redirect. Add a `GuideRedirectMiddleware` in `UmbracoProject.Features/Infrastructure/` (mirrors the existing `SitemapRewriteMiddleware`), registered `app.UseGuideRedirects()` in `Program.cs` before `app.UseUmbraco()`. 301: `/styleguide` → `/guides/styleguide`, `/styleguide/components` → `/guides/component-guide`. Deployable + environment-agnostic (a DB `umbracoRedirectUrl` seed would be per-environment and non-deployable).
- **Remove the `content.cshtml` parent-alias coupling.** Strip the `Model.Parent?.ContentType?.Alias == "styleGuidePage"` branch (currently `content.cshtml` lines ~13–32 and ~55–71, inside a `#pragma warning disable CS0618`). After removal, `content` pages render normally (no styleguide wrapper/TOC), and the Component Guide no longer depends on being a styleguide child.
- **Retire `styleGuidePage` after the new pages verify.** Delete the two legacy content nodes, then the `styleGuidePage` doc type + `Views/styleGuidePage.cshtml` template. Keep `_StyleGuideSectionRows.cshtml` (how-to guides still use it) and keep the three programmatic block element types (reused by the Guide Body). Sequenced last so nothing is deleted before its replacement is live and green.
- **ModelsBuilder is `SourceCodeManual`** — after every schema change, regenerate models (Settings → ModelsBuilder → Generate, or `POST /umbraco/management/api/v1/models-builder/build`) and commit the updated `*.generated.cs` under `src/UmbracoProject.Features/Models/Generated/` (new: `GuidePage`, `GuideSection`).
- **MCP is connected** (verified this session against the running local site on `:44367`). AC9 create/populate is unblocked. Chunk content population **section-by-section** to avoid the AI large-output ceiling (`[[project_ai_copilot_large_output_ceiling]]`).
- **Entity IDs created in Step 1** (for Steps 2/6/7): Guide Section element type `10554847-fbd9-4a12-826c-7c4663b841e9`; `[BlockGrid] Guide Body` data type `32deaf60-58fe-4ce4-a21c-f6d88f206c75`; `guidePage` doc type `1c46d845-4221-4d2e-9e1d-cfa5b47cbee1`. The Guide Body palette carries 17 content blocks (Main Content's set — the 3 programmatic blocks already included) with settings element-type keys carried over. **Step 1 did not link a template** — Step 2 creates + links the `guidePage` template.

---

## Steps

Each step is designed to be completed independently in its own context window. The step heading contains a ready-to-use prompt.

---

### Step 1 — Schema: `guidePage` doc type + `[BlockGrid] Guide Body` + `guideSection` block

> **Prompt**: Implement Step 1 of `_plans/consolidated-guides.md`. Create a runnable setup script `scripts/setup-consolidated-guides-schema.mjs` (mirror the structure of `scripts/setup-guides-schema.mjs` — OAuth client-credentials token from `.env`, Management API calls, resolve dependencies by name not hardcoded ids). It must, idempotently: (1) create an element type **Guide Section** (alias `guideSection`, icon `icon-layout color-indigo`) with a `sectionTitle` Textstring property; (2) create a Block Grid data type **[BlockGrid] Guide Body** whose root allows only `guideSection`, and configure a single area inside `guideSection` allowing the shared content blocks used by `[BlockList] Main Content` plus the three programmatic blocks (Color Palette `66b8b35f-597b-4068-bb92-bc47257eec0c`, Typography Showcase `00299553-22a8-4f14-9d76-4ba46e92d833`, General Elements `a5d1d688-2f37-4cb2-8c0c-08a288982e6e`); (3) create a doc type **Guide Page** (alias `guidePage`, template alias `guidePage`) composing `sEOControls` (`9090575e-290c-4585-91a4-b72ec30ff41f`) and `guideVisibilityControls` (`e0a344ad-686a-4b23-b31b-8801ee6d1c61`), with a `body` property bound to the Guide Body data type, `allowedAsRoot: false`; (4) add `guidePage` to the allowed children of the `Guides` doc type (`d977a895-b890-4bed-8742-a89a1926f55d`), keeping `howToGuidePage` allowed. Then regenerate ModelsBuilder models and commit `GuidePage.generated.cs` + `GuideSection.generated.cs`. Do not create any content nodes yet. Do NOT compose `Section Navigation Controls` or `Visibility Controls`.

**What to build**:
- `scripts/setup-consolidated-guides-schema.mjs` (create; keep for re-runs — it's idempotent).
- Element type `guideSection` — `sectionTitle` (Textstring, resolve data type "Textstring" by name).
- Data type `[BlockGrid] Guide Body` — root block `guideSection`; guideSection area allows the Main Content content blocks + the 3 programmatic blocks.
- Doc type `guidePage` — compositions `sEOControls` + `guideVisibilityControls`; property `body` → Guide Body; template `guidePage`; not root.
- `Guides` doc type: allowed children now `{ howToGuidePage, guidePage }`.
- Regenerate + commit `src/UmbracoProject.Features/Models/Generated/{GuidePage,GuideSection}.generated.cs`.

**Validation**:
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" node scripts/setup-consolidated-guides-schema.mjs` completes without error; re-running is a no-op (idempotent).
- [Automated]: `cd src/UmbracoProject && dotnet build` succeeds after committing regenerated models.
- [Manual]: In the backoffice, Settings → Document Types → **Guide Page** shows an SEO tab + a Visibility tab (Hide From Top Navigation / Hide From Search / Hide From XML Sitemap) and a `body` Block Grid property, and **no** "Show section navigation" property. Content → Guides → create-child menu offers **Guide Page**.

---

### Step 2 — Guide Page template, TOC, `guideSection` view + slug helper

> **Prompt**: Implement Step 2 of `_plans/consolidated-guides.md`. Build the render path for the `guidePage` doc type created in Step 1. **Step 1 left the template unlinked** — so first create the `guidePage` template entity (alias `guidePage`) and set it as `guidePage`'s default template (via the Management API / MCP, mirroring how other page templates are registered), otherwise the page won't resolve a view at its URL. Then: (a) Add a C# helper `GuideToc` to the Features RCL at `src/UmbracoProject.Features/Services/Guides/GuideToc.cs` (namespace `UmbracoProject.Features.Services.Guides`) with `static string Slugify(string)` (lowercase, keep letters/digits, other chars → single dash, trim — mirror `_StyleGuideSectionRows.cshtml`) and `static IReadOnlyDictionary<Guid,string> BuildSlugMap(BlockGridModel body)` that iterates top-level `guideSection` items, reads `sectionTitle`, slugifies, and dedupes collisions by suffixing `-2`, `-3`, … keyed on `item.Content.Key`. (b) Create `src/UmbracoProject/Views/guidePage.cshtml` (`UmbracoViewPage<GuidePage>`, `Layout = "master.cshtml"`, link `/assets/css/styleguide.css`, render the v2 `_PageHead` with `Model.Name` as the title and eyebrow "Guide"): build the slug map from `Model.Body`, put it in `ViewData["GuideSlugMap"]`, render `~/Views/Partials/_GuideToc.cshtml` (passing the map), then render the grid body. (c) Create `src/UmbracoProject/Views/Partials/_GuideToc.cshtml` — renders `<nav class="styleguide__nav" aria-label="On this page">` with an ordered list of `<a href="#{slug}">{title}</a>` **only when there is more than one section** (mirror the existing `.styleguide__nav` markup/classes so existing CSS applies). (d) Create `src/UmbracoProject/Views/Partials/blockgrid/Components/guideSection.cshtml` (`UmbracoViewPage<IBlockReference<IPublishedElement, IPublishedElement>>` per the shared-view contract) — wrap the section in `<section id="@slug" class="styleguide__section-anchor">` where slug comes from `ViewData["GuideSlugMap"]` by `Model.Content.Key` (fallback `GuideToc.Slugify(sectionTitle)`), emit `<h2 class="section-row__title">{sectionTitle}</h2>`, then render the section's grid area(s) via the standard Block Grid area helper so the shared content-block views render its children. Run `cd src/UmbracoProject && dotnet build`.

**What to build**:
- `src/UmbracoProject.Features/Services/Guides/GuideToc.cs` (`Slugify`, `BuildSlugMap` with dedupe).
- `src/UmbracoProject/Views/guidePage.cshtml`.
- `src/UmbracoProject/Views/Partials/_GuideToc.cshtml`.
- `src/UmbracoProject/Views/Partials/blockgrid/Components/guideSection.cshtml` (grid-only; documented render-coverage exception).

**Test first** *(unit)*:
- Add `tests/UmbracoProject.Tests/GuideTocTests.cs` asserting `Slugify` (punctuation/non-ASCII → valid stable slug; e.g. `"Buttons & Forms!"` → `"buttons-forms"`) and that `BuildSlugMap` yields distinct slugs for two sections both titled "Examples" (`examples`, `examples-2`).
- Run: `cd src/UmbracoProject.Features && dotnet build` then `dotnet test ../../tests/UmbracoProject.Tests` — confirm RED before writing `GuideToc`, GREEN after.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build` succeeds (Razor compiles under build-time compilation); `dotnet test` GREEN for `GuideTocTests`.
- [Manual]: Deferred to Step 6 (no `guidePage` content exists yet). After Step 6, a Guide Page shows the left-column "On this page" TOC and clicking an entry scrolls to that `<section id>`.

---

### Step 3 — Remove the `content.cshtml` styleguide-tree coupling

> **Prompt**: Implement Step 3 of `_plans/consolidated-guides.md`. In `src/UmbracoProject/Views/content.cshtml`, remove the `inStyleGuideTree` logic that keys off `Model.Parent?.ContentType?.Alias == "styleGuidePage"` — including the `#pragma warning disable CS0618` block that computes it (~lines 13–24), the conditional `@section Styles` styleguide.css injection (~lines 27–32), and the `if (inStyleGuideTree) { … } else { … }` split around section-row rendering (~lines 55–71). Keep the normal content-page rendering (the `else` branch behavior becomes the only behavior: loop `sectionRows` through `contentSectionRow.cshtml`, full width, no `.styleguide` wrapper, no TOC). Leave the independent `ContentRows` + section-navigation logic (the `showSectionNavigation` / `no-nav` layout) untouched — it is not part of the styleguide coupling. Run `cd src/UmbracoProject && dotnet build`.

**What to build**:
- Modify `src/UmbracoProject/Views/content.cshtml` — delete the styleguide-tree branch only.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build` succeeds; `grep -n "styleGuidePage" src/UmbracoProject/Views/content.cshtml` returns nothing.
- [Manual]: A normal `content` page (e.g. an existing one under Home, not the styleguide) still renders correctly with its section rows and, where enabled, its section-navigation sidebar.

---

### Step 4 — Legacy-URL 301 redirect middleware

> **Prompt**: Implement Step 4 of `_plans/consolidated-guides.md`. Add `GuideRedirectMiddleware` to the Features RCL at `src/UmbracoProject.Features/Infrastructure/GuideRedirectMiddleware.cs` (mirror the existing `SitemapRewriteMiddleware` in the same folder for style/registration pattern), plus an `app.UseGuideRedirects()` extension. It issues a 301 permanent redirect for exact path matches (case-insensitive, trailing-slash tolerant): `/styleguide` → `/guides/styleguide` and `/styleguide/components` → `/guides/component-guide`. Register it in `src/UmbracoProject/Program.cs` before `app.UseUmbraco()` (next to `app.UseSitemapRewrite()`, after `UseHttpsRedirection()`). Run `cd src/UmbracoProject && dotnet build`.

**What to build**:
- `src/UmbracoProject.Features/Infrastructure/GuideRedirectMiddleware.cs` + `UseGuideRedirects()` extension.
- Modify `src/UmbracoProject/Program.cs` — register the middleware.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build` succeeds.
- [Manual]: With the site running, `curl -sI http://localhost:64853/styleguide` returns `301` with `Location: /guides/styleguide`; same for `/styleguide/components` → `/guides/component-guide`. (Full assertion is codified in the Step 5 e2e URL-stability test.)

---

### Step 5 — Adapt & extend E2E tests (write to RED)

> **Prompt**: Implement Step 5 of `_plans/consolidated-guides.md`. Update the existing Playwright specs to target the consolidated `guidePage` type and new `/guides/…` URLs, and add the new coverage. Follow the E2E resilience rules in CLAUDE.md (dynamic id/slug lookup via Management API, clean-before-create, regex CSS assertions, prefer browser assertions; reuse `tests/e2e/_helpers.ts` / `tests/e2e/_umbracoApi.ts` and the `freshToken()` pattern). Do not hardcode UUIDs/slugs. (a) `tests/e2e/styleguide.spec.ts` — retarget to `guidePage` at `/guides/styleguide`; assert schema: doc type `guidePage` composes `sEOControls` + `guideVisibilityControls`, has a Block Grid `body`, and has **no** `showSectionNavigation`/`hideFromSectionNavigation`/Section Navigation Controls; assert the brand-fundamentals render (colors/type/buttons/tables/forms/RTE styles/background patterns). (b) `tests/e2e/styleguide-components.spec.ts` — retarget to `guidePage` at `/guides/component-guide`; keep the idempotent ensure-page pattern; assert every showcase block renders with a description, links to a how-to guide when one exists, and shows no broken link when none exists. (c) Add TOC assertions to the styleguide spec: one anchor link per section, each targets an existing on-page `id`; a fixture that adds a section produces a new TOC entry. (d) Add a URL-stability test asserting `GET /styleguide` → 301 `/guides/styleguide` and `/styleguide/components` → 301 `/guides/component-guide`. (e) Confirm `tests/e2e/guides.spec.ts` and `guides-cli.spec.ts` still pass unchanged (how-to guides untouched); update only the `Guides` allowed-children assertion to include `guidePage`. Run the specs and confirm the content/browser assertions are RED (pages not yet populated) while schema assertions may already be GREEN. Run: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/styleguide.spec.ts tests/e2e/styleguide-components.spec.ts`.

**What to build**:
- Modify `tests/e2e/styleguide.spec.ts` (retarget + TOC + schema no-section-nav assertions).
- Modify `tests/e2e/styleguide-components.spec.ts` (retarget + description/how-to-link/broken-link assertions).
- Add a URL-stability spec (in `styleguide.spec.ts` or a small `tests/e2e/guide-redirects.spec.ts`).
- Minor edit to `tests/e2e/guides.spec.ts` (allowed-children includes `guidePage`).

**Review carry-over (deferred here from the Step 2 & Step 4 `/code-review`s) — must be covered by this step:**
- **(pre-req) Retarget the redirected specs (was Blocker, Step 4 review).** Step 4's `GuideRedirectMiddleware` 301s `/styleguide/components` → `/guides/component-guide`, so the *existing* `styleguide-components.spec.ts` assertions on `/styleguide/components` (200 + that URL) are **expected-red between Step 4 and this step** — retargeting them to `/guides/component-guide` under (b) below clears it. (These specs only run in Gate 2 / master, not the feature branch's Gate 1, so they don't gate intermediate pushes.)
- **(f) Duplicate-title anchor uniqueness + ViewData-propagation regression test (was Major U-1/U-5).** The slug de-dup that keeps two same-titled sections on distinct anchors relies on `ViewData["GuideSlugMap"]` propagating through `GetBlockGridHtmlAsync → items.cshtml → PartialAsync` (verified correct at Step 2, but only guarded in C# unit tests, not end-to-end). Add a spec that creates a `guidePage` with **two `guideSection` blocks whose titles are identical**, renders it, and asserts (i) the two `<section id>`s are distinct, (ii) each TOC `href="#…"` resolves to exactly one on-page `id`. This is the only test that exercises `BuildSlugMap`'s real wiring (the `"guideSection"` alias + `"sectionTitle"` property lookup), so a typo there also gets caught. `sectionTitle` is now **mandatory** (set at Step 2's `/code-review`), so use non-empty distinct-but-colliding titles (e.g. two "Examples").
- **(g) Extend/annotate `BlockRenderCoverageTests` for the Guide Body palette (was Minor U-4).** The test currently scans only `[BlockList] Main Content` + `[BlockGrid] Experiments Body`; it does **not** look at `[BlockGrid] Guide Body`, so it says nothing about `guideSection`. Either extend it to scan Guide Body (and register `guideSection` as a documented grid-only exception, like `pillarSection`), or add a class-summary comment recording that Guide Body is intentionally out of scope. Coordinate with Step 8 (which also touches the documented-exceptions list).
- **(optional, a11y follow-up)** Step 2's views already add `tabindex="-1"` to each section; the full keyboard-focus fix (a `hashchange`→`.focus()` script for in-page anchors) is a **site-wide** concern that also affects the existing styleguide TOC and is **out of scope** for this plan — file it separately if pursued.

**Test first**: This *is* the test step — write assertions before the content they cover exists. Content/browser assertions RED now; they go GREEN after Step 6. Schema + redirect assertions should already be GREEN (Steps 1 & 4).

**Validation**:
- [Automated]: Named specs run; schema/redirect assertions GREEN, content/browser assertions RED with a clear "page not found / content missing" reason (not a test-harness error).
- [Manual]: Confirm the RED failures are content-absence, confirming the tests are correctly wired to the new URLs.

---

### Step 6 — Create & populate the two Guide Pages via MCP (chunked)

> **Prompt**: Implement Step 6 of `_plans/consolidated-guides.md`. With the local site running and MCP connected, use the Umbraco MCP server to create and publish two `guidePage` nodes under `Guides` (`d977a895-b890-4bed-8742-a89a1926f55d`): **Styleguide** (`/guides/styleguide`) and **Component Guide** (`/guides/component-guide`). Populate their `body` Block Grid **section-by-section** (one `guideSection` + its content blocks per MCP call, to stay under the AI large-output ceiling — see `[[project_ai_copilot_large_output_ceiling]]`; verify each publish before the next). Styleguide sections: color swatches (`colorPaletteBlock`), typefaces + type scale + RTE-applicable text styles (`typographyShowcaseBlock`), buttons/tables/forms + background patterns (`generalElementsBlock`) — mirror the content the legacy `/styleguide` showed. Component Guide sections: group the site's editor-available blocks (e.g. Text / Media / Layout / Interactive) with, per block, a live example instance, its variations as multiple instances with different settings, a brief rich-text description, and — when a how-to guide exists — a link to it (manual placement is authoritative; mirror the `/guide` non-overwrite discipline, don't clobber prior sections on re-run). Then update the **Guides** landing page (`guides.cshtml` content) to surface editor-composed pathways to the Styleguide, Component Guide, and How-To Guides using existing site blocks. After each page is published, re-run the Step 5 specs and confirm they go GREEN. If MCP is disconnected, stop and report — this step is gated on a live MCP connection to `:44367`.

**What to build** *(content, not code)*:
- `guidePage` "Styleguide" at `/guides/styleguide`, populated + published.
- `guidePage` "Component Guide" at `/guides/component-guide`, populated + published.
- Guides landing wayfinding blocks (pathways to all three guide types).

**Review carry-over (deferred here from the Step 5 `/code-review`) — screenshot-spec retarget + baseline regen:**
- **Retarget the legacy-URL screenshot/shim specs (was Major, Step 5 review).** ~15 specs under [tests/e2e/blocks/screenshots/](../tests/e2e/blocks/screenshots/) (`*.screenshot.spec.ts` + `_shim-equivalence/*`) and the block→page mapping comment in [tests/e2e/_helpers.ts](../tests/e2e/_helpers.ts) still navigate to the legacy `/styleguide/` and `/styleguide/components/` URLs. Step 4's redirect 301s those away and Step 5 removed the content that kept them alive, so they only find the showcased blocks once **this step** authors them at `/guides/styleguide` + `/guides/component-guide`. As part of Step 6: (a) retarget every hardcoded `/styleguide/` → `/guides/styleguide` and `/styleguide/components/` → `/guides/component-guide` literal in those specs + the `_helpers.ts` mapping; (b) the Linux screenshot baseline regen is **deferred to after Step 7** (the art-direction step changes the guide-page chrome/crops, so baselines generated before it would be immediately stale) and is gated on the canonical content existing on Dev — regenerate via `gh workflow run update-snapshots.yml --ref <branch>` then confirm the bot's baseline commit. These specs run only in Gate 2 (master), so they don't gate the feature branch, but they **will** redden Gate 2 on merge if not retargeted + rebaselined here.

**Validation**:
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/styleguide.spec.ts tests/e2e/styleguide-components.spec.ts tests/e2e/guides.spec.ts` → GREEN.
- [Manual]: Load `/guides/styleguide` and `/guides/component-guide` — both render the left-column TOC (anchors scroll to sections), the Styleguide shows brand fundamentals, the Component Guide shows each block with example/variations/description and how-to links where present. `/guides/` shows the three pathways. `/styleguide` and `/styleguide/components` 301 to the new URLs.

---

### Step 7 — Guide-page art direction & layout

> **Prompt**: Implement Step 7 of `_plans/consolidated-guides.md`. The guide pages render structurally but with **no applied design** — the Block Grid body stretches flush to the viewport, sections aren't visually separated, and the `guideSection` title `<h2>` collides with each block's own heading (two identical sibling h2s). Apply the site's **existing** design-system conventions — the same ones the **Experiments / Innovation Showcase page already uses** (study its layout/grid CSS first; do **not** invent new style or design rules, and add no embellishment). The job of these pages is to cleanly present the styles and components to a visitor. Specifically: (a) **width** — constrain/position the Block Grid body within an appropriate content width instead of full-bleed; today `.styleguide .container{max-width:780px}` only wraps the TOC partial, not the grid body, so reconcile that seam (wrap the grid body, or give the guide layout the Experiments page's container treatment). (b) **section separation** — clean delineation between sections via appropriate spacing (and whatever separation the design system already uses), not full-bleed run-together. (c) **type hierarchy** — resolve the double-heading so each section has one clear heading and any block-internal heading reads as subordinate (decide: section title as the section heading with block headings stepping down to `h3`, **or** the section title as an eyebrow/overline above the block's heading) — no two identical sibling h2s — while keeping the TOC's anchor↔heading contract intact (the `<section id>` and TOC `href` must still agree). Touch `wwwroot/assets/css/styleguide.css` (or a new `guides.css`), `guidePage.cshtml`, and `guideSection.cshtml` as needed; reuse the design system's existing spacing scale / type scale / tokens. Verify by eye against `/guides/styleguide` + `/guides/component-guide`, run the **accessibility-reviewer** on the resulting heading order, and confirm the Step-5 specs stay green.

**What to build**:
- Guide-layout CSS: content width/container for the grid body, section spacing/separation, and type hierarchy — mirroring the Experiments page's applied design, reusing existing tokens (no new rules).
- Markup adjustments in `guidePage.cshtml` / `guideSection.cshtml` if needed for the container + heading hierarchy (preserve the `ViewData["GuideSlugMap"]` → `<section id>` contract and the `_GuideToc` anchors).
- No net-new design language — this is *applying* the system, not extending it.

**Validation**:
- [Manual/eye]: `/guides/styleguide` + `/guides/component-guide` present cleanly — content within an appropriate width, clear section separation, a single clear heading per section (no duplicate-looking h2s), consistent with the Experiments page's applied design.
- [Automated]: Step-5 specs stay GREEN (structure/TOC/selectors unchanged); the accessibility-reviewer confirms a correct, non-skipping heading order.
- [Deferred/CI]: screenshot baselines (guide page templates + the retargeted block specs) are generated on Linux via `update-snapshots.yml` **after this step's design lands** (design changes the crops, so baselines must come after — and are gated on the canonical content existing on Dev; see the Step-6 content-transfer note).

---

### Step 8 — Retire the legacy `styleGuidePage`

> **Prompt**: Implement Step 8 of `_plans/consolidated-guides.md`. Now that `/guides/styleguide` and `/guides/component-guide` are live, green, and redirected-to, retire the legacy surface. (a) Delete (recycle-bin + purge) the legacy content nodes: the old `/styleguide` node and its `/styleguide/components` child. (b) Delete the `styleGuidePage` doc type (`89f68661-6e42-4541-bf8e-029eef0325ab`) and its template `Views/styleGuidePage.cshtml`. (c) Keep `_StyleGuideSectionRows.cshtml` (how-to guides still use it) and keep the three programmatic block element types (reused by the Guide Body). Regenerate ModelsBuilder models and commit the removal of `StyleGuidePage.generated.cs`. Verify `/check-uda` shows no unexpected schema drift, then run the full local gate: `cd src/UmbracoProject && dotnet build -c Release && dotnet test --no-build` and the styleguide specs. Confirm `/styleguide` still 301s (now that the node is gone, the middleware still handles it) and the block render-coverage + block-parity specs stay green (guideSection documented as a grid-only exception).

**What to build**:
- Delete legacy content nodes (MCP) + `styleGuidePage` doc type + `Views/styleGuidePage.cshtml`.
- Regenerate/commit models (removal of `StyleGuidePage.generated.cs`).
- Confirm `BlockRenderCoverageTests.cs` records `guideSection` as a documented grid-only exception (add it if the test enumerates exceptions explicitly).

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build -c Release && dotnet test --no-build` GREEN (incl. `BlockRenderCoverageTests`); styleguide + block-parity specs GREEN.
- [Automated]: `/check-uda` → no unexpected drift; only intentional `styleGuidePage` removal.
- [Manual]: `curl -sI …/styleguide` still 301s; backoffice no longer lists the Style Guide Page doc type.

---

### Step 9 — Record the durable behavior (change-to)

> **Prompt**: Run `/feature update _features/styleguide-and-component-guide.md` to fold this change's evergreen behavior into the existing capability doc. Rewrite the intro/Behaviors to describe the consolidated `guidePage` (one doc type backing Styleguide + Component Guide under `/guides/`, Block Grid body, auto-derived left-column TOC, SEO + Guide Visibility control surface with no section-nav toggle, 301 redirects from legacy `/styleguide` URLs). Add/adjust the Rules + scenarios to match the verified implementation (including the applied art direction from Step 7 — clean section separation + resolved heading hierarchy), add an Increment/revision note dated 2026-07-22 describing the consolidation, and refresh the test-coverage table with the actual spec files + line ranges. Then cross-update `_features/editor-how-to-guides.md` where it asserts `/styleguide`/`/styleguide/components` reachability — revise that scenario to the new URLs + redirect behavior, and note the Guides-parent wayfinding now links to all three guide types while how-to guides stay direct children of `/guides/`. Do NOT create `_features/consolidated-guides.md`. Finally archive `_specs/consolidated-guides.md` → `_specs/shipped/` and `_plans/consolidated-guides.md` → `_plans/shipped/`.

**Validation**:
- [Manual]: Every affected scenario in `_features/styleguide-and-component-guide.md` and the touched scenario in `_features/editor-how-to-guides.md` matches observable behavior; coverage table has no unexpected "Not covered" gaps.
- [Manual]: No `_features/consolidated-guides.md` was created; spec + plan archived under their `shipped/` folders.

---

## File Summary

| Action | File |
|--------|------|
| Create (idempotent; keep) | `scripts/setup-consolidated-guides-schema.mjs` |
| Create | `src/UmbracoProject.Features/Services/Guides/GuideToc.cs` |
| Create | `src/UmbracoProject/Views/guidePage.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/_GuideToc.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/blockgrid/Components/guideSection.cshtml` |
| Create | `src/UmbracoProject.Features/Infrastructure/GuideRedirectMiddleware.cs` |
| Create | `tests/UmbracoProject.Tests/GuideTocTests.cs` |
| Create (optional) | `tests/e2e/guide-redirects.spec.ts` |
| Create/commit | `src/UmbracoProject.Features/Models/Generated/{GuidePage,GuideSection}.generated.cs` |
| Modify | `src/UmbracoProject/Views/content.cshtml` (remove styleguide-tree coupling) |
| Modify | `src/UmbracoProject/Program.cs` (register `UseGuideRedirects()`) |
| Modify | `tests/e2e/styleguide.spec.ts` (retarget + TOC + no-section-nav) |
| Modify | `tests/e2e/styleguide-components.spec.ts` (retarget + description/how-to-link) |
| Modify | `tests/e2e/guides.spec.ts` (allowed-children includes `guidePage`) |
| Modify *(Step 7 — art direction)* | `wwwroot/assets/css/styleguide.css` (or new `guides.css`), `Views/guidePage.cshtml`, `Views/Partials/blockgrid/Components/guideSection.cshtml` |
| Retarget + rebaseline *(Step 6/7 carry-over)* | `tests/e2e/blocks/screenshots/*` + `_helpers.ts` (URL retarget, done); Linux baselines regenerated after Step 7 |
| Delete | `Views/styleGuidePage.cshtml` + `styleGuidePage` doc type + legacy content nodes + `StyleGuidePage.generated.cs` (Step 8) |
| Update *(change-to)* | `_features/styleguide-and-component-guide.md` (fold in evergreen behavior — no new file) |
| Update | `_features/editor-how-to-guides.md` (revise URL/reachability + wayfinding scenarios) |
| Archive | `_specs/consolidated-guides.md` → `_specs/shipped/`; `_plans/consolidated-guides.md` → `_plans/shipped/` |
