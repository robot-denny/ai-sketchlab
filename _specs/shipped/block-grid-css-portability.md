# Spec for block-grid-css-portability

> This spec captures initial requirements and design rationale. For **current system behavior**, see the doc named on the **Work type** line below. This is a `fix-infra` refactor — its durable residue lands in [docs/block-css-seam.md](../docs/block-css-seam.md) and the CLAUDE.md *Block / component rendering & parity* section, not a new `_features/` doc.

branch: claude/feature/block-grid-css-portability
**Work type**: fix-infra — see CLAUDE.md → Workflow layers → "Work types". This decouples existing block/Block-Grid CSS from one page so blocks render portably; it introduces no new user-facing capability (a visitor sees the same blocks — they just now render correctly wherever they're placed). No feature doc; ACs stay in this shipped spec, durable behavior folds into the CSS-seam doc + CLAUDE.md.
figma_component (if used): none

## Summary

The Block Grid layout engine and the "Experiments-era" block CSS are coupled to the Experiments page, so **Block Grid only renders correctly inside `<main class="experiments">`** and a set of blocks render as bare, unstyled, full-width HTML anywhere else. This was discovered on 2026-07-23 when the consolidated Component Guide (a `guidePage`, not the Experiments page) placed those blocks and they collapsed — blocking `consolidated-guides` Step 7 (guide-page art direction).

Two coupling defects, both in [wwwroot/assets/css/experiments.css](../src/UmbracoProject/wwwroot/assets/css/experiments.css) (a stylesheet loaded by **only** `experimentsLandingPage.cshtml`):

1. **The Block Grid layout engine is page-scoped.** Rules like `main.experiments .umb-block-grid__layout-container { grid-template-columns: … }` and `main.experiments .umb-block-grid__layout-item { grid-column: span … }` mean column spans and areas only lay out inside `<main class="experiments">`. Any other page's Block Grid stacks full-width, ignoring the editor's column layout.
2. **The reusable blocks' functional CSS is page-scoped.** `featureCard`, `statCallout`, `pullQuoteBlock`, `commandBadge`, `timelineRow` (and the genuinely-page-level `showcaseHero`, `embeddedSketch`) all emit `exp-*` classes whose styling lives entirely in `experiments.css`, much of it further scoped under `.exp-pillar` (the `pillarSection` wrapper). Placed on any page that doesn't load `experiments.css` and wrap them in a pillar, they render unstyled.

This violates the block-CSS-seam contract ([docs/block-css-seam.md](../docs/block-css-seam.md): *functional CSS ships with the block; brand/skin is a `var(--token)` override*). The newer blocks (`richTextRow`→`.richtext`, `alertBanner`→`.alert`, `imageRow`→`.image`) honor it — their CSS is in global `styles.css`, which is why they render correctly on every page. The `exp-*` set never did.

The fix: **make the Block Grid layout engine global, and decouple each reusable block's functional CSS out of the Experiments page**, so any page (guide pages, future pages, other sites) renders Block Grid content correctly — the portability the "shared editor-agnostic view" architecture already claims. The hard constraint is that the Experiments page must stay **pixel-identical** afterward.

## Functional Requirements

- **Global Block Grid layout engine.** The `.umb-block-grid*` layout rules (grid container, layout item column spans, area container/areas, responsive collapse) must apply on **any** page that renders a Block Grid, not only inside `<main class="experiments">`. Move them out of the `main.experiments` scope into a globally-loaded stylesheet.
- **Self-contained reusable-block CSS.** Each **reusable content block** currently coupled to `experiments.css` — `featureCard`, `statCallout`, `pullQuoteBlock`, `commandBadge`, `timelineRow`, `embeddedSketch` — must have its functional CSS available globally and **not** depend on a `main.experiments` or `.exp-pillar` ancestor to render its own layout/appearance. It must render fully-styled wherever its view resolves.
- **Container-relative, responsive layout.** A decoupled block must lay out correctly within a **narrower container** than the full Experiments band (e.g. a guide page's reading column), reflowing responsively — its layout must be relative to its container, not the Experiments page width.
- **Experiments page unchanged.** After the refactor, the Experiments / Innovation Showcase page renders **pixel-identically** — verified against its existing Linux screenshot baselines. No visual regression.
- **Page-composition blocks classified & documented.** `showcaseHero` (full-bleed hero with its own `<h1>`) and `pillarSection` (grid-only, provides the pillar band + area grid) are **page-composition**, not portable content specimens. Document them as such (mirroring the render-coverage documented-exception pattern) with a written rationale; they are out of scope for the "renders on any page as a content block" requirement.
- **Seam contract enforced & documented.** No reusable block's functional CSS remains scoped to a single page. Update [docs/block-css-seam.md](../docs/block-css-seam.md) (and the CLAUDE.md block-rendering section) to record the enforced state and the global-Block-Grid-engine location, so the next Block Grid page — or a cloned site — inherits correct rendering with no per-page CSS.

## Possible Edge Cases

- **Tone/context variants** — some styling is scoped under `.exp-pillar--dark` / `.exp-pillar--accent` (e.g. `.exp-pillar--accent .exp-stat__figure`). Those are *pillar-context* skins; outside a pillar a block has no tone. Decoupling must keep the pillar tone-styling working **on the Experiments page** while ensuring a block renders sensibly (default tone) **off** a pillar.
- **`exp-` class rename** — renaming classes off the `exp-` prefix is cleaner but risks breaking other references (page JS, the p5 sketch loader for `embeddedSketch`, other pages, `.blockgrid`/screenshot selectors). Any rename must grep-verify no dangling references.
- **Screenshot baselines** — if the Experiments page baselines change at all after the de-scope, the refactor was **not** behavior-preserving and must be corrected (baselines are the regression gate, not something to regenerate away).
- **Block Grid engine already partially global?** — confirm no conflicting global `.umb-block-grid` rules exist elsewhere before moving them (avoid double-definition/specificity fights).
- **A block that genuinely needs area/grid context** — `pillarSection` uses Block Grid *areas*; it stays grid-only. Don't force it portable.
- **Guide-page verification is cross-branch** — the guide pages live on the paused `consolidated-guides` branch, not this branch's base (`master`). On this branch, portability is verified against the Experiments page (no regression) plus a non-Experiments render check; full guide-page verification happens after both branches merge.

## Acceptance Criteria

- **AC1 — Block Grid lays out on any page.** A Block Grid placed on a page **other than** the Experiments page lays out its blocks per the editor's column spans/areas (not a full-width stack). The layout engine is no longer scoped to `main.experiments`.
- **AC2 — Reusable blocks render fully-styled off the Experiments page.** `featureCard`, `statCallout`, `pullQuoteBlock`, `commandBadge`, `timelineRow`, and `embeddedSketch` render with their intended styling (card, stat display, quote framing, badge, timeline, sketch frame) on a non-Experiments page — not bare HTML.
- **AC3 — Responsive within a narrow container.** Those blocks reflow correctly inside a reading-column-width container (narrower than an Experiments band) — e.g. cards stack or shrink rather than overflow.
- **AC4 — Experiments page pixel-identical.** The Experiments page matches its existing Linux screenshot baselines after the refactor (zero visual diff).
- **AC5 — Page-composition blocks documented.** `showcaseHero` and `pillarSection` are recorded as page-composition/grid-only (not portable content specimens) with a written rationale, consistent with the render-coverage exception convention.
- **AC6 — Seam contract enforced & documented.** No reusable block's functional CSS is scoped to a single page; the CSS-seam doc + CLAUDE.md reflect the global Block Grid engine and the enforced seam.

## Scenarios (Draft)

Draft BDD scenarios derived from the acceptance criteria via Example Mapping. Business language; concrete examples. Verified/refined after implementation; durable behavior folds into [docs/block-css-seam.md](../docs/block-css-seam.md) + CLAUDE.md (this is `fix-infra`, no `_features/` doc).

### Rule: A Block Grid lays out correctly on any page, not just Experiments

```scenario
Scenario: Feature cards sit in columns on a non-Experiments page
  Given a page other than the Experiments page has a Block Grid with three Feature Cards each spanning one-third of the grid
  When a visitor loads that page
  Then the three Feature Cards lay out in three columns
  And they do not collapse into a single full-width stack
```

### Rule: Reusable blocks render fully-styled wherever they are placed

```scenario
Scenario: A Stat Callout shows its big-number styling off the Experiments page
  Given a Stat Callout block is placed on a non-Experiments page
  When a visitor loads that page
  Then the stat renders with its display figure, unit, and supporting styling
  And not as bare unstyled text
```

```scenario
Scenario: A Feature Card renders as a card off the Experiments page
  Given a Feature Card block is placed on a non-Experiments page
  When a visitor loads that page
  Then it renders with its card framing, icon, eyebrow, title and body
  And it does not render as an unstyled run of text
```

### Rule: Decoupled blocks are responsive within a narrow container

```scenario
Scenario: Feature cards reflow inside a reading-width column
  Given a page places Feature Cards inside a container narrower than an Experiments band
  When a visitor views that page on a narrow/mobile viewport
  Then the cards reflow (stack or shrink) within the container
  And no card overflows the container edge
```

### Rule: The Experiments page is visually unchanged after the refactor

```scenario
Scenario: The Experiments page matches its baseline
  Given the Block Grid engine and block CSS have been de-scoped from the Experiments page
  When the Experiments page screenshot suite runs on Linux CI
  Then every Experiments page/block baseline matches with zero visual diff
```

### Rule: Page-composition blocks are documented as non-portable

```scenario
Scenario: Showcase Hero and Pillar Section are recorded as page-composition
  Given the Showcase Hero (full-bleed hero) and Pillar Section (grid-only) blocks
  When a developer reads the block-CSS-seam doc / CLAUDE.md
  Then both are documented as page-composition / grid-only, not portable content specimens
  And the rationale explains why (full-bleed hero with its own h1; Pillar Section provides the band + area grid)
```

### Rule: No reusable block's functional CSS remains page-scoped

```scenario
Scenario: A reusable block's functional CSS has no single-page ancestor
  Given the refactor has shipped
  When a developer inspects the functional CSS for featureCard, statCallout, pullQuoteBlock, commandBadge, timelineRow, embeddedSketch
  Then none of it requires a "main.experiments" or ".exp-pillar" ancestor to render the block's own layout/appearance
  And the block-CSS-seam doc records the global Block Grid engine location
```

## Open Questions

- **Rename off `exp-` or just de-scope?** Renaming (`exp-card` → `card`/`c-card`) signals decoupling and removes the misleading Experiments namespace, but risks dangling references (page JS, the `embeddedSketch` p5 loader, other pages, screenshot/shim selectors). Safer minimum: keep the class names, de-scope the *selectors* (drop the `main.experiments`/`.exp-pillar` ancestors) and move the rules to a global stylesheet. Recommend: **de-scope without rename** for this increment; track an optional rename separately. Decide in `/plan`.
- **Where does the global CSS live?** A new global `blocks.css` (loaded site-wide), append to `styles.css`, or per-block files? Follow whatever convention `docs/block-css-seam.md` already prescribes; if none, pick the simplest global load. Decide in `/plan`.
- **Tone variants** (`.exp-pillar--dark/--accent …`) — keep them pillar-scoped (they're legitimately pillar-context skins, and the Experiments page must stay identical), while the block's **base** styling becomes global/default-tone. Confirm this split holds for each affected block (esp. `statCallout`, `timelineRow`).
- **`showcaseHero` / `pillarSection` on the Component Guide** — confirmed out of scope as portable specimens; the `consolidated-guides` Component Guide should drop `showcaseHero` (and not attempt `pillarSection`). This spec documents the classification; the actual Component-Guide content edit happens when `consolidated-guides` Step 7 resumes.
- **How to assert "not page-scoped" durably** — a lightweight guard (grep/lint-style test that no `exp-*` block rule sits under `main.experiments`/`.exp-pillar` except the documented pillar-tone exceptions) vs. relying on a rendered non-Experiments page check. Decide in `/plan`.
- **Global engine double-definition** — verify no other stylesheet already defines `.umb-block-grid*` layout before moving the rules out of `experiments.css`.

## Testing Guidelines

Create/extend tests under `./tests`. Follow the E2E resilience rules in CLAUDE.md. Cover, without going too heavy:

- **Experiments regression gate (highest priority):** the Experiments page + block screenshot baselines pass **unchanged** on Linux CI after the de-scope (AC4). This is the load-bearing safety net — the refactor is only correct if these don't move.
- **Off-Experiments render:** a non-Experiments page renders a decoupled block (e.g. `statCallout`/`featureCard`) with its styling present — assert via rendered markup/computed layout (block gets its card/stat classes *and* the layout applies), not bare text (AC2). If a stable non-Experiments Block Grid page isn't available on this branch, use a minimal fixture page or a targeted DOM/computed-style check.
- **Column layout off Experiments:** a multi-block grid on a non-Experiments page lays out in columns per span (AC1) — assert the grid container/`grid-template-columns` is active outside `main.experiments`.
- **Seam guard (optional but recommended):** a test/lint asserting no reusable-block functional CSS is scoped under `main.experiments`/`.exp-pillar` (excluding the documented pillar-tone exceptions) — turns a future re-coupling red (AC6).
- **No `exp-` reference breakage** (if any rename is done): grep-verify no dangling class references in views/JS/selectors.
- Existing `BlockRenderCoverageTests` + block-parity specs stay green.
