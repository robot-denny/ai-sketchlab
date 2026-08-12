# Spec for Block-Editor Parity & Reuse-Readiness

> This spec captures initial requirements and design rationale. For **current system behavior**, see the docs named on the **Work type** line below.

branch: claude/feature/block-editor-parity-and-reuse-readiness
**Work type**: change-to (cross-cutting — no new feature doc; behavior folds into the affected capability docs `living-style-guide`, `innovation-showcase`, `alert-banner-icons`, `image-carousel-captions-controls`, `section-navigation`, and a new **block/component rendering** convention section in CLAUDE.md). See CLAUDE.md → Workflow layers → "Work types".
figma_component (if used): —

## Summary

Make the site's block/component library **editor-agnostic and reuse-ready** — the "cheap" half of the modular-design-system direction and the groundwork that makes this site a viable org starter. Today ~22 block element types exist but only **4** are usable in both editors (via a per-block grid→list rendering shim); **8** are Block-Grid-only (the Experiments showcase blocks) and **~10** are Block-List-only. Worse, availability and rendering are decoupled today: an admin *can* add a grid-only block to the Block List palette in the backoffice, but it then **throws at render** because no `blocklist/Components/{alias}.cshtml` view exists (the dispatcher's `Html.PartialAsync` is unguarded).

This increment establishes a clear division of responsibility:

- **Code guarantees render-in-both.** Every block is *renderable* in both Block List and Block Grid — one view per block, resolved for either editor — so availability becomes a safe, pure configuration decision. (The only code-level exclusions are blocks that genuinely can't work in an editor.)
- **Availability is admin-discretionary.** Both palettes *default* to offering every renderable block (parity as the default state), but a site admin / QA may add or remove blocks per palette at their discretion. Resulting drift between palettes is **acceptable** because it's a deliberate choice — code does not force the palettes to stay identical.

This is deliberately the **stock-conventions** path. It does **not** build the reference's `TemplateCoordinator` / `ViewModelFactory` / `IViewLocationExpander` rendering framework — that stays deferred (ROADMAP `arch-feature-folder-views-tier`) and is only revisited if we graduate to a packaged cross-site component library (`baseline-starter-site` Later item).

**Scope decisions (owner-confirmed 2026-07-16):**
- **Code renders every block in both editors** — one view per block, resolved for either host. Extends beyond today's 4 shared blocks to all page-body blocks.
- **Palette membership is admin configuration; parity is the default, not an enforced rule.** Admins/QA may create deliberate drift (e.g. a block that doesn't display well in one editor). Nothing in code forces identical palettes.
- **Programmatic restriction only for true incompatibility or obvious nonsense** — a block is excluded from an editor *in code* only when it genuinely can't work there (`pillarSection` needs Block Grid areas) or makes no sense (nested sub-lists that are children of a specific parent block). Everything else renders in both and is left to admin discretion.
- **Keep the two existing palettes and cross-add** — no new shared "page body" data type this increment (consolidating on a single editor is deferred to `baseline-starter-site`).
- **Interface-bound views** — bind block partials to the element/composition interface so one view renders under both editors; delete the four grid→list shims.

## Functional Requirements

### Strand 1 — Editor-agnostic views: render-in-both for every block
- **Every page-body block element type resolves a view under both editors** (except the render-incompatible exceptions below), rendering identically whether hosted in a Block List or a Block Grid. This extends past today's 4 shared blocks to the 8 currently grid-only showcase blocks (`showcaseHero`, `featureCard`, `commandBadge`, `statCallout`, `pullQuoteBlock`, `embeddedSketch`, `timelineRow`) and the list-only content blocks.
- The four grid→list shim files under `Views/Partials/blockgrid/Components/` (`alertBanner`, `iconLinkRow`, `imageRow`, `richTextRow`) are **removed**; no `new BlockListItem(...)` re-wrapping remains.
- Views bind to the block's element/composition interface rather than `UmbracoViewPage<BlockListItem>`, carrying no assumption about the host editor. Settings continue to be read via composition interfaces (`ISpacingProperties`, hide/visibility) — editor-agnostically.
- Because every block renders in both editors, **an admin can add any block to either palette and it will render** — eliminating today's missing-view 500. Availability becomes a pure config decision.
- **Render-incompatible exceptions (no cross-editor view provided, excluded from the default off-editor palette):**
  - `pillarSection` — depends on Block Grid *areas* (named header/body/media regions); a Block List cannot author areas, so it stays Block-Grid-only.
  - The nested sub-lists `imageCarouselSlide`, `categoryPaletteEntry`, `contentSectionRow` are children of a specific parent block, **not** page-body blocks, and are out of scope of the cross-editor rendering question entirely.

### Strand 2 — Palette membership: default parity, admin-discretionary
- Both body palettes (`[BlockList] Main Content`, `[BlockGrid] Experiments Body`) **default** to offering every renderable block — cross-add the current list-only blocks into the grid and the current grid-only showcase blocks into the list, so the shipped default state is full parity.
- Palette membership is **admin configuration**, edited in the backoffice (Settings → Data Types) or via the Umbraco MCP. A site admin / QA may add or remove a block from a palette at their discretion; the resulting divergence between palettes is **accepted, not treated as an error**.
- **Accepted blast radius (per-Data-Type, not per-page — explicitly OK'd):** `[BlockList] Main Content` is consumed by `contentControls.contentRows` (8 page types: article, articleList, author, authorList, content, documentation, error, home) plus nested inside `contentSectionRow`; `[BlockGrid] Experiments Body` is consumed only by `experimentsLandingPage.body`. Cross-adding a block to a palette exposes it on every consumer of that palette. This is understood and accepted; finer-grained per-page scoping would require separate data types and is deferred.
- The only restrictions baked into the default config are the render-incompatible / nonsensical set from Strand 1, each with a written rationale.
- Schema work follows the CLAUDE.md ritual: author locally (backoffice / Umbraco MCP), regenerate ModelsBuilder (`SourceCodeManual`), commit the regenerated `*.generated.cs` + updated `.uda`, run `/check-uda`, and re-baseline Playwright screenshots for any intentionally-changed render.

### Strand 3 — Baseline hygiene / reuse-readiness
- Each block's **structural/functional CSS is separable from brand/skin CSS**, with a documented class contract, so a block can be restyled per site without touching markup or CMS wiring.
- Blocks are **self-contained**: no dependency on a specific page type or sibling block; all settings read through composition interfaces.
- The affected `_features/*.md` docs are updated, and CLAUDE.md gains a short **block/component rendering & parity** convention: one view per block renders in both editors; availability is admin-discretionary with parity as the default; code restricts a block from an editor only when it is genuinely incompatible.

### Strand 4 — Guardrails (protect discretion, keep drift visible)
- **Render-coverage guard (enforced, fails the build):** a test asserts that every block element type offered in any block palette resolves to a view under **both** editors, except the documented render-incompatible set (`pillarSection`; nested sub-lists are out of scope). This guarantees an admin can add any block to either palette without hitting the missing-view 500 — it *protects* discretion rather than restricting it. It does **not** assert the two palettes are identical.
- **Palette-drift visibility (non-failing):** a report — folded into `/check-uda` or a small dedicated check — lists blocks present in one palette but not the other, so intentional drift stays visible and reviewable. Drift does **not** fail the build (admin discretion is legitimate).

## Possible Edge Cases
- An admin removes a block from one palette on purpose (it renders poorly there). Expected: allowed; the drift report notes it; no build failure.
- A block that reads settings only one editor supplies (e.g. Block Grid column span) must degrade gracefully when hosted in the other editor.
- A block whose current view reaches into `BlockListItem`/`BlockGridItem`-specific APIs beyond `.Content`/`.Settings` needs those usages replaced before the shim/binding change.
- A new block is added later with a view for only one editor — the render-coverage guard should fail until it renders in both (or is added to the documented-exception allowlist with a reason).
- `pillarSection` (or another areas-dependent block) somehow added to a Block List palette by an admin: because it's on the render-incompatible exception list it has no list view — the guard/report should flag this rather than let a page 500 in production.
- Screenshot baselines: cross-adding a block to a palette shouldn't change any *existing* page's render; only net-new placements move pixels.

## Acceptance Criteria
- **AC1 — Render-in-both:** every page-body block resolves a view under both editors and renders equivalently, except the render-incompatible exceptions.
- **AC2 — Default parity:** both body palettes ship offering every renderable block.
- **AC3 — Admin discretion:** an admin can add or remove any renderable block from either palette in the backoffice with no code change; an added renderable block displays correctly; palette drift is allowed (not an error).
- **AC4 — Documented restrictions:** `pillarSection` stays out of the Block List (needs areas) and the nested sub-lists stay parent-scoped; these are the only code-level restrictions, each with a written rationale.
- **AC5 — Shims removed:** the four grid→list shim files no longer exist; one view per block.
- **AC6 — Guardrails:** an enforced render-coverage test proves AC1 (every palette-offered block renders in both editors, minus documented exceptions); a non-failing drift report keeps intentional palette divergence visible.
- **AC7 — CSS seam:** each block's functional CSS is separable from brand/skin styling (documented class contract); a per-site restyle needs no markup or wiring change.
- **AC8 — Self-contained:** blocks have no page-type or cross-block coupling; settings read via composition interfaces.
- **AC9 — Docs:** affected `_features/` docs + a CLAUDE.md rendering/parity/discretion convention reflect the new behavior and the restriction rationale.
- **AC10 — No regression:** existing pages (article, documentation, styleguide, experiments) render unchanged; screenshot baselines updated only where a change is intentional.
- **AC11 — Clean schema:** `/check-uda` reports no conflicts; regenerated models + `.uda` are committed together.

## Scenarios (Draft)

Draft BDD scenarios derived from the acceptance criteria via Example Mapping. Verified/refined after implementation; durable versions land in the affected `_features/*.md`.

### Rule: Every renderable block displays in both editors (AC1, AC5)

```scenario
Scenario: A showcase block renders when placed in a Block List body
  Given a CMS editor places a Stat Callout in a Content page's Block List body
  When a visitor loads the page
  Then the stat callout renders correctly
  And it renders identically to the same Stat Callout placed in a Block Grid body
```

```scenario
Scenario: The grid no longer needs a shim to render a shared block
  Given an Alert Banner is placed in a Block Grid body
  When the page renders
  Then the alert banner renders from the single shared block view
  And no file exists at Views/Partials/blockgrid/Components/alertBanner.cshtml
```

### Rule: Availability is admin-discretionary; parity is only the default (AC2, AC3)

```scenario
Scenario: Both palettes default to offering every renderable block
  Given the increment has shipped with no admin edits
  When a CMS editor opens the add-block picker in either the Block List or Block Grid body
  Then every renderable block is offered in both
```

```scenario
Scenario: An admin deliberately removes a block from one palette
  Given a site admin judges that Timeline Row does not display well in a single-column Block List
  When the admin removes Timeline Row from the Block List palette in Settings → Data Types
  Then Timeline Row is no longer offered in Block List bodies
  And it remains offered in the Block Grid
  And the change requires no code edit and is not treated as a build error
```

### Rule: Code restricts a block from an editor only when incompatible (AC4)

```scenario
Scenario: Pillar Section is not offered in a Block List
  Given Pillar Section depends on Block Grid areas
  When a CMS editor opens the add-block picker in a Block List body
  Then Pillar Section is not offered
  And the docs record that it is grid-only because it needs areas
```

### Rule: Guardrails protect discretion and surface drift (AC6)

```scenario
Scenario: Render-coverage guard fails a block that can't render in both editors
  Given a new block is added to a palette with a view for only one editor
  When the test suite runs
  Then the render-coverage guard fails
  And the message names the block and the editor whose view is missing
```

```scenario
Scenario: Intentional palette drift is reported but does not fail the build
  Given an admin has removed Timeline Row from the Block List palette
  When the drift check runs
  Then it reports Timeline Row as present in Block Grid but not Block List
  And the build still passes
```

### Rule: Blocks are restyleable and self-contained (AC7, AC8)

```scenario
Scenario: Restyling a block needs no markup change
  Given a block ships structural CSS plus a documented class contract
  When a new site overrides the block's brand/skin styling
  Then the block adopts the new styling with no edit to its .cshtml or CMS wiring
```

```scenario
Scenario: A block renders outside its original page context
  Given a block originally used on only one page type
  When it is placed on a different page type's body
  Then it renders correctly without reference to the original page or a sibling block
```

### Rule: Ships without regression and deploys cleanly (AC10, AC11)

```scenario
Scenario: Existing pages are visually unchanged
  Given the change has been applied
  When the Playwright screenshot suite runs against the existing article, documentation, styleguide, and experiments pages
  Then their baselines match except where a baseline was intentionally regenerated
```

```scenario
Scenario: Schema is conflict-free before push
  Given the new default palette memberships and any regenerated models are staged
  When a developer runs /check-uda
  Then no conflicts are reported at LOW, MEDIUM, HIGH, or CRITICAL severity
```

## Open Questions
- **Editor-agnostic binding mechanism (key design decision for `/plan`).** A single view that reads `.Settings` cannot bind to `BlockListItem` *or* `BlockGridItem` directly. Candidates: (a) a small shared block view-model `{ Content, Settings }` both dispatchers construct and pass to the shared partial; (b) bind `@model` to the content-element interface and resolve settings via a helper/ViewData; (c) have the blockgrid dispatcher render through the same `blocklist/Components/{alias}` partial via a shared model. `/plan` picks one and applies it uniformly.
- **Form of the render-coverage guard.** xUnit reflecting over the `.uda` palette config + probing view resolution, or a Playwright pass that places each block in each editor? The former is faster and CI-cheap; the latter is truer. Decide in plan.
- **Home of the drift report.** Extend `/check-uda`, or a standalone `dotnet test` / script? It must be non-failing (informational).
- Is the per-site skin seam best expressed as CSS custom properties, a documented class layer, or a `@layer` split? (Hygiene mechanism — decide in plan.)
- Which `_features/*.md` is the natural home for the cross-cutting rendering convention vs. what belongs only in CLAUDE.md?

## Testing Guidelines
Add/extend tests under `tests/e2e/` (and a `dotnet test` where a code invariant fits better) without over-testing:
- **Render-coverage guard (the enforced invariant):** assert every block offered in a palette resolves a view under both editors, minus the documented render-incompatible exceptions. Prefer a fast `dotnet test` over the committed `.uda` + view files if feasible; otherwise a targeted Playwright render check.
- **Drift report (non-failing):** verify it lists one-sided blocks and does not fail the build.
- **Editor-agnostic render equivalence:** render one shared block (e.g. `alertBanner`) under both a Block List and a Block Grid host and assert equivalent output (extend the existing shim-equivalence screenshot pairs rather than duplicating them).
- **Admin discretion (schema/backoffice, resilient per the E2E rules — dynamic ID lookup, no hardcoded UUIDs):** a representative cross-added block (e.g. `statCallout`) is offered in the Block List by default; `pillarSection` is not offered in the Block List.
- **No-regression:** rely on the existing block + page screenshot baselines; regenerate only intentionally-changed ones via `update-snapshots.yml` and review the diff.
- **Schema hygiene:** `/check-uda` clean; regenerated models committed.
- Prefer browser/behavior assertions over `.cshtml`/`.uda` file-content assertions, per the E2E resilience rules in CLAUDE.md.

## Post-implementation follow-ups (from `/code-review`, 2026-07-16)

Deferred (pre-existing issues consolidated by the shared-view move, or out of this increment's scope). Fixed in-PR: `singleblock/default.cshtml` dangling fallback (→ `blocks/Components/`), `role="alert"` on both dispatcher fallback messages, stale shim comment in `iconLinkRow.equivalence.spec.ts`. Still open:

- **a11y — `typographyShowcaseBlock`** renders a literal `<h1>`–`<h6>` demo ladder as real headings, polluting the page heading outline. Pre-existing; default parity widened its exposure (now placeable on any content page — an editor may exercise admin discretion to remove it from `[BlockList] Main Content`). → a11y batch.
- **a11y — `iconLinkRow`** icon-only social link relies solely on `title` for its accessible name (no `aria-label`). Pre-existing. → a11y batch.
- **a11y — `codeSnippetRow`** optional title caption not programmatically associated with its `<pre><code>` (`figcaption`/`aria-labelledby`). Pre-existing. → a11y batch.
- **quality — exception-driven dispatch:** both dispatchers catch `InvalidOperationException` to mean "view not found," which also masks a real `InvalidOperationException` thrown *inside* a partial. Pre-existing pattern (extended by the grid's nested fallback; `pillarSection` hits the catch every render). Consider `IRazorViewEngine.FindView(...).Success` instead of exception control-flow. → infra follow-up.
