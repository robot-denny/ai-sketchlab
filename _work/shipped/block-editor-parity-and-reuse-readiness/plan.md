# Plan: Block-Editor Parity & Reuse-Readiness

**Spec**: `_specs/block-editor-parity-and-reuse-readiness.md`
**Branch**: `claude/feature/block-editor-parity-and-reuse-readiness`
**Work type**: change-to (cross-cutting — folds into `living-style-guide`, `innovation-showcase`, `alert-banner-icons`, `image-carousel-captions-controls`, `section-navigation` + a CLAUDE.md rendering/parity convention; no new feature doc)

## Context

Today ~22 block element types exist but only 4 render in both editors — via per-block **grid→list shim** files that construct `new BlockListItem(...)` and delegate to the blocklist partial. 8 showcase blocks are Block-Grid-only, ~10 are Block-List-only, and availability is decoupled from rendering: the list dispatcher's `Html.PartialAsync` is **unguarded**, so adding a grid-only block to the list palette 500s at render.

This plan makes **every page-body block renderable in both editors from one shared view**, then makes **palette membership pure admin configuration** (parity as the shipped default; deliberate drift allowed). It stays on stock Umbraco conventions — it does **not** build the `TemplateCoordinator`/`ViewModelFactory` framework (deferred). It builds on the existing dispatchers: [blocklist/default.cshtml](src/UmbracoProject/Views/Partials/blocklist/default.cshtml) (has `ella-wrap` AI-persona logic) and [blockgrid/items.cshtml](src/UmbracoProject/Views/Partials/blockgrid/items.cshtml) (guarded, applies grid layout wrappers).

---

## Key Decisions

