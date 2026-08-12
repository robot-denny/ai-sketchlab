# Plan: Block Grid CSS Portability

**Spec**: `_specs/block-grid-css-portability.md`
**Branch**: `claude/feature/block-grid-css-portability` (based on `master`, already pushed)
**Work type**: fix-infra — carried from the spec. No feature doc; durable residue folds into `docs/block-css-seam.md` + the CLAUDE.md *Block / component rendering & parity* section; ACs stay in the shipped spec.

## Context

The Block Grid layout engine and the Experiments-era block CSS are trapped in `wwwroot/assets/css/experiments.css`, which loads on **only** `experimentsLandingPage.cshtml`. So Block Grid lays out correctly only inside `<main class="experiments">`, and `featureCard`/`statCallout`/`pullQuoteBlock`/`commandBadge`/`timelineRow`/`embeddedSketch` render as bare unstyled HTML on any other page (discovered when the consolidated Component Guide placed them — blocking `consolidated-guides` Step 7). This is purely a CSS **load-scope** problem: the base block rules are already un-prefixed and fully tokenized (`docs/block-css-seam.md` audited the *skin* axis as compliant) — they just physically live in a page-only stylesheet. The fix moves the Block Grid engine and the reusable-block base CSS into a **globally-loaded** stylesheet so any page renders them correctly, keeping the Experiments page pixel-identical.

---

## Key Decisions

- **New global `wwwroot/assets/css/blocks.css`, linked in `Views/master.cshtml`.** The site-wide CSS chain is in `master.cshtml` (lines 22–29: `styles.css → typography.css → tokens-extras.css → site-chrome.css → …`); page-specific sheets (`experiments.css`, `styleguide.css`) load per-page via each template's `@section Styles`. `blocks.css` joins the **master.cshtml** chain (add after `site-chrome.css`) so it loads on every page. This is the "functional CSS ships with the block, globally available" the seam doc already claims but didn't physically deliver.
- **De-scope, do NOT rename.** Keep the `exp-*` class names; only drop the `main.experiments` / move the rules. Renaming (`exp-card` → `card`) risks dangling references in page JS (the `embeddedSketch` p5 loader), other pages, and screenshot/shim selectors. A rename is an optional, separately-tracked follow-up. Minimal behavior-preserving change wins here.
- **Split base vs. pillar-tone context.** Move each reusable block's **base** rules (bare `.exp-card`, `.exp-stat`, `.exp-cmd`, `.exp-pullquote`, `.exp-timeline`, `.exp-sketch` + their `__` children) into global `blocks.css`. **Leave the pillar-tone-context rules** (`.exp-pillar--light/--dark/--accent .exp-…`, e.g. experiments.css lines 343, 525–539, 597–605) **in `experiments.css`** — they are Experiments pillar composition; a block off a pillar renders in its default tone (correct). Also **leave the Block Grid engine's page reset** (`main.experiments` / `main.experiments *`, ~lines 17–23) in experiments.css — that's page chrome, not the grid engine.
- **What moves to `blocks.css`:** (a) the Block Grid layout engine — `main.experiments .umb-block-grid`, `__layout-container`, `__layout-item`, `__area-container`, `__area` + their responsive breakpoints + `[data-col-span]` rules (experiments.css ~lines 32–89), **de-scoped** (drop the `main.experiments` prefix); (b) the six reusable blocks' base rules (`.exp-card` ~331, `.exp-cmd` ~434, `.exp-stat` ~481, `.exp-pullquote` ~560s, `.exp-timeline` ~630s, `.exp-sketch` block + their children — re-derive exact ranges, line numbers drift).
- **`showcaseHero` (`.exp-hero` ~95) and `pillarSection` (`.exp-pillar*`) stay in `experiments.css`** — page-composition (full-bleed hero with its own `<h1>`; pillar provides the band + area grid), out of scope for portability per AC5. They keep rendering only on Experiments. **Cross-branch follow-up:** curating the Guide Body palette to drop `showcaseHero` is a `consolidated-guides` concern (that schema lives on that branch), not this one.
- **`.exp-cta` / `main.experiments .richtext` overrides (experiments.css ~812–852) stay** — Experiments-page richtext skin, not a portable block.
- **Verification reality (cross-branch):** on this branch (master base) the **only** Block Grid page is Experiments — there is no non-Experiments Block Grid page to render the moved blocks against. So the automated gate here is **(1)** `dotnet build`/`test` incl. a **C# CSS seam-guard test** (text-asserts the engine + block base rules moved to `blocks.css` and are no longer `main.experiments`-scoped) and **(2)** the Experiments **Linux screenshot baselines unchanged** (Gate 2 / `update-snapshots`). End-to-end "renders styled on a non-Experiments page" is proven after merging into `consolidated-guides` (where guide pages exist) — noted, not skipped.
- **No schema / no IDs** — pure CSS + one `master.cshtml` `<link>` + a C# test + docs. No Management API, no `.uda`.

