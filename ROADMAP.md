# Roadmap

The project-level queue. Each entry is a slug, a one-line intent, and a pointer to the feature folder, PRD, or "no spec yet."

Per-feature increments (shipped + planned within a feature) live in the **Increments** section of each `_features/<slug>.md`. This file tracks work *across* features and the things that don't yet belong to a feature.

When a body of work spans three or more features and needs a shared intent doc, write a PRD at `_prds/<slug>.md` and link it from the **Bundles** section below.

---

## Now

In-flight features — actively iterating; each has a non-empty Increments queue in its feature doc.

**Pillar 2 architecture push.** All items below feed a single goal: move Pillar 2 (architectural separation) from 2 → 4 by adopting the feature-folder convention every other agency site already uses. The current Starter-Site-derived layout is the experiment being retired; the destination is decided. Items 1–3 are the safety net that lets the migration in items 5–6 be fearless rather than anxious. See the [2026-05-19 audit](_audits/2026-05-19-umbraco-17-demo-site.md) and the [Kittitas comparison](_audits/2026-05-19-dev-kittitas-county.md) for the rationale.

- **arch-ci-pipeline** — automated `dotnet build` + `dotnet test` + Playwright run that catches regressions before they reach Live. **No PR workflow exists** — local → Cloud Live is the only deploy path — so this is a pre-push / pre-deploy gate, not a pre-merge gate. Likely shape: a GitHub Actions workflow on push to master plus a pre-push git hook locally. Highest-leverage prerequisite for the feature-folder migration. Audit P0.1 → no spec yet
- **arch-screenshot-baselines** — Playwright `toHaveScreenshot()` baselines for every block component (`blocklist/Components/` + `blockgrid/Components/`) and the page templates that compose them. The behavioral lock-down that makes moving ~60 Razor files into `Features/<name>/` safe: any unintended visual regression surfaces as a diff against a committed snapshot. Extends [tests/e2e/blocks/](tests/e2e/blocks/) → no spec yet
- **arch-nullable-warnings-as-errors** — enable `<Nullable>enable</Nullable>` + `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` on both `.csproj` files. Catches a class of refactor regressions at build time. Bounded fix-up at our current ~11 .cs file surface; cheap now, expensive to delay. Audit P1.4 → no spec yet
- **arch-image-generator-extraction** — replace the CLI-shellout pattern in [ImageGeneratorController.cs](src/HelloWorld/ImageGeneratorController.cs) with an `IImageGenerator` interface. Closes the second of two Pillar 2 weaknesses named in the audit (the first — search.cshtml business logic — shipped as `SearchService`). Becomes the second native inhabitant of the new `Features/` convention alongside Search. Audit P1.3 → no spec yet
- **arch-feature-folder-spec** — `_specs/feature-folder-architecture.md`. Defines: directory layout (`src/UmbracoProject/Features/<FeatureName>/`), how block templates relate to features (co-located vs shared `Views/Partials/blocks/<element>/` shim layer), how composers discover registrations across feature folders, what stays at the root. The decision is committed; the spec captures *how* for this codebase. North star the migration plan converges from → run `/spec arch-feature-folders`
- **arch-feature-folder-migration** — the heroic refactor, sliced per-feature: introduce `Features/`, migrate Search → ImageGenerator → Articles → Palettes → cross-cutting infra, then absorb the `blocklist/Components/` + `blockgrid/Components/` split into per-feature template folders. Each slice ships to Live independently. Plan derived from `arch-feature-folder-spec` → no spec yet
- **test-infra-centralise-nodetls** — every spec file repeats `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` at module scope; centralise in `playwright.config.ts` and prune duplicates. Direct prereq for the screenshot-baseline work, which will add many new spec files. Promoted from Next
- **workflow-explore** — `/explore <idea>` divergent pre-spec command, inspired by Pocock's [`/grill-me`](https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md). Holds a Three-Amigos-style conversation, writes notes to `_specs/<slug>-explore.md`, segues into `/spec`. Useful during the `arch-feature-folder-spec` phase; opportunistic between architecture-migration slices. Part of the 2026-05-13 workflow bundle → no spec yet

## Next

Committed work, no spec yet. Promote into a feature folder when starting. Items here are either deprioritised from Now to clear the deck for the Pillar 2 push, or natural between-slices fill-in work.

