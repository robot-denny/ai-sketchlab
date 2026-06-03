# Plan: Accessibility Fixes — Batch 1

**Spec**: `_specs/accessibility-fixes.md`
**Branch**: `claude/feature/accessibility-fixes`

## Context

An automated WCAG 2 audit against Live surfaced 25 failure types across ~300 instances. This plan implements **Batch 1 only** — the high-severity, low-risk, mostly-global-CSS fixes that also cover every area the requester named: link contrast on all backgrounds, visible focus everywhere, footer link target spacing, more-than-colour state signals, card image-link ARIA, and footer landmark/list hygiene. Batches 2–4 are inventoried in the spec and get parked on `ROADMAP.md` (Step 6).

The codebase already carries a partial, a11y-aware link/focus treatment in `typography.css` — but those rules target the **legacy** chrome markup (`#mainNav`, `.site-footer .footer-nav`). The live **v2** chrome (`.site-head .site-nav`, `<footer class="foot">`) is defined in `site-chrome.css` and is the real gap. This plan closes the v2 gaps rather than re-deriving the link system from scratch.

This is the **first semantic/a11y test surface** in the suite — the project's existing E2E coverage is visual-regression + behavioural, with ARIA/contrast explicitly out of scope (see `tests/e2e/_helpers.ts` header). Step 1 introduces axe-core as the primary verification mechanism, which the requester confirmed is acceptable.

---

## Key Decisions

