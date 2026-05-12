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

- **site-polish-2026-05** — bag of small fixes: styling, swap subtitle → meta description in article listings, remove "Generic" tab and fold its fields into existing tabs on selected doc types → one batched spec when ready (no feature doc — cosmetic fixes)

## Later

Wishlist. Promote into Next when scope and timing become clearer.

- **hero-block** — new block component. v1: image + text + button. Later: backoffice text positioning, background-video variant, layout configuration choices → `_features/hero-block.md` (no spec yet)

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

---

**How to use this file:** add to Now / Next / Later as items appear in your head. Promote between sections as priorities shift. When an item ships, move it under "Recently shipped" and let the feature doc carry the detail.

**Workflow entry point:** for a single feature, run `/spec <slug>` to converge an idea into a spec. The spec command's "Next:" line walks you through `/plan` → implement → `/feature update` → `/code-review`. See [CLAUDE.md → Workflow layers](CLAUDE.md#workflow-layers) for the full chain.
