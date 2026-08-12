# Plan: Site Polish 2026-05

**Spec**: `_specs/site-polish-2026-05.md`
**Branch**: `claude/feature/site-polish-2026-05`

## Context

A cleanup bundle: five small fixes across views, schema, styles, and docs. Each step is independently completable and the bundle has no companion feature doc (cosmetic + housekeeping work doesn't earn a living BDD spec). The original item 3 ("Hide from Section Navigation" toggle) was feature-shaped and lives in a separate spec to be created via `/spec section-nav-hide-toggle`.

The work builds on the v2 design-system rollout that shipped in 2026-04 (typography.css tokens, `_PageHead.cshtml`, `.art-body` reading column, `.ella` inline-note pattern). Items 4 and 5 will reuse those tokens rather than inventing new ones.

---

## Key Decisions

- **(Item 1) metaDescription source and fallback** — Article's `metaDescription` is provided by the `SEO Controls` composition (alias `sEOControls`, id `9090575e-290c-4585-91a4-b72ec30ff41f`). Already on the SEO tab. When empty, the listing card falls back to `subtitle` (from `Header Controls` composition). Render order: metaDescription > subtitle > nothing. Article-card markup currently only reads `subtitle` in `Views/Partials/v2/_ArticleCard.cshtml:39,78-81`.

- **(Item 1) Listing surface** — `_ArticleCard.cshtml` is the canonical card partial used by Blog landing, Author detail, Topic/Tag, Search results, and related-article widgets. Editing one partial covers every listing surface. No other place renders article-card-shaped content.

- **(Item 2) Generic tab identification — defer to plan step** — MCP inspection of 9 doc types (Article, Content, Documentation, Home, Contact, Author, Site Settings, Search, How-To Guide Page) and 6 compositions (Article/Content/Header/SEO/Visibility/Main Image Controls) found **zero** containers literally named "Generic." The user must point at the screen showing it before consolidation can be designed. Best hypothesis: "Generic" is Umbraco's default group label for properties without an explicit group inside a tab. Treat Step 2 as audit-led: pair with user first, then map fields, then implement.

- **(Item 4) Contact page is composition-driven** — `Views/contact.cshtml` is thin; it uses `master.cshtml`, renders `_PageHead.cshtml`, then `Component.InvokeAsync("RenderForm")` for Umbraco Forms. The form's *internal* HTML (labels, inputs, submit) comes from the `Contact/Default.cshtml` view component and Umbraco Forms' rendering. Styling work targets: (a) the `.wrap-narrow` content shell, (b) the form fields inside `Components/Contact/Default.cshtml`, (c) any Umbraco Forms field overrides in `styles.css`. Audit before edits.

- **(Item 5) Notes block** — Lives at `Views/article.cshtml:50-56` as `<div class="post-notes"><strong>Post Notes:</strong>@Model.PostNotes</div>`. **No `.post-notes` CSS rule exists** in `wwwroot/assets/css/article-page.css` — the block currently renders with browser-default styles. Recommended pattern: mirror the existing `.ella` inline-note treatment (`article-page.css:50-54`) for visual coherence. Keep the "Post Notes:" `<strong>` label semantically meaningful (announces the kind of content) but render it via CSS pseudo-eyebrow if cleaner.

- **(Item 6) Capabilities doc workflow** — `docs/capabilities.md` is repo-side source of truth (last updated 2026-04-28). Features shipped since: editor-how-to-guides (2026-05-04), ella-block-attribution (2026-05-11), living-style-guide block-driven architecture (2026-05-01), TipTap styleMenu manifest (2026-05-11), and today's workflow scaffolding (ROADMAP.md + Increments + segues). After the markdown update, push to the Capabilities document in the CMS via MCP — search by name, read current property value to confirm match against previous markdown version, then `update-document-properties` with the new markdown and `publish-document`.

- **(Plan / convention)** Polish bundle does NOT spawn a `_features/site-polish-2026-05.md`. The final step is `/code-review` + manual sign-off, not `/feature update`. This is the second deviation from the standard /plan flow (after /spec's skipped draft feature doc) and is consistent with `_features/` being reserved for documented user-visible behaviour.

- **(Plan / review gates)** Plan steps marked `(review-gate)` are stop-points for human review before the next step runs. Trivial steps run through; review-gate steps require sign-off. End of plan is implicitly a review gate.

---

## Steps

Each step is designed to be completed independently in its own context window. The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Swap subtitle → metaDescription on the article card (TDD)

> **Prompt**: Implement Step 1 of `_plans/site-polish-2026-05.md`. In `src/UmbracoProject/Views/Partials/v2/_ArticleCard.cshtml`, replace the `subtitle`-only render with a `metaDescription` (preferred) with `subtitle` fallback. The Article doc type already has `metaDescription` via the `SEO Controls` composition. First write or extend a Playwright E2E test that loads the article-listing page, picks one article with `metaDescription` set, asserts the card shows the metaDescription text (not the subtitle text), and a second article with empty metaDescription, asserts fallback to subtitle. Test file: extend `tests/e2e/articleListGridView.spec.ts` (or create `tests/e2e/articleCardMetaDescription.spec.ts` if more isolated). Run `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test [path]` to confirm RED, then implement, then confirm GREEN. Single-article detail pages (`Views/article.cshtml`) must remain unchanged.

**What to build**:
- Modify `src/UmbracoProject/Views/Partials/v2/_ArticleCard.cshtml`:
  - Read `var metaDesc = a.Value<string>("metaDescription");`
  - Compute `var teaser = !string.IsNullOrWhiteSpace(metaDesc) ? metaDesc : sub;`
  - Render `teaser` (not `sub`) inside the `<p class="card-sub">` block
- Add/extend `tests/e2e/articleCardMetaDescription.spec.ts` (or extend `articleListGridView.spec.ts`) with two scenarios:
  - Article with `metaDescription` set → card shows metaDescription
  - Article with empty `metaDescription` → card shows subtitle

**Test first**:
- Write the two scenarios above in the spec file
- The test should assert the card text content against known fixture articles or set up its own via `@umbraco/playwright-testhelpers` Management API setup
- Run: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/articleCardMetaDescription.spec.ts` — confirm RED before implementing

**Validation**:
- [Automated]: tests green after the partial change
- [Manual]: visit `/articles/` (or wherever the listing is rendered) at desktop + mobile, confirm cards show metaDescription text; pick one article without metaDescription set in the backoffice and verify fallback to subtitle

**Review gate**: yes — confirm listing reads correctly in browser before moving on.

---

### Step 2 — Audit the "Generic" tab and consolidate (interactive) — FIX APPLIED

**Outcome (2026-05-12)**: Audit + targeted single-composition fix. The user provided backoffice screenshots showing a "Generic" tab on Content, Author, Contact, Documentation, and other page doc types. The tab consistently held a "Header" group containing the **Page Head Pattern** property.

**Root cause**: The `Page Head Pattern Controls` composition (id `d03e1062-f895-4262-9827-5f35caa93a42`) had its single PropertyGroup declared as a **Group** (`Type: null`) named "Header" with no parent tab. Umbraco's UI cannot render an orphan group inline, so it auto-wraps it under a synthetic "Generic" tab in every doc type that composes this composition.

**Fix**: Promoted the orphan group to a proper **Tab** named "Content" (alias `content`, type=Tab, sortOrder=10) — reusing the existing container UUID so the property reference stays valid. The Page Head Pattern property's sortOrder is 11, slotting it just after `subtitle` (10) in the merged Content tab provided by `Header Controls`.

**Files changed** (just one):
- `src/UmbracoProject/umbraco/Deploy/Revision/document-type__d03e1062f895426298275f35caa93a42.uda` — container Name "Header"→"Content", alias "header"→"content", added `Type: 1` and `SortOrder: 10`; property got `SortOrder: 11`.

Composing doc types' `.uda` files did NOT need updates — they reference the composition by UDI, so the change propagates automatically.

**Backoffice effect** (across every doc type that composes Page Head Pattern Controls — Content, Documentation, Article, Article List, Author, Author List, Contact, Home, Search, Style Guide Page, How-To Guide Page):
- "Generic" tab disappears
- Page Head Pattern field appears under the Content tab, after Subtitle

**Verification**:
- Single-file .uda diff confirmed, no collateral changes
- Dev server still responds 200
- Content values for `pageHeadPattern` are preserved (data is keyed by alias, not container)

**What was inspected**:
- All 16 page doc types (Article, Article List, Author, Author List, Category, Category List, Contact, Content, Documentation, Error, Home, Image Generator Settings, Login, Search, Site Settings, XML Sitemap) — via MCP `get-document-type-by-id`
- All 4 top-level page doc types (Guides, How-To Guide Page, Style Guide Page, plus Guide Visibility Controls)
- All 8 confirmed compositions (Article Controls, Content Controls, SEO Controls, Visibility Controls, Main Image Controls, Header Controls, Home Content Controls indirectly) — via MCP
- All 43 PropertyGroups across all serialized `.uda` files — via grep
- `grep -i "generic"` across the entire `umbraco/Deploy/Revision/` directory — zero hits

**What was found**:
- 35 PropertyGroups are tabs (`Type: 1`)
- 8 PropertyGroups are nested groups within tabs (`Type: null`) — all with explicit names (Content, Palette, Pull Quote, Manifesto, Header)
- Zero properties exist without a container assignment (no orphans that would render as "Generic properties" in Umbraco's UI fallback)
- Zero tabs or groups named "Generic", "General", "Other", or "Default"

**Best hypotheses**:
1. The user is seeing Umbraco's UI auto-label for ungrouped properties — but the audit confirms no such properties exist in this schema.
2. There's local backoffice state that hasn't been serialized to `.uda` yet — but `/check-uda` would have caught any drift.
3. The user is conflating a tab name (e.g. "Content") with "generic" as an adjective — i.e., they want certain tabs renamed or restructured, not removed.

**Resolution**: One composition fix; no schema migration script needed.

---

### Step 2 (original prompt, now resolved)

> **Prompt**: Implement Step 2 of `_plans/site-polish-2026-05.md`. This is an interactive audit + schema change. Begin by asking the user to confirm which doc types have a "Generic" tab — MCP inspection during planning found none literally named that, so the user must either show a screenshot or name the doc types. Once the doc-type list is confirmed, query MCP for each (`mcp__umbraco-mcp__get-document-type-by-id`) to enumerate properties currently on the Generic group. Propose a target tab per field (SEO → SEO tab, content fields → Content tab, etc.) and confirm with user. Then use `mcp__umbraco-mcp__update-document-type` to move each property into its target tab. After updates, run `/check-uda` and inspect git diff in `src/UmbracoProject/umbraco/Deploy/Revision/` for unintended changes. End by opening the affected doc types in the backoffice and confirming the Generic tab is gone and all fields appear under their new tabs.

**What to build**:
- **2a (audit)**: with user, lock the list of affected doc types and the per-field tab assignments. Capture in a table at the top of the step's notes (paste back into this plan as an amendment).
- **2b (implement)**: for each doc type, call `mcp__umbraco-mcp__update-document-type` with revised property `container` assignments to remove the Generic group. Property aliases unchanged; only their containers move.
- **2c (verify)**: run `/check-uda`; inspect `.uda` diffs to confirm only the expected containers changed.

**Test first**:
- (optional) Write a Playwright API-level test in `tests/e2e/genericTabConsolidation.spec.ts` that fetches each affected doc type via the Management API and asserts no container is named "Generic" (or whatever name was confirmed in 2a).
- Run: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/genericTabConsolidation.spec.ts` — confirm RED before implementing.

**Validation**:
- [Automated]: `/check-uda` reports no critical conflicts; the only modified `.uda` files are the doc types touched in 2b
- [Manual]: open each affected doc type in the backoffice and verify (1) the Generic tab is gone, (2) every previously-Generic field appears under its new tab, (3) editing an existing item of that type still shows all the field values

**Review gate**: yes — TWO gates: after 2a (user confirms the doc-type-and-field-mapping table) and after 2c (verify nothing unintended changed in `.uda` diff).

---

### Step 3 — Restyle the Contact page to the design system

> **Prompt**: Implement Step 3 of `_plans/site-polish-2026-05.md`. Audit the Contact page rendering against `/styleguide` and the typography.css design-system tokens. Files to examine: `src/UmbracoProject/Views/contact.cshtml`, `src/UmbracoProject/Views/Components/Contact/Default.cshtml`, any Umbraco Forms field overrides in `src/UmbracoProject/wwwroot/assets/css/styles.css`. The form's internal HTML comes from Umbraco Forms; we style its output, we don't replace it. Identify deltas — colour tokens (e.g. legacy `#aabbcc` literals → `var(--text-primary)`), typography classes, spacing/scale, button styles. Update CSS only (no functional changes). Run the dev server and visually compare /contact at desktop + 390px-mobile against /styleguide for typography + button rendering, against /about (or any contact-less content page) for general spacing rhythm.

**What to build**:
- Read both Contact partials and any related CSS rules (`grep -n "wrap-narrow\|contact" src/UmbracoProject/wwwroot/assets/css/styles.css`)
- Build a delta list: each visual element on the Contact page that diverges from the design system, what it currently uses, what it should use
- Update `src/UmbracoProject/wwwroot/assets/css/styles.css` (or create a dedicated `contact-page.css` if the rule set warrants isolation) to align colours, type, spacing, button styles
- Do NOT change form structure, field aliases, or the form itself — Umbraco Forms manages that

**Test first**: skip TDD for cosmetic restyles. Optionally add a Playwright assertion that the Contact page's submit button has `getComputedStyle().getPropertyValue('--accent-primary')` or whatever token is canonical for action buttons.

**Validation**:
- [Manual] *(primary)*: run `dotnet run`, visit `/contact/` at 1200px and at 390px. Compare typography, colours, spacing, and button against `/styleguide`. The page should feel like a sibling of the rest of the site — no jarring font, colour, or scale shifts. Test empty form, populated form, and error states (submit incomplete to trigger validation).
- [Automated] *(optional)*: a single Playwright assertion that asserts the submit button background-color matches a design-system token

**Review gate**: yes — visual sign-off at desktop + mobile before continuing.

---

### Step 4 — Style the Notes block (`.post-notes`) using design-system tokens

> **Prompt**: Implement Step 4 of `_plans/site-polish-2026-05.md`. The Notes block at `Views/article.cshtml:50-56` renders as `<div class="post-notes"><strong>Post Notes:</strong>@Model.PostNotes</div>` but has no styles in `src/UmbracoProject/wwwroot/assets/css/article-page.css`. Add a `.post-notes` rule set that mirrors the existing `.ella` inline-note pattern (article-page.css:50-54): warm secondary surface, subtle left border, monospace eyebrow for the "Post Notes:" label, body-type prose. Consider replacing the inline `<strong>Post Notes:</strong>` markup with a CSS-rendered eyebrow via `::before content` (matches the `.ella .eye` pattern) — discuss with the visual review. Run the dev server, visit any article with a populated postNotes field, and verify the block reads as a quiet callout consistent with the rest of the reading column.

**What to build**:
- Add a `.post-notes` rule block to `src/UmbracoProject/wwwroot/assets/css/article-page.css` immediately after the `.ella` rules so the visual pattern is locally co-located
- Use the same `--surface-secondary` background, `--text-tertiary` left border, `--font-body` for prose; eyebrow uses `--font-mono` with `letter-spacing`, uppercase, `--text-secondary`
- Decide whether the inline `<strong>Post Notes:</strong>` stays (semantic, screen-reader friendly) or is replaced with a CSS pseudo-eyebrow (cleaner; matches `.ella` pattern). Recommendation: keep the `<strong>` for semantics but hide it visually (`.post-notes strong { display: none; }`) and let CSS render the eyebrow — or rewrite the markup, your call

**Test first**: skip TDD; cosmetic rule additions don't need it. Optionally add a Playwright assertion that the Notes block has a non-default background (`getComputedStyle(...).backgroundColor !== 'rgba(0, 0, 0, 0)'`).

**Validation**:
- [Manual] *(primary)*: find or author an article with `postNotes` set, load it in the browser, visually verify the block reads as a quiet callout. Compare to `.ella` callouts on AI-attributed blocks — same visual family, slightly different eyebrow text.
- [Automated] *(optional)*: Playwright assertion that the block has a non-transparent background

**Review gate**: yes — visual sign-off in a real article before continuing.

---

### Step 5 — Update `docs/capabilities.md` to reflect features shipped after 2026-04-28

> **Prompt**: Implement Step 5 of `_plans/site-polish-2026-05.md`. Update `docs/capabilities.md` (currently `**Last Updated:** 2026-04-28`) with features shipped between 2026-04-28 and today. Add rows to the relevant tables, an entry per item in the Changelog, and bump the Last Updated date. Features to capture: (1) editor-how-to-guides (shipped 2026-05-04 — /guide command, How-To Guide Page doc type, audit mode), (2) ella-block-attribution (shipped 2026-05-11 — AI Persona Properties composition, `.ella-wrap` inline-note treatment), (3) living-style-guide block-driven architecture (shipped 2026-05-01 — colorPaletteBlock, typographyShowcaseBlock, generalElementsBlock), (4) TipTap styleMenu manifest (shipped 2026-05-11 — replaces TinyMCE umb_name annotations), (5) workflow scaffolding (today — ROADMAP.md, per-feature Increments, "Next:" segues, Workflow layers in CLAUDE.md). Cross-reference each entry against the corresponding `_features/<slug>.md` and recent git history to keep wording accurate.

**What to build**:
- Edit `docs/capabilities.md`
- Update `**Last Updated:** 2026-05-12`
- Add rows under "Site Features" or "Claude Code Custom Commands" tables as appropriate for the five features above
- Add five Changelog entries (one per feature) with date, summary, related commits
- Mention the workflow-scaffolding commit (`6925fcb`) in the relevant section

**Test first**: skip TDD; documentation update.

**Validation**:
- [Manual]: read the updated `docs/capabilities.md` end-to-end. Spot-check that each feature row links to or references a real commit / artifact. The Changelog table is chronological — your new entries belong at the bottom.

**Review gate**: no — proceed directly to Step 6 (push to CMS) once the markdown reads cleanly.

---

### Step 6 — Push the updated capabilities markdown to the CMS

> **Prompt**: Implement Step 6 of `_plans/site-polish-2026-05.md`. Push the updated `docs/capabilities.md` content into the Capabilities page in the CMS via MCP. Use `mcp__umbraco-mcp__search-document` to find the Capabilities document by name; use `mcp__umbraco-mcp__get-document-by-id` to read current property values; confirm the markdown property holds the previous version of `docs/capabilities.md` (read-then-write — never blind-write); then `mcp__umbraco-mcp__update-document-properties` to set the markdown property to the new content; then `mcp__umbraco-mcp__publish-document` to publish. Refer to `.claude/commands/umbraco-edit.md` for the OAuth dance if calling REST directly instead of MCP.

**What to build**:
- Locate the Capabilities document ID via search
- Identify which property on it holds the markdown (likely `markdownContent` based on the Documentation doc type pattern, but verify)
- Push the updated content
- Publish

**Test first**: skip TDD; one-shot content update.

**Validation**:
- [Manual]: visit the Capabilities page on the running site (`/capabilities/` locally, or the live URL in `docs/capabilities.md`'s frontmatter link). Confirm the page renders the updated content. Verify the latest Changelog entries appear and the Last Updated date reflects today's value.

**Review gate**: yes — verify the published page rendering matches the source markdown before signing off the bundle.

---

### Step 7 — Close-out: `/code-review` and manual sign-off (replaces `/feature update`)

> **Prompt**: Implement Step 7 of `_plans/site-polish-2026-05.md`. Run `/code-review` over the bundle's diff to catch accessibility / quality / performance regressions. Then walk a manual sign-off matrix: each of items 1, 2, 4, 5, 6 visually verified at desktop (1200px) and mobile (390px). Items 1 and 4 explicitly need both viewports because the article listing and Contact page have responsive layout. Items 2, 5, 6 are viewport-agnostic but still browser-check at desktop. After /code-review's action plan is applied or explicitly skipped, the "Next:" segue points at `/commit-message` and push. Polish bundle has no feature doc to update — skip `/feature update`.

**What to build**:
- Run `/code-review`
- Apply the action plan or explicitly defer items
- Manual matrix:
  - Item 1: listing page at desktop + mobile, metaDescription rendering, subtitle fallback
  - Item 2: backoffice doc types — Generic tab gone, fields under new tabs (manual sample of 2-3 doc types)
  - Item 4: `/contact/` at desktop + mobile, empty + populated + error states
  - Item 5: an article with `postNotes` — block reads as quiet callout
  - Item 6: `/capabilities/` rendering matches source markdown; backoffice "Capabilities" page is published

**Test first**: n/a — all per-item TDD happened in earlier steps.

**Validation**:
- [Automated]: `/code-review` reports green or with only nits that have been triaged
- [Manual]: every item in the matrix above signs off
- [Automated]: all existing E2E tests pass: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test`

**Review gate**: yes — final close-out before commit + push.

---

## File Summary

| Action | File |
|--------|------|
| Modify | `src/UmbracoProject/Views/Partials/v2/_ArticleCard.cshtml` (item 1) |
| Create | `tests/e2e/articleCardMetaDescription.spec.ts` (item 1, optional alternative: extend existing) |
| Modify (via MCP) | Affected document types — list TBD in Step 2a (item 2) |
| Modify | `src/UmbracoProject/umbraco/Deploy/Revision/document-type__*.uda` files for affected types (item 2 — auto-generated by Umbraco after MCP changes) |
| Create *(optional)* | `tests/e2e/genericTabConsolidation.spec.ts` (item 2) |
| Modify | `src/UmbracoProject/wwwroot/assets/css/styles.css` (item 4 — or create `contact-page.css`) |
| Modify *(possible)* | `src/UmbracoProject/Views/Components/Contact/Default.cshtml` (item 4 — only if class hooks need adjustment) |
| Modify | `src/UmbracoProject/wwwroot/assets/css/article-page.css` (item 5 — add `.post-notes` rules) |
| Modify *(possible)* | `src/UmbracoProject/Views/article.cshtml` (item 5 — only if eyebrow markup is restructured) |
| Modify | `docs/capabilities.md` (item 6) |
| Update (via MCP) | Capabilities document's markdown property in CMS (item 6) |

**No `_features/site-polish-2026-05.md`** — polish bundle has no living BDD spec by design.