- **editor-how-to-guides** — iterate on AI-generated guide output and page-type options → [_features/editor-how-to-guides.md](_features/editor-how-to-guides.md). Deprioritised from Now
- **living-style-guide** — stable; ad-hoc additions as new editorial classes are introduced → [_features/living-style-guide.md](_features/living-style-guide.md). Deprioritised from Now
- **section-nav-hide-toggle** — extracted from the polish bundle. New `hideFromSectionNavigation` boolean alongside the existing `umbracoNaviHide` / `hideFromTopNavigation` / `hideFromXMLSitemap` toggles in the Visibility Controls composition; `sectionNavigation.cshtml` filters by it. Earns a new Increment on `_features/section-navigation.md` → run `/spec section-nav-hide-toggle` from master
- **cleanup-contact-dead-code** — remove the unused `Views/Components/Contact/Default.cshtml` view component. Never invoked (the live form renders via Umbraco Forms' `RenderForm`). Five-minute housekeeping; natural between-slices work during the Pillar 2 migration
- **workflow-retire-block-command** — fold [.claude/commands/block.md](.claude/commands/block.md) into a `/plan` template variant so block-shaped TDD stops being a separate command. Reduces command surface and re-uses the spec → plan → implement chain. Part of the 2026-05-13 workflow bundle → no spec yet
- **workflow-roadmap** — `/roadmap` command to manage [ROADMAP.md](ROADMAP.md) (promote/demote items between Now/Next/Later/Recently shipped, append Increments entries to feature docs). Currently a hand-edit chore. Part of the 2026-05-13 workflow bundle alongside [shipped `/implement-step`](.claude/commands/implement-step.md) → no spec yet

## Later

Wishlist. Promote into Next when scope and timing become clearer.

- **hero-block** — new block component. v1: image + text + button. Later: backoffice text positioning, background-video variant, layout configuration choices → `_features/hero-block.md` (no spec yet)
- **workflow-bundle-mode** — `/spec` and `/plan` currently hard-code a feature-doc step (draft skeleton in `/spec`, `/feature update` final step in `/plan`). Cleanup bundles don't earn a feature doc, so both required manual deviation on `site-polish-2026-05`. Add a `--bundle` mode (or auto-detection) that suppresses the feature-doc steps. The 2026-05 audit's P1/P2 hygiene cluster (CI + Polly + health + nullable + central packages + ADR move) is the natural second data point — promote this to Next when audit work starts
- **workflow-prd** — lightweight `/prd` command for authoring multi-feature PRDs in `_prds/`. Currently a free-form markdown convention. Part of the 2026-05-13 workflow bundle; promote to Next when a bundle that needs a PRD (e.g. `algorithmic-art-platform`) reaches active scoping → no spec yet

## Bundles

Multi-feature initiatives. Each gets a PRD when work begins.

- **algorithmic-art-platform** — extend the existing `/algorithmic-art` skill into a first-class capability: backoffice trigger, password-protected user-facing prompt page, gallery URL for saved pieces. Likely 3-4 features under one shared intent → `_prds/algorithmic-art-platform.md` (no PRD yet)

---

## Recently shipped (for orientation)

Each feature below has its full behavioral contract in `_features/<slug>.md` and shipped specs/plans in `_specs/shipped/` and `_plans/shipped/`.

- [alert-banner-icons](_features/alert-banner-icons.md) — 2026-04-09
- [section-navigation](_features/section-navigation.md) — 2026-04-09
- [image-generator](_features/image-generator.md) — 2026-04-09 (3 increments)
- [image-carousel-captions-controls](_features/image-carousel-captions-controls.md) — 2026-04-13
- [site-header](_features/site-header.md) — 2026-04-14
- [umbraco-ai-search](_features/umbraco-ai-search.md) — 2026-04-22
- [ella-block-attribution](_features/ella-block-attribution.md) — 2026-05-11
- **site-polish-2026-05** — 2026-05-12 — cleanup bundle (5 items: metaDescription on listings, Generic-tab fix via composition promote, Contact form restyle, Notes block restyle, capabilities doc refresh + CMS push). No feature doc; spec/plan under `_specs/shipped/` and `_plans/shipped/` once archived
- **workflow-implement-step** — 2026-05-19 — `/implement-step _plans/<slug>.md N` dispatches one plan step to a fresh `general-purpose` subagent. Plan format already promises "each step independently completable in a fresh context window" — this command realizes it. Subagent receives the plan's Context + Key Decisions + Step N block only; no auto-commit; no worktree isolation. See [.claude/commands/implement-step.md](.claude/commands/implement-step.md)
- [extract-search-service](_features/extract-search-service.md) — 2026-05-20 — refactored `search.cshtml` to delegate to a new `SearchService` registered via composer; added xUnit project and tests covering search-mode label routing (Keyword / AI semantic)

---

**How to use this file:** add to Now / Next / Later as items appear in your head. Promote between sections as priorities shift. When an item ships, move it under "Recently shipped" and let the feature doc carry the detail.

**Workflow entry point:** for a single feature, run `/spec <slug>` to converge an idea into a spec. The spec command's "Next:" line walks you through `/plan` → implement → `/feature update` → `/code-review`. See [CLAUDE.md → Workflow layers](CLAUDE.md#workflow-layers) for the full chain.