- **Verification is human-led; tooling surfaces, the reviewer validates.** *(Pivot — supersedes the original "axe-core as pass/fail gate" decision after Step 1's findings; see "Verification reality" below.)* axe-core + Playwright are used as **issue-surfacing / diagnostic tools** that show *what* and *where*, not as red/green gates that claim an issue is "resolved." After each fix, the step produces a concrete before/after the reviewer (you) eyeballs in the running app. The axe spec stays in the suite as a regression guard for the families it *can* detect (card `aria-hidden-focus` / `link-name`), but green axe is not treated as proof a contrast/spacing/landmark fix worked.
- **When tooling can't localize an issue, the step PAUSES and asks you for a screenshot.** Several Live-audit findings (contrast especially) don't reproduce as hard axe violations locally — axe returns them as `incomplete`, and some families are already clean in the working tree (see "Verification reality"). For any such issue, the step's prompt explicitly stops and asks you to **paste a screenshot of the current state in the running app** (`https://localhost:44367`), or of the Live audit finding. Claude uses the screenshot to pinpoint the exact element/surface/colour before changing anything — no blind "darken something and hope" edits.
- **Focus-ring style stays as-is.** Requester accepts the current `2px solid` outline + `2px` offset. Work is to *re-assert* it on v2 nav/footer/button elements that strip underlines, and confirm the ring colour contrasts (≥3:1, WCAG 1.4.11) on every surface it can land on. Dark surfaces (`header.masthead`, `.on-dark`) already override the ring to `--text-on-dark`; keep that.
- **Card pattern: single accessible link + full-card overlay** (the [inclusive-components card pattern](https://inclusive-components.design/cards/) the requester linked). The `<h3 class="card-title">` link becomes the *only* `<a>`; it gets a `::after { position:absolute; inset:0 }` overlay so the whole card (including the thumbnail) stays clickable. The thumbnail `<a aria-hidden="true">` is replaced by a plain non-interactive `<div>`/`<figure>` wrapping a decorative `<img alt="">`. Result: exactly one focusable, named link per card; no focusable node inside an `aria-hidden` subtree.
- **Footer underline = persistent.** Requester is fine with default underlines on footer links. This satisfies FR4 (non-colour affordance) most simply and is a deliberate visual change (Step 5 regenerates baselines).
- **Link contrast = darken the global `--site-link-color` token.** *(Decided 2026-06-03 after the reviewer verified findings against the Step 1 report.)* The real, verified failure is the accent link `#8b6b4a` on `--surface-secondary` `#f5f0eb` (≈4.31:1, fails AA) — and it's marginal even on the main surface (≈4.74:1). The reviewer **dismissed** the axe-flagged hero/manifesto/alert-link contrast as false positives (verified passing in-browser). Fix at the root: nudge the global token to `#7E5F3F` (clears AA with margin on primary/secondary/tertiary surfaces) in *both* declarations (`typography.css:109`, `styles.css:69`); the base `a { color: var(--site-link-color) }` cascades it everywhere. Chosen over a scoped per-surface variant because the link is marginal site-wide and `--surface-secondary` backs ~8 components — a scoped fix would be whack-a-mole and leave the main surface marginal. Cost: update the hardcoded `rgb(139,107,74)` assertions in `linkStyles.spec.ts` + regenerate visual baselines (Step 5). **Do NOT darken alert-link or hero text — verified passing.**
- **Footer markup: `<nav>` + `<ul>`.** Wrap each footer link group (`Publication`, `Elsewhere`) in `<nav aria-label="…"><ul><li>` so groups report as navigable lists inside the `contentinfo` landmark. The `<footer class="foot">` is already the sole `contentinfo` (only `v2/_Footer.cshtml` renders, via `master.cshtml`); no second landmark to remove.
- **Footer is `CachedPartialAsync` (60-min).** Template edits to `_Footer.cshtml` won't show until the cache expires — **restart the app** (`dotnet run`) after editing it, before browser/axe checks.
- **CSS edit locations**: link/focus/contrast rules → append to `typography.css` (v2 override layer, loads after `styles.css`); footer-specific rules (`.foot …`) and `.site-head .site-nav` focus → `site-chrome.css` (where the v2 chrome lives); `.alert-link` colour darkening → `typography.css` override block (don't edit the Bootstrap-generated block in `styles.css`). No new CSS file — keeps the documented load order intact.
- **`node` PATH prefix for all Playwright commands**: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH"`.

---

## Verification reality (measured in Step 1)

The Step 1 axe baseline against the **local** instance revealed the audit findings do **not** all reproduce locally — which is *why* the plan pivoted to human-led validation:

| Batch 1 family | Reproduces locally? | How to validate the fix |
|---|---|---|
| `aria_hidden_nontabbable` (card) | ✅ **Hard axe violation** (`aria-hidden-focus` ×1, `link-name` ×3 on home) | axe spec goes green + Tab through a card |
| `text_contrast_sufficient` | ⚠️ axe returns `incomplete` (can't compute effective bg on gradient/overlay surfaces) — **not** a hard violation | **Ask reviewer for a screenshot** of the failing surface; verify the chosen colour with a contrast calculator; reviewer eyeballs before/after |
| `style_focus_visible` | ❌ Already passes locally (v2 chrome shows a ring) | Reviewer Tabs through nav/footer and confirms a visible ring on every element |
| `target_spacing_sufficient` (footer) | ❌ Not in the default axe rule set we ran | Step 4 **prints the measured adjacent-link gap** so the reviewer sees it cross 24px |
| `style_color_misuse` (footer underline) | ❌ Not an axe violation | Reviewer confirms footer links are underlined |
| `aria_contentinfo_misuse` / landmark/list | ❌ Already clean locally per axe | **Ask reviewer for the Live audit detail / screenshot** if the specific misuse isn't visible locally; otherwise treat the `<nav>`/`<ul>` markup as a deliberate semantic improvement |

**Working hypothesis:** the local working tree likely already carries *partial* Batch 1 fixes (the a11y-aware `typography.css` rules) that haven't shipped to Live — so part of this batch is "ensure + deploy + reviewer-validate," not "write net-new code." The one unambiguous net-new fix is the **card pattern** (Step 3). Treat the others as "verify the local state already satisfies the requirement, improve where it doesn't, and let the reviewer confirm against the Live finding."

**Optional escalation:** if you'd rather see the violations exactly as the audit did, the axe spec can be pointed at Live's URL (`URL=https://ai-sketchlab.dev npx playwright test …`) instead of localhost — flagged in Step 1.

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Add axe-core tooling and the a11y scan spec (RED baseline)

**✅ Core spec DONE** — `@axe-core/playwright` added; `tests/e2e/accessibility/axe.spec.ts` created and run. Result: only the card-grid `aria-hidden-focus` + `link-name` reproduce as hard violations locally; contrast comes back `incomplete`; focus/landmark/link-in-text already clean. (`landmark-contentinfo` is not a real axe rule id — mapped to the five real `landmark-*`/`list`/`listitem` rules.) See "Verification reality" above.

**Remaining sub-task — turn the spec into an issue-surfacing report (the "let me see and validate myself" deliverable):**

> **Prompt**: Enhance `tests/e2e/accessibility/axe.spec.ts` (Step 1 of `_plans/accessibility-fixes.md`) from a pass/fail gate into a **diagnostic reporter** the reviewer reads, not just a green check. For each scanned page (home + the dynamically-resolved article URL), write a human-readable artifact under `test-results/a11y/` containing, per finding: the rule id, impact, the WCAG criterion, the **CSS selector + outerHTML snippet** of each offending node (axe gives these as `violation.nodes[].target` / `.html`), and the failure summary. **Include axe `incomplete` results too** (this is where contrast lives) — clearly sectioned as "needs human review" vs "hard violations." Also capture an **annotated screenshot per finding**: scroll the offending node into view, draw a highlight box around its bounding box (e.g. set a temporary `outline`/overlay via `page.evaluate`), and `page.screenshot` it to `test-results/a11y/<page>-<ruleId>-<n>.png`. Keep the existing `violations`-only assertion as the regression guard for the families that DO fire (card), but make the report generation run regardless of pass/fail (in a `test.afterEach` or a dedicated reporter test) so the reviewer always gets the artifact. Re-run and confirm the artifacts land. This is the mechanism the reviewer uses to *see* each issue and decide whether it's real.

**What to build (sub-task)**:
- Extend `axe.spec.ts`: a reporter routine that serializes `results.violations` **and** `results.incomplete` to `test-results/a11y/<page>.md` (or `.json` + a `.md` summary), one entry per node with selector + html + WCAG tag.
- Annotated screenshots per offending node (highlight box + scroll-into-view + `page.screenshot`).
- Keep the card `aria-hidden-focus`/`link-name` violation assertion as the live regression guard.

**Validation**:
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/accessibility/axe.spec.ts` runs; artifacts appear under `test-results/a11y/` (markdown report + per-finding PNGs).
- [Manual — reviewer]: Open `test-results/a11y/home.md` and the PNGs. Confirm you can see exactly which elements axe flagged (card thumbnails) and which it punted on as `incomplete` (contrast). **This artifact is what you'll use to validate each subsequent step's fix.**

---

### Step 2 — Global link contrast, focus visibility, and non-colour signals (CSS)

**Reviewer findings (2026-06-03) — the contrast issue is now pinned, no more guessing:**
- ❌ **DISMISSED — false positives.** The 6 axe `color-contrast` *incomplete* nodes (hero eyebrow/h1/dek + `.manifesto` text) were reviewed in-browser with a contrast tool and **pass** AA. axe only flagged them because it couldn't compute the effective background under the pattern/pseudo-element. **Do not touch these.**
- ✅ **REAL issue (verified by reviewer).** The accent link colour `#8b6b4a` on the `--surface-secondary` (`#f5f0eb`) surface measures **≈4.31:1 — fails** AA for normal text (needs 4.5:1). This recurs because `--surface-secondary` backs ~8 components (`.post-notes`, `.ella` / `.ella-wrap[data-attributed-to]` attribution callouts, `.manifesto`, `.page-head.has-pattern-stochastic`, `.styleguide__nav`, Bootstrap `.bg-light`, table-row hover, experiments). The same link is also marginal on the main surface `#fffcf9` (≈4.74:1 — passes with almost no headroom).
- **Chosen fix (reviewer decision): darken the GLOBAL link token**, not a scoped per-surface variant. Root-cause, future-proof on every light surface.

> **Prompt**: Implement Step 2 of `_plans/accessibility-fixes.md` (FR1/FR2/FR4). **Contrast fix (verified, not speculative):** darken the global `--site-link-color` from `#8B6B4A` to a darker brown that clears AA (≥4.5:1 normal text) with margin on all three light surfaces — `#fffcf9` (primary), `#f5f0eb` (secondary), `#ede8e3` (tertiary). Use **`#7E5F3F`** (measures ≈5.7:1 / 5.2:1 / 4.8:1 respectively) unless you compute a value you prefer with similar margin; also darken `--site-link-hover-color` correspondingly (e.g. `#5F4731`). The token is declared in **TWO** places — `typography.css:109` and `styles.css:69` — update **both** so the value is consistent (the base link rule `a { color: var(--site-link-color) }` at `styles.css:249` then cascades everywhere automatically; no per-component edits needed). **Do NOT touch the hero/manifesto/alert-link colours — the reviewer verified those pass.** Then, separately (FR2 focus): in `site-chrome.css`, add explicit `:focus-visible` rules for the v2 chrome that strips underlines — `.site-head .site-nav a:focus-visible`, `.site-head .site-nav .search-ico:focus-visible`, `.foot .col a:focus-visible` — each `outline: 2px solid currentColor; outline-offset: 2px;` so the ring is guaranteed on every interactive element regardless of underline-stripping (belt-and-braces; axe says focus is already OK locally, but the Live audit flagged 27 focus instances). **Update the now-stale colour assertions**: `tests/e2e/linkStyles.spec.ts` hardcodes `LINK_COLOR = 'rgb(139, 107, 74)'` (#8b6b4a) and asserts it in three tests (content link, article-card title link, login btn-link) — change the constant to the new colour's `rgb()` form so those tests assert the AA-passing value. Build: `cd src/UmbracoProject && dotnet build`. Re-run the Step 1 a11y report and confirm `#7E5F3F`-on-`#f5f0eb` no longer measures sub-4.5:1.

**What to build**:
- `typography.css:109` + `styles.css:69`: `--site-link-color: #7E5F3F;` and `--site-link-hover-color: #5F4731;` (or your computed equivalents). Add a short comment noting the WCAG-AA rationale and the three-surface margins.
- `site-chrome.css`: `:focus-visible` rules for `.site-head .site-nav a`, `.search-ico`, `.foot .col a` (ring re-assertion).
- `tests/e2e/linkStyles.spec.ts`: update `LINK_COLOR` to the new `rgb()` value (3 assertions follow it).
- A short **contrast-ratio confirmation** (printed in your response): new colour vs. each of the three surfaces, showing all clear ≥4.5:1.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build` succeeds. `PATH="…" npx playwright test tests/e2e/linkStyles.spec.ts` passes with the updated colour. Re-running the Step 1 report shows the accent link clears AA on `--surface-secondary`.
- [Manual — reviewer]: `dotnet run`, view the `.post-notes` callout on an article (the original failing example) and a few accent links on the main surface — confirm the slightly-darker brown reads correctly and the shift is imperceptible. Confirm focus rings on nav/footer via Tab. You sign off on the before/after.

**Note for Step 5**: darkening the global link colour shifts every page with a visible accent link → visual baselines will move site-wide; Step 5 regenerates and you review the diff.

---

### Step 3 — Card image-link ARIA: single accessible link + overlay (template + CSS + spec)

> **Prompt**: Implement Step 3 of `_plans/accessibility-fixes.md` (FR5). Rewrite the card link pattern in `src/UmbracoProject/Views/Partials/v2/_ArticleCard.cshtml` to the inclusive-components card pattern: remove the `<a href="@a.Url()" class="card-thumb" aria-hidden="true">` wrapper and replace it with a non-interactive `<div class="card-thumb">` (or `<figure>`) containing the decorative `<img … alt="">`. Keep the single `<a href="@a.Url()">` inside `<h3 class="card-title">` as the *only* link, and make it cover the whole card via a `::after` overlay. Add CSS to `src/UmbracoProject/wwwroot/assets/css/typography.css` (or site-chrome.css): `.article-grid-card { position: relative }` and `.article-grid-card .card-title a::after { content:""; position:absolute; inset:0; }` so the entire card stays clickable. Ensure card text below the title (`.card-sub`, `.card-meta`) remains selectable — give them `position: relative; z-index: 1` if the overlay blocks selection. **Write the card-link semantics spec first**: `tests/e2e/accessibility/cardLinks.spec.ts` asserting each `.article-grid-card` in the latest-articles grid exposes exactly one focusable link with a non-empty accessible name, and no focusable element sits inside an `aria-hidden="true"` subtree. Confirm RED before editing the partial, GREEN after. Run: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/accessibility/cardLinks.spec.ts`.

**What to build**:
- `tests/e2e/accessibility/cardLinks.spec.ts` (TDD — write first):
  - Navigate to a page with the latest-articles grid (home or article-list — look up dynamically).
  - For each `.article-grid-card`: assert `locator('a').count() === 1`; assert that link's accessible name is non-empty (`getByRole('link').textContent`/`aria-label`); assert no `[aria-hidden="true"] a, [aria-hidden="true"] [tabindex]` exists within the card.
- `_ArticleCard.cshtml`: thumbnail `<a aria-hidden>` → `<div class="card-thumb">` (decorative `<img alt="">` retained); title link unchanged.
- CSS: `.article-grid-card{position:relative}`, `.card-title a::after{…inset:0}`, z-index guard on `.card-sub`/`.card-meta` if needed.

**Test first**:
- Write `cardLinks.spec.ts`, run it → **RED** (two links per card today; thumb link is aria-hidden + focusable).
- After the template + CSS edit → **GREEN**.

**Validation**:
- [Automated]: `cardLinks.spec.ts` passes; re-run `axe.spec.ts` — `aria-hidden-focus` and `link-name` families clear.
- [Manual]: `dotnet run`, view the latest-articles grid — clicking anywhere on a card navigates to the article; Tab lands on the card exactly once; the thumbnail image still shows. Verify card subtitle/meta text is still mouse-selectable.

---

### Step 4 — Footer landmark, list semantics, spacing & underline (template + CSS + spec)

> **Prompt**: Implement Step 4 of `_plans/accessibility-fixes.md` (FR3/FR4/FR6). Edit `src/UmbracoProject/Views/Partials/v2/_Footer.cshtml`: wrap each footer link group (`Publication` nav and `Elsewhere` social) in `<nav aria-label="…"><ul>…<li><a>…</a></li>…</ul></nav>`, keeping the existing `.col` wrapper and `<h4>` heading (associate the nav with its heading via `aria-labelledby` pointing at the h4, or use the `<nav aria-label>`). Leave the brand `.fm` link and `.colophon` as-is. The `<footer class="foot">` is already the sole `contentinfo` landmark — do not add roles. In `src/UmbracoProject/wwwroot/assets/css/site-chrome.css`, update the footer link CSS (`.foot .col a` / new `.foot .col li a`): add a persistent `text-decoration: underline` (the requester approved default footer underlines), ensure ≥24px target spacing between adjacent stacked links (e.g. `padding-block` or `margin` so each link's interactive box is ≥24px tall / 24px apart) at both desktop and mobile, and if axe flagged footer-link contrast in Step 2, darken the colour toward `--text-primary`. **Write the footer focus+spacing spec first**: `tests/e2e/accessibility/footerLinks.spec.ts` asserting (a) a footer link shows a visible focus indicator on keyboard focus, and (b) adjacent footer links meet the 24px target-spacing requirement at a desktop (1200px) and a mobile (375px) viewport. Confirm RED, then GREEN. **Also update the two existing specs that now conflict**: in `tests/e2e/linkStyles.spec.ts`, the `Link Styles — Footer` test currently asserts `textDecoration === 'none'` — change it to expect `underline` (footer links are now underlined for FR4); leave the colour assertion as a contrast-safe value or drop the `!== LINK_COLOR` check if the footer colour changed. Verify `tests/e2e/footer/updatedFooter.spec.ts` still passes (the `footer.foot a` count and `.col` structure tests should survive the `<ul>` wrapping — adjust selectors only if they break). **Footer is `CachedPartialAsync` (60-min) — restart `dotnet run` after editing the partial before browser/axe checks.** Run: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/accessibility/footerLinks.spec.ts tests/e2e/linkStyles.spec.ts tests/e2e/footer/updatedFooter.spec.ts`.

**What to build**:
- `tests/e2e/accessibility/footerLinks.spec.ts` (TDD — write first): focus-indicator assertion on a footer link; 24px adjacent-link spacing at 1200px and 375px (use bounding-box gaps or computed interactive-target height; tolerate whitespace per CLAUDE.md rule #5).
- `_Footer.cshtml`: `<nav aria-label>` + `<ul><li>` around the `nav` and `social` link loops.
- `site-chrome.css`: footer link `text-decoration: underline`, ≥24px spacing (mind the `display:block` stacking and the mobile single-column layout at line ~71), optional colour darkening; add `.foot .col ul{list-style:none;margin:0;padding:0}` so the list markup doesn't introduce bullets/indent that shift the layout.
- `linkStyles.spec.ts`: update the footer assertion (`underline`, colour).
- `updatedFooter.spec.ts`: confirm/repair selectors after `<ul>` wrapping.

**Test first** *(spacing is objectively measurable — this is the one Batch-1 family with a clean RED→GREEN signal besides the card)*:
- Write `footerLinks.spec.ts`, run → **RED** (no underline / spacing < 24px today). Have the spec **`console.log` the measured adjacent-link gap** at each viewport so the reviewer can see the number cross 24px, not just a pass/fail.
- After template + CSS edits (and app restart) → **GREEN**.

**Reviewer checkpoint — landmark/contentinfo misuse (provide an example if asked)**:
- `aria_contentinfo_misuse` does **not** reproduce locally (axe reports the footer landmark clean). The `<nav>`/`<ul>` markup is a sound semantic improvement regardless, but if the reviewer wants the *specific* Live misuse addressed, **STOP and ask for a screenshot or the Live audit detail** for that finding — it may point at an element this step doesn't otherwise touch (e.g. a stray landmark elsewhere on the page). Don't invent a fix for a misuse you can't see.

**Validation**:
- [Automated]: `footerLinks.spec.ts` GREEN (spacing + focus); `linkStyles.spec.ts` + `updatedFooter.spec.ts` GREEN; re-run the Step 1 report — card families still clean, no new violations introduced.
- [Manual — reviewer]: `dotnet run` (fresh, to clear the 60-min footer cache), inspect the footer — links underlined, visibly spaced, focus ring on Tab; browser a11y tree (or a screen reader) reports one `contentinfo` with two navigable lists; layout intact at desktop and mobile. You sign off on the rendered result.

---

### Step 5 — Regenerate & review visual-regression baselines (FR7)

> **Prompt**: Implement Step 5 of `_plans/accessibility-fixes.md` (FR7/AC8). The footer underline/spacing and card changes are deliberate visual changes that will shift Linux Playwright baselines. First run the existing visual specs against Dev/Linux to see which baselines moved (do NOT regenerate blindly). Then regenerate the affected baselines via the documented workflow — `gh workflow run update-snapshots.yml --ref claude/feature/accessibility-fixes` (or the GitHub Actions "Run workflow" button), optionally narrowing `testFilter` to the footer/home/article page specs and the article-card block spec. Review the resulting committed PNG diff to confirm every change is an *intended* improvement (footer underlines/spacing, card markup) and not a regression. Per CLAUDE.md: baselines are Linux-only — never regenerate from macOS, and never regenerate as a "quick fix" to silence a failure without reviewing the diff.

**What to build**:
- No source changes. Trigger `update-snapshots.yml`; review the bot's commit diff.

**Validation**:
- [Manual]: The regenerated baseline diff shows only the intended footer/card visual changes. Any unexpected shift is investigated as a possible regression before accepting.
- [Automated]: Visual-regression specs pass on the next CI run (Gate 2 `playwright-against-dev`) with the new baselines.

---

### Step 6 — Roadmap handoff for Batches 2–4 (FR8)

> **Prompt**: Implement Step 6 of `_plans/accessibility-fixes.md` (FR8/AC9). Add three entries to `ROADMAP.md` (under **Next** or **Later** as appropriate — these are committed-but-not-started follow-ups) for the deferred accessibility batches, each pointing back at the inventory in `_specs/accessibility-fixes.md`: **a11y-batch-2-forms-semantics** (Umbraco Forms visible labels `input_label_visible`, `<fieldset>` grouping `input_fields_grouped`, submit-button presence `form_submit_button_exists`, heading semantics `text_block_heading`, single missing link name `a_text_purpose`); **a11y-batch-3-content-landmark-sweep** (`aria_content_in_landmark` ×69, `text_quoted_correctly` ×20, `blockquote_cite_exists` ×3, `element_tabbable_unobscured` ×6); **a11y-batch-4-long-tail** (`text_sensory_misuse`, `style_viewport_resizable`, `img_alt_background`, deprecated attrs, high-contrast mode, `script_onclick_avoid`, complementary label, `figure_label_exists`, `a_target_warning`, `aria_role_redundant`). Note that the existing `cleanup-contact-dead-code` ROADMAP item is related to Batch 2's form work. Keep each entry to the one-line slug + intent + pointer format the file already uses.

**What to build**:
- `ROADMAP.md`: three new entries referencing `_specs/accessibility-fixes.md`.

**Validation**:
- [Manual]: `ROADMAP.md` contains the three batch entries, each with a slug and a pointer back to the spec inventory; format matches surrounding entries.

---

### Step 7 — Verify feature behavioral spec

> **Prompt**: Run `/feature _specs/accessibility-fixes.md` (no `_features/accessibility-fixes.md` exists yet) to generate the living behavioral spec from the verified implementation. Review each draft scenario in the spec against the actual code and test results from Steps 1–5. Update any scenario where the implementation diverged. Fill in the test coverage table with actual test file paths and line numbers (`accessibility/axe.spec.ts`, `accessibility/cardLinks.spec.ts`, `accessibility/footerLinks.spec.ts`, plus the updated `linkStyles.spec.ts`). Remove the "Draft" banner. Commit the verified feature doc.

**Validation**:
- [Manual]: Every scenario in `_features/accessibility-fixes.md` matches observable behavior.
- [Manual]: Test coverage table has no unexpected "Not covered" gaps for AC1–AC9.

---

## File Summary

| Action | File |
|--------|------|
| Modify | `package.json` (add `@axe-core/playwright` devDependency) |
| Create | `tests/e2e/accessibility/axe.spec.ts` |
| Create | `tests/e2e/accessibility/cardLinks.spec.ts` |
| Create | `tests/e2e/accessibility/footerLinks.spec.ts` |
| Modify | `src/UmbracoProject/wwwroot/assets/css/typography.css` (alert-link contrast, card overlay CSS) |
| Modify | `src/UmbracoProject/wwwroot/assets/css/site-chrome.css` (v2 nav/footer focus rings, footer underline/spacing) |
| Modify | `src/UmbracoProject/Views/Partials/v2/_ArticleCard.cshtml` (single accessible link + decorative thumb) |
| Modify | `src/UmbracoProject/Views/Partials/v2/_Footer.cshtml` (`<nav>`/`<ul>` link groups) |
| Modify | `tests/e2e/linkStyles.spec.ts` (footer underline expectation) |
| Verify/Modify | `tests/e2e/footer/updatedFooter.spec.ts` (selector survival after `<ul>` wrapping) |
| Regenerate | Linux visual baselines under `tests/e2e/pages/*-snapshots/` + article-card block snapshots (via `update-snapshots.yml`) |
| Modify | `ROADMAP.md` (Batches 2–4 entries) |
| Create | `_features/accessibility-fixes.md` (via `/feature`) |
