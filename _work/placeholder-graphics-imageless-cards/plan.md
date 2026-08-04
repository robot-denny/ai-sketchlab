# Plan: Placeholder Graphics for Imageless Article Cards

**Spec**: `_work/placeholder-graphics-imageless-cards/spec.md`
**Branch**: claude/feature/placeholder-graphics-imageless-cards
**Work type**: new-capability

## Context

The shared article card (`Views/Partials/v2/_ArticleCard.cshtml`) renders an `<img>` inside
`.card-thumb` only when the article has a `mainImage`; otherwise the thumb is a bare
`--surface-tertiary` box at `aspect-ratio: 4/3`. This increment fills that no-image case with a
branded, decorative placeholder so imageless cards read as intentional wherever cards appear
(blog landing, author, topic/tag, search, related widgets — all one partial). The unit of work is
the project's standard **template/partial change → the view + its CSS + a screenshot baseline**
(`conventions.md → ## Unit of work`). No schema, model, or backoffice surface is touched.

---

## Key Decisions

- **CSS-only deterministic placeholder, not the image generator.** A pure markup+CSS geometric
  mark costs zero runtime and creates no media records; the flow-field generator is heavier and
  would mint a media node per imageless article — overkill for a fallback. (Resolves the spec's
  open design question.)
- **Per-article variation via a deterministic seed class.** The Razor computes a small stable
  index from the article (e.g. `Math.Abs(article.Key.GetHashCode()) % 4`) and emits
  `card-thumb__placeholder--{0..3}`, so a grid of imageless cards looks varied but renders
  identically every time (screenshot-stable). Resolves the spec's variation-vs-consistency question.
- **Decorative for assistive tech.** The placeholder is `aria-hidden="true"`, has no text/alt, and
  is not focusable — preserving the card's existing one-accessible-link contract (the thumb is
  already decorative today). Verified against the existing `accessibility/cardLinks.spec.ts`
  invariant.
- **Scope: "no image assigned" only.** A runtime broken-image (missing media binary) is out of
  scope for this increment.
- **Enhance the existing element, no layout change.** The placeholder fills the current
  `.card-thumb` (4/3, `--surface-tertiary`); the `<img>` branch is untouched, so image cards are
  provably unchanged.
- **Stack commands (from `stack.md`):** build `cd src/UmbracoProject && dotnet build`; E2E
  `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test <spec>`; dev
  `cd src/UmbracoProject && dotnet run`.
- **Screenshot baselines are Linux-only (from `conventions.md → ## Planning gotchas`).** The
  placeholder changes the article-list appearance, so the baseline is generated via the
  `update-snapshots` GitHub workflow, never captured on macOS.
- **Stack routing (ADR 0003):** consulted the `umbraco-17-planning` pack skill — its schema/MCP
  and backoffice-extension guidance does not apply to a view+CSS change (it self-scopes out for
  "Razor/.NET patterns clearly visible in the codebase"), so **no schema or model step is needed.**
- **Fixture dependency (verify in Step 1):** the E2E must exercise a card whose article has **no**
  `mainImage`. An imageless published article must exist on Dev (where CI runs). Step 1 locates one
  or creates it; if none exists, this is a content-fixture task, not a code task.

---

## Steps

Each step is designed to be completed independently in its own context window.

---

### Step 1 — Behavioral + accessibility E2E test (RED)

> **Prompt**: Implement Step 1 of `_work/placeholder-graphics-imageless-cards/plan.md`. Create
> `tests/e2e/articleCardPlaceholder.spec.ts` following the conventions in
> `tests/e2e/articleCardMetaDescription.spec.ts` and `tests/e2e/accessibility/cardLinks.spec.ts`
> (use the `findNavLinkForTemplate`/`discoverBlockOnPage` helpers in `tests/e2e/_helpers.ts` to
> reach the article-list grid). Assert: (a) a card for an article with **no** featured image
> renders a `.card-thumb__placeholder[aria-hidden="true"]` element and no `<img>` inside
> `.card-thumb`; (b) a card **with** a featured image renders the `<img>` and no placeholder;
> (c) every card still exposes exactly one accessible link. First confirm an imageless published
> article exists on the target environment (query via the Umbraco MCP tools or inspect the running
> site); if none exists, note it and either unpublish an image on a throwaway test article or flag
> the fixture as a prerequisite. Run
> `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/articleCardPlaceholder.spec.ts`
> and confirm it fails RED (the placeholder element does not exist yet).

**What to build**: `tests/e2e/articleCardPlaceholder.spec.ts`; a confirmed imageless-article fixture.

**Test first**:
- Write the spec above; it asserts placeholder-present-when-imageless, image-unchanged-when-present,
  and exactly-one-link-per-card.
- Run the Playwright command and confirm RED before implementing.

**Validation**:
- [Automated]: the `npx playwright test` command above — RED now (placeholder selector not found).
- [Manual]: confirm the chosen imageless article actually renders with an empty thumb today.

---

### Step 2 — Render the decorative placeholder in the card partial (GREEN for DOM/a11y)