---

## Steps

Each step is independently completable in a fresh context window.

---

### Step 1 — Extract the Block Grid layout engine into a global `blocks.css`

> **Prompt**: Implement Step 1 of `_plans/block-grid-css-portability.md`. Create `src/UmbracoProject/wwwroot/assets/css/blocks.css` and **move** the Block Grid layout-engine rules out of `src/UmbracoProject/wwwroot/assets/css/experiments.css` into it, **de-scoped** (drop the leading `main.experiments` from each). That's the `.umb-block-grid`, `.umb-block-grid__layout-container`, `.umb-block-grid__layout-item`, `.umb-block-grid__area-container`, `.umb-block-grid__area` rules, their responsive `@media` breakpoints, and the `[data-col-span]` rules (currently ~lines 32–89 — re-derive exact ranges, they drift). **Leave** the `main.experiments` / `main.experiments *` base reset (~17–23) in `experiments.css` (that's page chrome, not the grid engine). Register `blocks.css` in `src/UmbracoProject/Views/master.cshtml` immediately after the `site-chrome.css` `<link>` (line ~25). Write the seam-guard test FIRST (see below). Run `cd src/UmbracoProject && dotnet build`.

**What to build**:
- Create `src/UmbracoProject/wwwroot/assets/css/blocks.css` with the de-scoped `.umb-block-grid*` engine rules.
- Modify `experiments.css` — remove those rules (keep the `main.experiments` base reset + everything else).
- Modify `Views/master.cshtml` — add `<link href="/assets/css/blocks.css" rel="stylesheet" asp-append-version="true" />` after `site-chrome.css`.

**Test first**:
- Add `tests/UmbracoProject.Tests/BlockCssPortabilityTests.cs` (mirror `BlockRenderCoverageTests` — reads CSS files as text via `File.ReadAllText`, no running site). Assert: `blocks.css` contains a global `.umb-block-grid__layout-container` rule with `grid-template-columns`; and `experiments.css` contains **no** `main.experiments .umb-block-grid` selector (engine de-scoped).
- Run: `cd src/UmbracoProject.Features && dotnet build && dotnet test ../../tests/UmbracoProject.Tests --filter BlockCssPortability` — confirm RED before the move, GREEN after.

**Validation**:
- [Automated]: `dotnet build` clean; `BlockCssPortabilityTests` GREEN.
- [Manual]: with the site running, load `/experiments/` — the pillars/cards/stats still lay out in their columns exactly as before (the engine is now global but identical). Confirm no layout shift by eye.
- [Deferred/CI]: Experiments Linux screenshot baselines unchanged (the definitive gate — runs on CI, not macOS).

---

### Step 2 — Move the six reusable blocks' base CSS into `blocks.css`

> **Prompt**: Implement Step 2 of `_plans/block-grid-css-portability.md`. Continue moving CSS from `experiments.css` into the global `blocks.css` created in Step 1: the **base** rules for the six reusable blocks — `.exp-card`, `.exp-cmd`, `.exp-stat`, `.exp-pullquote`, `.exp-timeline`, `.exp-sketch` (and all their `__`-suffixed child rules + block-local `@media`). **Leave in `experiments.css`**: (a) the pillar-tone-context rules that reference these blocks (`.exp-pillar--light/--dark/--accent .exp-…` — e.g. lines ~343, ~525–539, ~597–605); (b) `showcaseHero` (`.exp-hero*`) and `pillarSection` (`.exp-pillar*`) entirely (page-composition, out of scope); (c) the `main.experiments .richtext` / `.exp-cta` overrides. The base rules are already un-prefixed (bare `.exp-card {`), so this is a pure move — no selector rewrite. Extend the Step-1 seam-guard test to cover the six blocks. Run `cd src/UmbracoProject && dotnet build`.

**What to build**:
- Modify `blocks.css` — append the six blocks' base rules.
- Modify `experiments.css` — remove those base rules; keep pillar-tone variants + hero + pillar + richtext overrides.