- **One shared component folder, editor-specific dispatchers.** Move block component partials into a new `Views/Partials/blocks/Components/{alias}.cshtml`. **Keep both dispatchers** (they legitimately differ — list has `ella-wrap` + `.umb-block-list` chrome; grid has `.umb-block-grid__layout-item` wrappers + column/row spans), but point **both** at the shared folder. One view per block; no per-block shims.
- **Shared model = an editor-neutral binding, NOT `BlockListItem`** (honors the spec's "interface-bound, never `BlockListItem`" decision). Preferred: bind shared partials to `@model Umbraco.Cms.Core.Models.Blocks.IBlockReference<IPublishedElement, IPublishedElement>` — both `BlockListItem` and `BlockGridItem` implement it and expose `.Content`/`.Settings`. **Fallback if it doesn't bind cleanly in Razor:** a tiny project record `BlockViewModel(Guid ContentKey, IPublishedElement Content, Guid? SettingsKey, IPublishedElement? Settings)` that both dispatchers construct (the shim already proves both items carry these four values). **Step 1 verifies which via a build spike** and records the choice inline. *(Confirmed 2026-07-16: both `BlockListItem` and `BlockGridItem` are assignable to `IBlockReference<IPublishedElement, IPublishedElement>` — interface binding adopted; the `BlockViewModel` fallback was not needed.)*
- **`.Content`/`.Settings` access is unchanged.** `Model.Content.Value<T>(...)`, `Model.Content as RichTextRow`, and `Model.Settings is ISpacingProperties` all work off the shared model — so migrating a view is mostly a one-line `@inherits`/`@model` change.
- **`pillarSection` stays grid-only** — it uses Block Grid **areas** (`GetBlockGridItemAreasHtmlAsync`/`Model.Areas`), which the shared model can't expose. Its view stays `Views/Partials/blockgrid/Components/pillarSection.cshtml` bound to `BlockGridItem`. Nested sub-lists (`imageCarouselSlide`, `categoryPaletteEntry`, `contentSectionRow`) are parent-scoped children, not page-body blocks — they migrate to the shared folder for rendering but are **not** cross-added to the body palettes.
- **Both dispatchers guarded.** Grid resolves `blocks/Components/{alias}` → falls back to `blockgrid/Components/{alias}` (for `pillarSection`) → friendly message. List resolves `blocks/Components/{alias}` → friendly message (fixes today's unguarded 500). So an admin can never 500 the site by adding a block to a palette.
- **Guardrails, not enforcement.** A **render-coverage** xUnit test (fails the build) asserts every palette-offered block resolves a view in both editors, minus the documented exceptions. A **drift report** (non-failing) lists one-sided palette membership so intentional divergence stays visible. Neither forces the palettes to match.
- **Schema data types** (from `.uda`): `[BlockList] Main Content` = `umb://data-type/…` consumed by `contentControls.contentRows` (8 page types + nested in `contentSectionRow`); `[BlockGrid] Experiments Body` consumed by `experimentsLandingPage.body`. Cross-add is authored via backoffice/Umbraco MCP, then `SourceCodeManual` model regen + `.uda` commit + `/check-uda` (per CLAUDE.md).
- **Node PATH** for Playwright: `/Users/dkardys/.nvm/versions/node/v22.22.2/bin` (per CLAUDE.md).

---

## Steps

Each step is independently completable in a fresh context window.

---

### Step 1 — Establish the shared render mechanism (migrate the 4 dual-editor blocks, rewire + guard both dispatchers)

> **Prompt**: Implement Step 1 of `_plans/block-editor-parity-and-reuse-readiness.md`. First do a build spike: create `Views/Partials/blocks/Components/richTextRow.cshtml` bound to `@model Umbraco.Cms.Core.Models.Blocks.IBlockReference<IPublishedElement, IPublishedElement>` (fall back to a new record `UmbracoProject.Features/Models/BlockViewModel.cs` if the interface won't bind), porting the body of the current `blocklist/Components/richTextRow.cshtml`. Then migrate the other three currently-dual blocks — `alertBanner`, `imageRow`, `iconLinkRow` — into `blocks/Components/` the same way. Rewire `Views/Partials/blocklist/default.cshtml` and `Views/Partials/blockgrid/items.cshtml` to render from `blocks/Components/{alias}` (list keeps its `ella-wrap` logic + gains a try/catch guard mirroring the grid's; grid keeps its layout wrappers and adds a fallback to `blockgrid/Components/{alias}`). Delete the four shim files under `blockgrid/Components/` (`alertBanner`, `iconLinkRow`, `imageRow`, `richTextRow`) and the four now-migrated `blocklist/Components/` originals. Run `cd src/UmbracoProject && dotnet build`. Record the chosen shared-model decision at the top of the plan's Key Decisions if it differed from the preferred option.

**What to build**:
- New folder `src/UmbracoProject/Views/Partials/blocks/Components/` with `richTextRow.cshtml`, `alertBanner.cshtml`, `imageRow.cshtml`, `iconLinkRow.cshtml` (bodies ported verbatim from their `blocklist/Components/` versions; only the `@inherits`/`@model` line changes to the shared model).
- Rewired `blocklist/default.cshtml`: dispatch target `blocklist/Components/…` → `blocks/Components/…`; wrap the `PartialAsync` call in a try/catch(InvalidOperationException) that renders a friendly "could not render" message (mirror grid). Preserve the `ella-wrap` / `articleIsAllAi` logic.
- Rewired `blockgrid/items.cshtml`: dispatch target `blockgrid/Components/…` → try `blocks/Components/…`, on `InvalidOperationException` fall back to `blockgrid/Components/…`, else friendly message. Preserve the layout-item wrappers/spans.
- Delete: `blockgrid/Components/{alertBanner,iconLinkRow,imageRow,richTextRow}.cshtml` (shims) and `blocklist/Components/{alertBanner,iconLinkRow,imageRow,richTextRow}.cshtml` (migrated).
- (Fallback only) `src/UmbracoProject.Features/Models/BlockViewModel.cs`.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build` — succeeds (build-time Razor compile covers the new views).
- [Manual]: `dotnet run`, load an Article page (richText/alert in a Block List body) and `/experiments` (alertBanner/imageRow in the grid) — both render **identically to before**; no "could not render" messages.

---

### Step 2 — Migrate the remaining block views into the shared folder

> **Prompt**: Implement Step 2 of `_plans/block-editor-parity-and-reuse-readiness.md`. Move every remaining block component partial into `Views/Partials/blocks/Components/`, rebinding each to the shared model chosen in Step 1. From `blocklist/Components/`: `videoRow`, `codeSnippetRow`, `imageCarouselRow`, `latestArticlesRow`, `colorPaletteBlock`, `typographyShowcaseBlock`, `generalElementsBlock` (plus any nested-list partials present, e.g. `contentSectionRow`, `categoryPaletteEntry`, `imageCarouselSlide`). From `blockgrid/Components/` (grid-native): `showcaseHero`, `featureCard`, `commandBadge`, `statCallout`, `pullQuoteBlock`, `embeddedSketch`, `timelineRow` — these currently bind `BlockGridItem` and read `Model.Content.Value<T>()`; only the `@inherits`/`@model` line changes. **Leave `blockgrid/Components/pillarSection.cshtml` in place, still bound to `BlockGridItem`** (it uses areas). Delete the now-empty `blocklist/Components/` folder and the migrated grid-native files. **Then remove the transitional fallback to `blocklist/Components/` that Step 1 added to `blocklist/default.cshtml`** (it existed only so unmigrated list blocks kept rendering during Step 1→2) — after this, the list dispatcher resolves `blocks/Components/{alias}` then the friendly-error path. The grid dispatcher keeps its `blockgrid/Components/{alias}` fallback (still serves `pillarSection`). Run `cd src/UmbracoProject && dotnet build`.

**What to build**:
- All remaining unique block partials relocated to `blocks/Components/{alias}.cshtml`, rebound to the shared model.
- `blockgrid/Components/` reduced to just `pillarSection.cshtml`.
- `blocklist/Components/` deleted.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build` — succeeds.
- [Manual]: `dotnet run`; load `/styleguide` (color/typography/generalElements + media blocks), an Article (video/code/carousel/latestArticles), and `/experiments` (all showcase blocks incl. `pillarSection` with its areas) — everything renders identically to before.

---

### Step 3 — Guardrails: render-coverage test (enforced) + palette-drift report (non-failing)

> **Prompt**: Implement Step 3 of `_plans/block-editor-parity-and-reuse-readiness.md`. Add an xUnit test in `tests/UmbracoProject.Tests/` — `BlockRenderCoverageTests.cs` — that reads the two body block data-type `.uda` files (`[BlockList] Main Content`, `[BlockGrid] Experiments Body`) under `src/UmbracoProject/umbraco/Deploy/Revision/`, resolves each `contentElementTypeKey` to its element alias, and asserts a view file exists at `Views/Partials/blocks/Components/{alias}.cshtml` — OR, for grid-palette membership only, `Views/Partials/blockgrid/Components/{alias}.cshtml` — for every offered block, except a `DocumentedExceptions` allowlist (`pillarSection`). Then add a non-failing **drift report**: extend the `/check-uda` skill (`.claude/commands/check-uda.md`) with a "Block palette drift" section, or add `scripts/palette-drift/` that prints blocks present in one body palette but not the other. Run `cd src/UmbracoProject && dotnet test --no-build` after a build.

**Test first**:
- Write `tests/UmbracoProject.Tests/BlockRenderCoverageTests.cs` before confirming; it should be **GREEN** given Steps 1–2 (every offered block has a shared view; `pillarSection` is allow-listed). If it's RED, a view is missing — fix the view, not the test.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build && dotnet test --no-build` — the coverage test passes.
- [Manual]: temporarily rename one shared view → the test goes RED naming the block + editor; restore it.
- [Manual]: run the drift report against the current (pre-Step-4) palettes — it lists the still-diverged blocks.

---

### Step 4 — Schema: cross-add blocks to both body palettes (default parity)

> **Prompt**: Implement Step 4 of `_plans/block-editor-parity-and-reuse-readiness.md`. With the local site running, use the Umbraco MCP (or the backoffice) to edit the two body block data types so both offer every renderable page-body block (default parity). To `[BlockList] Main Content` add: `showcaseHero`, `featureCard`, `commandBadge`, `statCallout`, `pullQuoteBlock`, `embeddedSketch`, `timelineRow`. To `[BlockGrid] Experiments Body` add: `videoRow`, `codeSnippetRow`, `imageCarouselRow`, `latestArticlesRow`, `colorPaletteBlock`, `typographyShowcaseBlock`, `generalElementsBlock`. Do **not** add `pillarSection` to the list, and do **not** cross-add the nested sub-lists. Then: regenerate ModelsBuilder (Settings → ModelsBuilder → Generate, or the Management API), `git diff` the regenerated `*.generated.cs` under `src/UmbracoProject.Features/Models/Generated/`, run `/check-uda`, and commit the regenerated models + updated `data-type__*.uda` together. Re-run the Step 3 render-coverage test.

**What to build**:
- Updated `data-type__*.uda` for the two body palettes (via backoffice/MCP → serialized).
- Regenerated committed models if the schema change touches them.

**Validation**:
- [Automated]: `/check-uda` reports no conflicts at LOW+; `dotnet test --no-build` — render-coverage still green (all cross-added blocks already have shared views).
- [Manual]: in the backoffice, a Content page's Block List body now offers e.g. "Stat Callout"; the Experiments grid offers e.g. "Video Row"; the list does **not** offer "Pillar Section". Place a cross-added block on a scratch page and confirm it renders (no 500, no "could not render").

---

### Step 5 — E2E: admin-availability + render-equivalence

> **Prompt**: Implement Step 5 of `_plans/block-editor-parity-and-reuse-readiness.md`. Add Playwright specs under `tests/e2e/blocks/` following the E2E resilience rules in CLAUDE.md (dynamic ID lookup via Management API, no hardcoded UUIDs, clean stale test data). (a) `blockParity.spec.ts`: assert a representative cross-added block (`statCallout`) is offered in the `[BlockList] Main Content` palette and `videoRow` is offered in `[BlockGrid] Experiments Body`, and that `pillarSection` is **not** offered in the list palette. (b) Render-equivalence: extend the existing shim-equivalence screenshot pairs (`alertBanner`, `iconLinkRow`, `imageRow`, `richTextRow`) rather than duplicating — confirm they still assert list-vs-grid equivalence now that both render from the shared view. Write tests first (expect RED where behavior is new), then confirm GREEN. Run with `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/blocks/blockParity.spec.ts`.

**Test first**:
- Write `tests/e2e/blocks/blockParity.spec.ts` asserting palette availability + the `pillarSection`-not-in-list restriction. Confirm RED before Step 4's schema exists (or GREEN after, if run post-Step-4).

**Validation**:
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/blocks/` — parity + equivalence specs pass.
- [Manual]: none beyond the automated runs.

---

### Step 6 — Reuse-readiness hygiene (CSS functional/skin seam + self-containment)

> **Prompt**: Implement Step 6 of `_plans/block-editor-parity-and-reuse-readiness.md`. Audit each shared block view + its CSS for portability: (1) confirm no block view references a specific page type or sibling block (settings read only via composition interfaces like `ISpacingProperties`); fix any coupling found. (2) Document the functional-CSS vs per-site-skin seam — identify each block's structural CSS (layout/spacing that ships with the block) vs brand/skin values (colors, fonts, tokens that a new site overrides), and record the class/token contract. Decide the seam mechanism (CSS custom properties vs a documented class layer vs `@layer`) and apply it minimally where a block currently hardcodes brand values. Keep changes behavior-preserving (screenshot baselines must not move). Run `cd src/UmbracoProject && dotnet build` and the block screenshot suite.

**What to build**:
- Small refactors to any block view/CSS that couples to page/siblings or hardcodes brand values.
- A short "block CSS seam" note (in the block's `_features` doc and/or `docs/brand.md`) recording the functional-vs-skin contract.

**Validation**:
- [Automated]: `dotnet build` green; block screenshot baselines unchanged (behavior-preserving).
- [Manual]: spot-check one block by overriding a skin token locally → styling changes with no markup edit.

---

### Step 7 — Record the durable behavior (change-to)

> **Prompt (change-to)**: Run `/feature update` for each affected capability doc to fold in this change's evergreen behavior — `_features/living-style-guide.md`, `_features/innovation-showcase.md`, `_features/alert-banner-icons.md`, `_features/image-carousel-captions-controls.md`, and `_features/section-navigation.md` as relevant — adding/adjusting the Rules + scenarios for "block renders in both editors from one shared view" and "palette membership is admin-discretionary (parity default)". Add a **CLAUDE.md** convention section (block/component rendering & parity): one shared view per block under `Views/Partials/blocks/Components/`; both dispatchers guarded; availability is admin config with parity as default; code restricts a block from an editor only when genuinely incompatible (`pillarSection` areas); the render-coverage test is the invariant. Do **not** create `_features/block-editor-parity-and-reuse-readiness.md`. Then archive spec + plan to their `shipped/` folders.

**Validation**:
- [Manual]: each affected `_features/*.md` reflects observable behavior; CLAUDE.md documents the shared-folder + guarded-dispatch + discretion convention; the shipped spec/plan carry the point-in-time ACs.

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/UmbracoProject/Views/Partials/blocks/Components/*.cshtml` (all shared block views) |
| Create (fallback only) | `src/UmbracoProject.Features/Models/BlockViewModel.cs` |
| Modify | `src/UmbracoProject/Views/Partials/blocklist/default.cshtml` (dispatch target + guard, keep `ella-wrap`) |
| Modify | `src/UmbracoProject/Views/Partials/blockgrid/items.cshtml` (dispatch target + grid-only fallback) |
| Delete | `src/UmbracoProject/Views/Partials/blocklist/Components/` (all — migrated) |
| Delete | `src/UmbracoProject/Views/Partials/blockgrid/Components/{alertBanner,iconLinkRow,imageRow,richTextRow}.cshtml` (shims) + migrated grid-native views |
| Keep | `src/UmbracoProject/Views/Partials/blockgrid/Components/pillarSection.cshtml` (grid-only, areas) |
| Create | `tests/UmbracoProject.Tests/BlockRenderCoverageTests.cs` |
| Create/Modify | drift report — `.claude/commands/check-uda.md` section or `scripts/palette-drift/` |
| Modify | `src/UmbracoProject/umbraco/Deploy/Revision/data-type__*.uda` (two body palettes) + regenerated `Models/Generated/*.generated.cs` |
| Create | `tests/e2e/blocks/blockParity.spec.ts` (+ extend shim-equivalence specs) |
| Update *(change-to)* | `_features/living-style-guide.md`, `_features/innovation-showcase.md`, `_features/alert-banner-icons.md`, `_features/image-carousel-captions-controls.md`, `_features/section-navigation.md` (fold in — no new file) |
| Update | CLAUDE.md (block/component rendering & parity convention) |