> **Prompt**: Implement Step 2 of `_work/placeholder-graphics-imageless-cards/plan.md`. In
> `src/UmbracoProject/Views/Partials/v2/_ArticleCard.cshtml`, extend the `.card-thumb` block so
> that when `img == null` it renders a decorative placeholder instead of an empty thumb:
> `<div class="card-thumb__placeholder card-thumb__placeholder--@seed" aria-hidden="true"></div>`,
> where `@seed` is a deterministic `0..3` computed from the article (e.g.
> `Math.Abs(a.Key.GetHashCode()) % 4`). Leave the existing `img != null` branch and everything else
> untouched. Build with `cd src/UmbracoProject && dotnet build`, then re-run the Step 1 spec and
> confirm the DOM and accessibility assertions pass GREEN (the placeholder-styling screenshot is
> Step 4). Do not add CSS in this step.

**What to build**: edit to `_ArticleCard.cshtml` — the `else`/no-image branch + the seed computation.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build` (Razor compiles at build time) + the Step 1
  spec's DOM/a11y assertions GREEN.
- [Manual]: load `/articles` locally; an imageless card shows the placeholder `<div>`, image cards
  are unchanged.

---

### Step 3 — Style the placeholder to the design system (visual)

> **Prompt**: Implement Step 3 of `_work/placeholder-graphics-imageless-cards/plan.md`. Add
> `.card-thumb__placeholder` styling to `src/UmbracoProject/wwwroot/assets/css/listings.css`
> (next to the existing `.article-grid-card .card-thumb` rules). It must fill the existing 4/3
> thumb, use only design-system tokens per `docs/design-system.md` (warm near-black / stone
> palette, a sparing signal-red accent, **zero border-radius**, angular/constructivist geometry),
> read well on both light and dark card surfaces, and require no JavaScript. Use the four
> `--placeholder--{0..3}` variants for subtle per-article differences. Verify by eye:
> `cd src/UmbracoProject && dotnet run`, view `/articles` at desktop and ~390px mobile — imageless
> cards show on-brand placeholders; image cards are unchanged.

**What to build**: `.card-thumb__placeholder` + four variant rules in `listings.css`.

**Validation**:
- [Manual]: dev server; `/articles` at desktop + mobile — placeholders are on-brand, sharp-cornered,
  varied but not noisy; image cards unaffected.
- [Automated]: none new here (visual regression is Step 4).

---

### Step 4 — Screenshot baseline via CI (Linux-only)

> **Prompt**: Implement Step 4 of `_work/placeholder-graphics-imageless-cards/plan.md`. Add a
> screenshot assertion covering an imageless card — either extend
> `tests/e2e/pages/articleList.screenshot.spec.ts` or add a focused
> `tests/e2e/pages/articleCardPlaceholder.screenshot.spec.ts` following that file's use of
> `prepareForScreenshot`, `screenshotOptions`, and `dynamicRegionMasks`. Do **not** capture the
> baseline on macOS. Generate the Linux baseline via
> `gh workflow run update-snapshots.yml --ref claude/feature/placeholder-graphics-imageless-cards`,
> then review and confirm the bot's committed PNG(s). Note that the existing article-list baseline
> may also shift because the placeholder changes that page — expect and review that diff.

**What to build**: a screenshot spec (new or extended) + the CI-generated Linux baseline PNG(s).

**Validation**:
- [Automated]: the update-snapshots workflow run is green and commits the baseline; the subsequent
  Gate 2 Playwright run passes against it.
- [Manual]: review the committed PNG diff — the placeholder renders as intended, no unintended
  regressions elsewhere.

---

### Step 5 — Record the durable behavior (new-capability)

> **Prompt**: Run `/feature update article-card` to verify the living behavioral doc reflects the
> actual implementation. (Target `article-card` — the area-level capability doc — **not** the
> increment slug; this increment's placeholder behavior is its first documented Rule.) Review each
> scenario against the code and test results, update any that diverged, fill the test coverage
> table with the real `tests/e2e/articleCardPlaceholder.spec.ts` paths and line numbers, mark the
> screenshot row appropriately, and remove the "Draft" banner. Commit the verified doc.
>
> **Validation**: Every scenario in `_features/article-card.md` matches observable behavior; the
> coverage table has no unexpected "Not covered" gaps; the Draft banner is gone.

---

## File Summary

| Action | File |
|--------|------|
| Create | `tests/e2e/articleCardPlaceholder.spec.ts` |
| Create | `tests/e2e/pages/articleCardPlaceholder.screenshot.spec.ts` (or extend `articleList.screenshot.spec.ts`) |
| Create (CI) | Linux screenshot baseline PNG(s) under `tests/e2e/pages/…-snapshots/` |
| Modify | `src/UmbracoProject/Views/Partials/v2/_ArticleCard.cshtml` |
| Modify | `src/UmbracoProject/wwwroot/assets/css/listings.css` |
| _(new-capability)_ Update | `_features/article-card.md` (verify scenarios, fill coverage, drop Draft banner) |