**Test first**:
- Extend `BlockCssPortabilityTests.cs`: assert `blocks.css` contains base rules for `.exp-card`, `.exp-stat`, `.exp-cmd`, `.exp-pullquote`, `.exp-timeline`, `.exp-sketch`; assert `experiments.css` retains the pillar-tone variants (`.exp-pillar--dark .exp-stat__figure` etc.) AND `.exp-hero` / `.exp-pillar` (page-composition stays). Confirm RED before the move, GREEN after.

**Validation**:
- [Automated]: `dotnet build` clean; `BlockCssPortabilityTests` GREEN.
- [Manual]: load `/experiments/` — feature cards, stat callouts, pull quotes, command badges, timeline, sketches render **exactly** as before (base moved global, tone variants still applied inside pillars). Confirm no visual change by eye.
- [Deferred/CI]: Experiments Linux baselines unchanged.
- [Deferred/cross-branch]: rendered proof that these blocks now style correctly on a **non-Experiments** page happens after merge into `consolidated-guides` (guide pages) — no non-Experiments Block Grid page exists on this branch to test against.

---

### Step 3 — Update the seam doc + CLAUDE.md; classify page-composition blocks

> **Prompt**: Implement Step 3 of `_plans/block-grid-css-portability.md`. Update the documentation so the enforced state is recorded. (a) `docs/block-css-seam.md`: correct the contract — the reusable blocks' functional CSS now **physically** ships in the globally-loaded `blocks.css` (not `experiments.css`); note that the **Block Grid layout engine** is global in `blocks.css` (no longer `main.experiments`-scoped); update the CSS load-chain line to include `blocks.css`; and add a short "page-composition (non-portable)" note classifying `showcaseHero` + `pillarSection` (full-bleed hero / grid-only pillar) as intentionally Experiments-scoped, not portable content specimens. (b) CLAUDE.md *Block / component rendering & parity* section: add a sentence that page-body block functional CSS + the Block Grid engine live in global `blocks.css` (the portability seam), and that `experiments.css` holds only Experiments page chrome + pillar-tone context. (c) Record the cross-branch follow-up: curating the Guide Body palette to drop `showcaseHero` happens when `consolidated-guides` resumes.

**What to build**:
- Modify `docs/block-css-seam.md` (correct "ships with the block" → `blocks.css`; global engine note; page-composition classification; load-chain update).
- Modify `CLAUDE.md` (Block rendering section — one paragraph on the `blocks.css` seam).

**Validation**:
- [Manual]: the seam doc no longer implies the block CSS lives in `experiments.css`; the page-composition classification for `showcaseHero`/`pillarSection` is explicit with rationale; the CLAUDE.md note names `blocks.css` as the global block/engine stylesheet.
- [Automated]: `dotnet build`/`test` still green (docs-only; sanity).

---

### Step 4 — Record durable behavior (fix-infra) & archive

> **Prompt (fix-infra)**: No feature doc. Confirm the shipped spec `_specs/block-grid-css-portability.md` carries the acceptance criteria (it does), and that the durable residue landed in `docs/block-css-seam.md` + the CLAUDE.md block-rendering section (Step 3). Then archive `_specs/block-grid-css-portability.md` → `_specs/shipped/` and `_plans/block-grid-css-portability.md` → `_plans/shipped/`. Leave a note in the `consolidated-guides` resume trail (its plan Step 7 already points here) that this prerequisite has shipped, so Step 7 can resume after this merges to master and `consolidated-guides` rebases.

**Validation**:
- [Manual]: durable residue is in `docs/block-css-seam.md` + CLAUDE.md; **nothing** filed under `_features/`; spec + plan moved to their `shipped/` folders.
- [Manual]: `consolidated-guides` Step 7's BLOCKED note still accurately points at this (now-shipped) prerequisite.

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/UmbracoProject/wwwroot/assets/css/blocks.css` (global: Block Grid engine + 6 reusable blocks' base CSS) |
| Modify | `src/UmbracoProject/wwwroot/assets/css/experiments.css` (remove moved rules; keep page chrome + pillar-tone + hero/pillar + richtext overrides) |
| Modify | `src/UmbracoProject/Views/master.cshtml` (link `blocks.css` after `site-chrome.css`) |
| Create | `tests/UmbracoProject.Tests/BlockCssPortabilityTests.cs` (CSS seam-guard, text-based) |
| Modify *(fix-infra residue)* | `docs/block-css-seam.md`, `CLAUDE.md` (Block rendering section) |
| Archive | `_specs/block-grid-css-portability.md` → `_specs/shipped/`; `_plans/block-grid-css-portability.md` → `_plans/shipped/` |
