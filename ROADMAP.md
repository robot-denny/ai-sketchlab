# Roadmap

The project-level queue. Each entry is a slug, a one-line intent, and a pointer to the feature folder, PRD, or "no spec yet."

Per-feature increments (shipped + planned within a feature) live in the **Increments** section of each `_features/<slug>.md`. This file tracks work *across* features and the things that don't yet belong to a feature.

When a body of work spans three or more features and needs a shared intent doc, write a PRD at `_prds/<slug>.md` and link it from the **Bundles** section below.

---

## Now

In-flight features — actively iterating; each has a non-empty Increments queue in its feature doc.

- **editor-how-to-guides** — iterate on AI-generated guide output and page-type options → [_features/editor-how-to-guides.md](_features/editor-how-to-guides.md)
- **living-style-guide** — stable; ad-hoc additions as new editorial classes are introduced → [_features/living-style-guide.md](_features/living-style-guide.md)
- **ella-block-attribution** — shipped 2026-05-11; watch for refinements as more AI-attributed content lands → [_features/ella-block-attribution.md](_features/ella-block-attribution.md)

## Next

Committed work, no spec yet. Promote into a feature folder when starting.

- **section-nav-hide-toggle** — extracted from the polish bundle. New `hideFromSectionNavigation` boolean alongside the existing `umbracoNaviHide` / `hideFromTopNavigation` / `hideFromXMLSitemap` toggles in the Visibility Controls composition; `sectionNavigation.cshtml` filters by it. Earns a new Increment on `_features/section-navigation.md` → run `/spec section-nav-hide-toggle` from master
- **cleanup-contact-dead-code** — remove the unused `Views/Components/Contact/Default.cshtml` view component. Never invoked (the live form renders via Umbraco Forms' `RenderForm`). Five-minute housekeeping
- **test-infra-centralise-nodetls** — every spec file repeats `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` at module scope; centralise in `playwright.config.ts` and prune duplicates

## Later

Wishlist. Promote into Next when scope and timing become clearer.

- **hero-block** — new block component. v1: image + text + button. Later: backoffice text positioning, background-video variant, layout configuration choices → `_features/hero-block.md` (no spec yet)
- **workflow-bundle-mode** — `/spec` and `/plan` currently hard-code a feature-doc step (draft skeleton in `/spec`, `/feature update` final step in `/plan`). Cleanup bundles don't earn a feature doc, so both required manual deviation on `site-polish-2026-05`. Add a `--bundle` mode (or auto-detection) that suppresses the feature-doc steps. The 2026-05 audit's P1/P2 hygiene cluster (CI + Polly + health + nullable + central packages + ADR move) is the natural second data point — promote this to Next when audit work starts

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
- **site-polish-2026-05** — 2026-05-12 — cleanup bundle (5 items: metaDescription on listings, Generic-tab fix via composition promote, Contact form restyle, Notes block restyle, capabilities doc refresh + CMS push). No feature doc; spec/plan under `_specs/shipped/` and `_plans/shipped/` once archived
- **workflow-implement-step** — 2026-05-19 — `/implement-step _plans/<slug>.md N` dispatches one plan step to a fresh `general-purpose` subagent. Plan format already promises "each step independently completable in a fresh context window" — this command realizes it. Subagent receives the plan's Context + Key Decisions + Step N block only; no auto-commit; no worktree isolation. See [.claude/commands/implement-step.md](.claude/commands/implement-step.md)

---

**How to use this file:** add to Now / Next / Later as items appear in your head. Promote between sections as priorities shift. When an item ships, move it under "Recently shipped" and let the feature doc carry the detail.

**Workflow entry point:** for a single feature, run `/spec <slug>` to converge an idea into a spec. The spec command's "Next:" line walks you through `/plan` → implement → `/feature update` → `/code-review`. See [CLAUDE.md → Workflow layers](CLAUDE.md#workflow-layers) for the full chain.
