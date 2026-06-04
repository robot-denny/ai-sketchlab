# Plan: Experiments Landing Page (innovation-showcase)

**Spec**: `_specs/innovation-showcase.md`
**Feature doc**: `_features/innovation-showcase.md`
**Branch**: `claude/feature/innovation-showcase`

## Context

A new landing page at `/experiments` (main-nav label: **Experiments**) that doubles as (a) a "show and share" prop for tomorrow's Umbraco developer meet-up and (b) the project's first production use of **Block Grid** layout. The page tells a seven-pillar story of the capabilities this site has unlocked (workflow, slash commands, in-CMS AI, human+AI co-writing, AI-driven CMS operations, metadata-driven image generation, algorithmic art), demonstrating areas, multi-column rows, and nested grids that other Block-List-only pages can learn from.

What already exists that this builds on:

- Block Grid layout-rendering scaffolding already lives at [src/UmbracoProject/Views/Partials/blockgrid/](src/UmbracoProject/Views/Partials/blockgrid/) (`default`, `items`, `area`, `areas`). No `Components/` subfolder yet — this plan creates the first set.
- The v2 design-system tokens, surfaces, type scale, and chrome are already shipped (see `tokens-extras.css`, `site-chrome.css`, `typography.css`, `_specs/design-system.md`).
- Existing element types `richTextRow`, `imageRow`, `iconLinkRow`, `alertBanner` are reusable inside pillar areas via thin Block Grid wrappers that delegate to the existing Block List partials.
- Compositions `Visibility Controls`, `Page Head Pattern Controls`, `SEO Controls`, `Section Navigation Controls` are all available and used by existing landing pages.
- The Home doc type is the parent under which this new page will sit.
- Top nav (`Views/Partials/v2/_SiteHead.cshtml`) reads from Home's children and filters by `umbracoNaviHide` — the new page will appear automatically once published.

---

## Key Decisions

- **Pillar areas: 3, not 2** — The `pillarSection` block exposes `header`, `body`, and `media` areas as specified. The element type itself also carries `eyebrow`, `headline`, `lede`, `pillarNumber`, `tone`, and `anchorId` fields so the structural header is always present; the `header` area is for optional supplementary content (a `commandBadge` row, an `alertBanner`, etc.) above the body.
- **Pillar number is editor-managed, not auto-computed** — Editors who reorder pillars must renumber. Confirmed in the spec's edge cases (renumbering is acceptable friction; auto-computing would conflict with editorial intent for split numbering like "5a / 5b" in future).
- **No new "header content" element type** — The header area accepts `richTextRow`, `commandBadge`, `alertBanner`. We reuse rather than introduce a one-off "pillarHeader" type.
- **Algorithmic art sketch lives on disk under `wwwroot/experiments/sketches/`** — Same-origin, no iframe sandboxing needed. The `embeddedSketch` block stores a relative URL (e.g. `/experiments/sketches/v1.html`) plus a poster image media reference.
- **Reused Block List components get thin wrappers in `blockgrid/Components/`** — `richTextRow`, `imageRow`, `iconLinkRow`, `alertBanner` each get a one-line wrapper partial under `Views/Partials/blockgrid/Components/` that delegates to the existing `blocklist/Components/{alias}.cshtml` partial. Cleaner separation than refactoring the existing Block List partials to accept either model.
- **Content seed via Node script, not MCP from chat** — Authoring a 30+ block page is tedious in MCP; a deterministic Node script (`scripts/seed-experiments-page.mjs`) that builds the full Block Grid layout JSON and PUTs the page is faster to iterate on and re-run. Idempotent (delete + recreate if the page exists).
- **Section nav suppressed on this template** — The Razor template does not render the section-nav sidebar even though the composition is attached. This is a landing page using the full viewport width for design.
- **Ella portrait reuses the existing media item** — Found on Ella's Author page. The content seed script references its media UUID; no new asset is uploaded.
- **TDD-first per step where testable behavior is introduced** — Each step that adds visible behavior includes its E2E spec written before (or alongside) the implementation, run RED before implementing.

### Schema reference (looked up via MCP during planning)

These IDs are stable; reuse rather than create duplicates.

**Data types to reuse:**

| Name | ID | Editor UI |
|---|---|---|
| Textstring | `0cc0eba1-9960-42c9-bf9b-60e150b429ae` | `Umb.PropertyEditorUi.TextBox` |
| Textarea | `c6bac0dd-4ab9-45b1-8e30-e4b619ee5da3` | `Umb.PropertyEditorUi.TextArea` |
| Richtext editor | `ca90c950-0aff-4e72-b976-a30b1ac57dad` | `Umb.PropertyEditorUi.Tiptap` |
| Image Media Picker (single) | `ad9f0cf2-bda2-45d5-9ea1-a63cfc873fd3` | `Umb.PropertyEditorUi.MediaPicker` |
| Multi URL Picker | `b4e3535a-1753-47e2-8568-602cf8cfee6f` | `Umb.PropertyEditorUi.MultiUrlPicker` |
| Date Picker | `5046194e-4237-453c-a547-15db3a07c4e1` | `Umb.PropertyEditorUi.DatePicker` |
| Numeric | `2e6d3631-066e-44b8-aec4-96f09099b2b5` | `Umb.PropertyEditorUi.Integer` |
| True/false | `92897bc6-a5f3-4ffe-ae27-f2e7e33dda49` | `Umb.PropertyEditorUi.Toggle` |

**Element types to reuse inside pillar areas:**

| Name | ID |
|---|---|
| Rich Text Row | `dd183f78-7d69-4eda-9b4c-a25970583a28` |
| Image Row | `e0df4794-063a-4450-8f4f-c615a5d902e2` |
| Icon Link Row | `17db13ba-bbd9-4a44-b28f-986301156754` |
| Alert Banner | `17c66d28-107b-4934-bc01-3b5777d42c8a` |

**Compositions to attach to the new doc type:**

| Name | ID |
|---|---|
| Visibility Controls | `7cebdc47-a965-49ec-ab42-bc887d6b1119` |
| Page Head Pattern Controls | `d03e1062-f895-4262-9827-5f35caa93a42` |
| SEO Controls | `9090575e-290c-4585-91a4-b72ec30ff41f` |
| Section Navigation Controls | `ef741d00-fa22-4ab6-b5ba-1b450850a350` |

**Folders:**

- Pages doc-type folder: `a2c71960-9678-4b56-9828-c1d8f8f7df40`
- Element Content Models folder: `1645b9b1-459b-40e7-90a5-ea194afda61d`
- Home doc type (parent for allowed-child update): `a95360e8-ff04-40b1-8f46-7aa4b5983096`

**New element types to create (8):**

| Alias | Purpose | Properties |
|---|---|---|
| `showcaseHero` | Page-opening band | `eyebrow` (textstring), `headline` (textstring), `subhead` (textarea), `backgroundImage` (image media picker, optional), `accentMark` (textstring, optional) |
| `pillarSection` | Parent for a capability pillar; areas configured at grid level | `pillarNumber` (numeric), `eyebrow` (textstring), `headline` (textstring), `lede` (textarea), `tone` (new `[Dropdown] Pillar Tone`: light/dark/accent), `anchorId` (textstring, optional) |
| `featureCard` | Single card in a multi-card row | `eyebrow` (textstring, optional), `title` (textstring), `body` (richtext), `iconToken` (textstring, optional), `link` (Multi URL Picker, single) |
| `commandBadge` | Slash-command chip | `commandName` (textstring), `oneLiner` (textstring), `meta` (textstring, optional) |
| `statCallout` | Large figure + caption | `figure` (textstring), `unit` (textstring), `supporting` (textarea, optional) |
| `pullQuoteBlock` | Pull quote with attribution | `quote` (textarea), `attribution` (textstring), `attributionRole` (textstring, optional), `tone` (new `[Dropdown] Pillar Tone`: light/dark/accent, reused) |
| `embeddedSketch` | Algorithmic art slot | `sketchUrl` (textstring), `posterImage` (image media picker, required), `caption` (textstring, optional) |
| `timelineRow` | Single shipped-feature row | `date` (date picker), `featureName` (textstring), `oneLiner` (textstring), `link` (Multi URL Picker, single, optional) |

**New data types to create (2):**

| Name | Editor UI | Notes |
|---|---|---|
| `[Dropdown] Pillar Tone` | `Umb.PropertyEditorUi.Dropdown` | Options: `light`, `dark`, `accent`. Reused on `pillarSection` and `pullQuoteBlock`. |
| `[BlockGrid] Experiments Body` | `Umb.PropertyEditorUi.BlockGrid` | 12 columns. Root blocks: `showcaseHero`, `pillarSection`. `pillarSection` has areas `header` / `body` / `media` with constrained allowed children (see Step 1). Default column span 12, with column-span options [12, 8, 6, 4] enabled to demonstrate multi-column flexibility. Also registers `featureCard`, `commandBadge`, `statCallout`, `pullQuoteBlock`, `embeddedSketch`, `timelineRow`, `richTextRow`, `imageRow`, `iconLinkRow`, `alertBanner` as allowable inside areas. |

**New doc type to create (1):**

| Alias | Name | Composes | Allowed under | Body property |
|---|---|---|---|---|
| `experimentsLandingPage` | Experiments Landing Page | Visibility Controls, Page Head Pattern Controls, SEO Controls, Section Navigation Controls | Home | `body` → `[BlockGrid] Experiments Body` |

---

## Steps

Each step is designed to be completed independently in its own context window. The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Schema rollout (Management API script)

> **Prompt**: Implement Step 1 of `_plans/innovation-showcase.md`. Create a one-shot Node script at `scripts/setup-experiments-schema.mjs` that uses the Umbraco Management API (OAuth client credentials from `.env`) to: (a) create the `[Dropdown] Pillar Tone` data type with options `light`, `dark`, `accent`; (b) create the `[BlockGrid] Experiments Body` data type with 12 columns, root-allowed blocks `showcaseHero` and `pillarSection`, area `header` (allows `richTextRow`, `commandBadge`, `alertBanner`), area `body` (allows `featureCard`, `commandBadge`, `statCallout`, `pullQuoteBlock`, `timelineRow`, `richTextRow`, `iconLinkRow`), and area `media` (allows `imageRow`, `embeddedSketch`); (c) create the 8 new element types listed in the Key Decisions table (`showcaseHero`, `pillarSection`, `featureCard`, `commandBadge`, `statCallout`, `pullQuoteBlock`, `embeddedSketch`, `timelineRow`) with the property aliases and data-type IDs from the Key Decisions table; (d) create the `experimentsLandingPage` doc type composed of Visibility Controls, Page Head Pattern Controls, SEO Controls, Section Navigation Controls with a single `body` property pointing at the new Block Grid data type; (e) update Home's allowed-children list to add `experimentsLandingPage`. Run `dotnet build` afterwards as a smoke check; the build must succeed. Delete the setup script when done — schema is now in the live DB and serialized to `.uda` files.

**What to build**:

- `scripts/setup-experiments-schema.mjs` — Node script:
  - Loads `.env` (UMBRACO_CLIENT_ID / UMBRACO_CLIENT_SECRET / URL).
  - Re-acquires the OAuth token before each phase (token expires in 299s).
  - Reads existing data-type IDs and composition IDs from the Key Decisions table (hardcoded for this one-shot script — they're stable for this environment).
  - Creates the two new data types via `POST /umbraco/management/api/v1/data-type`.
  - Creates the 8 new element types via `POST /umbraco/management/api/v1/document-type` with `isElement: true`. Element types live under the `Element Content Models` folder (`1645b9b1-459b-40e7-90a5-ea194afda61d`).
  - Creates the new `experimentsLandingPage` doc type with `isElement: false` under Pages (`a2c71960-9678-4b56-9828-c1d8f8f7df40`), composing the four control compositions and exposing a single `body` property bound to the new Block Grid data type.
  - PUTs an update to Home's doc type that adds `experimentsLandingPage` to `allowedDocumentTypes` (read current Home doc type first, append, PUT). Use `mcp__umbraco-mcp__get-document-type-by-id` for the read if running interactively.
  - Logs each creation with its new UUID for traceability.

**Test first**: Not applicable — pure schema setup. Validation is the next step's build + browser check.

**Validation**:

- `cd src/UmbracoProject && dotnet build` — succeeds.
- In the backoffice: navigate to **Settings → Document Types → Pages** and confirm `Experiments Landing Page` appears.
- Open `Experiments Landing Page` and confirm the four compositions are checked, plus a `body` property bound to `[BlockGrid] Experiments Body`.
- Open the new Block Grid data type and confirm 12 columns, two root-allowed blocks, and `pillarSection` showing three named areas with the expected allowed-children lists.
- Open Home's doc type and confirm `Experiments Landing Page` is in its allowed children.
- Verify new `.uda` artifacts appear under `src/UmbracoProject/umbraco/Deploy/Revision/` for the new doc types, data types, and Home update.
- **Delete** `scripts/setup-experiments-schema.mjs` after the script has run successfully (commit history retains it via git if needed).

---

### Step 2 — Razor template + block grid component partials

> **Prompt**: Implement Step 2 of `_plans/innovation-showcase.md`. Create `src/UmbracoProject/Views/experimentsLandingPage.cshtml` (full-bleed template; layout = `master.cshtml`; renders the `body` Block Grid via `Html.GetBlockGridHtmlAsync(Model.Value<BlockGridModel>("body"))`; does **not** render the section-navigation sidebar even though the composition is attached). Create the eight new block grid component partials under `src/UmbracoProject/Views/Partials/blockgrid/Components/` (`showcaseHero.cshtml`, `pillarSection.cshtml`, `featureCard.cshtml`, `commandBadge.cshtml`, `statCallout.cshtml`, `pullQuoteBlock.cshtml`, `embeddedSketch.cshtml`, `timelineRow.cshtml`) with minimal, semantic markup — eyebrow / headline / lede / body / media slots. The `pillarSection` partial renders its own fields then calls `Html.GetBlockGridItemAreasHtmlAsync(Model)` to render the three areas. Also create four thin wrapper partials in the same folder (`richTextRow.cshtml`, `imageRow.cshtml`, `iconLinkRow.cshtml`, `alertBanner.cshtml`) that re-render the corresponding `blocklist/Components/{alias}.cshtml` partial with a `BlockListItem` constructed from the incoming `BlockGridItem`. Run `dotnet build` — must succeed.

**What to build**:

- `src/UmbracoProject/Views/experimentsLandingPage.cshtml` — Razor template; layout=master; minimal page-head treatment (no eyebrow / subtitle, because the hero band is editorial); `<main class="experiments">@await Html.GetBlockGridHtmlAsync(Model.Body)</main>`.
- `src/UmbracoProject/Views/Partials/blockgrid/Components/showcaseHero.cshtml` — `<section class="exp-hero">` with background image, eyebrow, h1, subhead, optional accentMark.
- `src/UmbracoProject/Views/Partials/blockgrid/Components/pillarSection.cshtml` — `<section class="exp-pillar exp-pillar--{tone}" id="{anchorId}">` containing pillar number, eyebrow, h2, lede, then `@await Html.GetBlockGridItemAreasHtmlAsync(Model)` for the three areas. Areas render via `area.cshtml` → `items.cshtml`.
- `src/UmbracoProject/Views/Partials/blockgrid/Components/featureCard.cshtml` — semantic card with eyebrow, h3, body.
- `src/UmbracoProject/Views/Partials/blockgrid/Components/commandBadge.cshtml` — `<div class="exp-cmd">` with `<code>` for the command name, oneLiner, meta.
- `src/UmbracoProject/Views/Partials/blockgrid/Components/statCallout.cshtml` — figure (Cormorant), unit (Source Sans), supporting line.
- `src/UmbracoProject/Views/Partials/blockgrid/Components/pullQuoteBlock.cshtml` — `<blockquote>` + attribution.
- `src/UmbracoProject/Views/Partials/blockgrid/Components/embeddedSketch.cshtml` — `<figure class="exp-sketch">` containing a `data-sketch-url` div and the poster `<img>`. The JS layer (Step 6) attaches an iframe inside the div when motion is allowed and visible.
- `src/UmbracoProject/Views/Partials/blockgrid/Components/timelineRow.cshtml` — `<li class="exp-timeline__row">` with date, featureName, oneLiner.
- `src/UmbracoProject/Views/Partials/blockgrid/Components/richTextRow.cshtml`, `imageRow.cshtml`, `iconLinkRow.cshtml`, `alertBanner.cshtml` — each is a 4-line wrapper:
  ```cshtml
  @inherits UmbracoViewPage<BlockGridItem>
  @{
      var listItem = new BlockListItem(Model.ContentKey, Model.Content, Model.SettingsKey, Model.Settings);
  }
  @await Html.PartialAsync("~/Views/Partials/blocklist/Components/{alias}.cshtml", listItem)
  ```

**Test first** *(creates the test file but the first assertion proves the template route works)*:

- Write `tests/e2e/experiments/experiments.spec.ts` with one initial scenario:
  - In `beforeAll`: clean any stale Experiments page; create a new Experiments Landing Page under Home via Management API; publish it; capture the actual published URL from the API response.
  - Test: navigate to the captured URL; expect `response.status() === 200` and `<main class="experiments">` is in the DOM.
- Run: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/experiments/experiments.spec.ts` — confirm RED (route doesn't exist yet), implement the template, confirm GREEN.

**Validation**:

- `cd src/UmbracoProject && dotnet build` — succeeds.
- `PATH="..." npx playwright test tests/e2e/experiments/experiments.spec.ts` — GREEN.
- Manual: open the backoffice, create a transient Experiments page under Home, drop a `showcaseHero` and a `pillarSection` (with one Rich Text in `header`, one Feature Card in `body`, one Image in `media`), publish, navigate to its URL, confirm all blocks render without "Could not render component" errors.

---

### Step 3 — Content seed script (pre-populated Experiments page)

> **Prompt**: Implement Step 3 of `_plans/innovation-showcase.md`. Create `scripts/seed-experiments-page.mjs` — a Node script that, when run, deletes any existing Experiments Landing Page under Home and recreates it from scratch with the full nine-section structure (hero + 7 pillars + closing band) and all child blocks pre-populated in the plain-language voice from the project chat thread. Use the Management API; build the Block Grid layout JSON deterministically. The seven pillars follow the order in the spec, each with: a `pillarSection` parent block (with eyebrow, headline, lede, tone, pillarNumber) and children in `header` / `body` / `media` areas — Pillar 1 (workflow timeline of 9 shipped features), Pillar 2 (3×2 grid of `commandBadge`s for `/spec`, `/plan`, `/block`, `/feature`, `/code-review`, `/guide`), Pillar 3 (Rich Text + Pull Quote in body, Image in media), Pillar 4 (Pull Quote with Ella attribution; Image in media references Ella's existing portrait media item — look up by name "Ella" under media), Pillar 5 (accent tone; 4 `statCallout`s and a Rich Text in body — this is the signal-red pillar), Pillar 6 (Rich Text + Feature Card row in body, Image in media), Pillar 7 (Rich Text in body, `embeddedSketch` in media — sketch URL set to `/experiments/sketches/v1.html`, poster image is a placeholder for now). Hero block uses a placeholder background image. Closing band is a `pillarSection` with `tone=dark` containing a Rich Text "next-up" line and an Icon Link to `/capabilities` styled as the primary CTA. Run the script; verify the page renders end-to-end at its published URL with all blocks visible. Expand `experiments.spec.ts` to assert: hero headline visible, all seven pillar headlines visible in order, "See the full capability tracker" CTA links to `/capabilities`, top nav contains "Experiments" link.

**What to build**:

- `scripts/seed-experiments-page.mjs` — idempotent setup:
  - Authenticate via OAuth client credentials.
  - Look up Home's UUID.
  - Look up Ella's portrait media UUID (search media tree by name "Ella" → find portrait child).
  - Delete any existing Experiments page under Home (search children by doc-type alias).
  - Build the `body` Block Grid value as a JSON object with `layout`, `contentData`, and `settingsData` arrays. Pre-populate with the full content tree.
  - `POST /umbraco/management/api/v1/document` to create the page; `PUT .../publish`.
  - Log the published URL.
- **Keep this script in the repo** under `scripts/` — unlike the schema setup, this is content seeding and may need to be re-run when copy is iterated. Add a small README note inside the file's top comment.

**Test first**: Expand `tests/e2e/experiments/experiments.spec.ts`:

- After seed, fetch the page URL.
- Assert hero `<h1>` is visible with the headline `What this Umbraco site has unlocked` (or whatever the seed sets).
- Assert seven `<h2>` headlines appear, in the order specified by the spec.
- Assert the closing CTA `a` element has `href="/capabilities"`.
- Assert the top nav (selector from `_SiteHead.cshtml`) contains a link with text `Experiments` pointing at the page URL.
- Run: `PATH="..." npx playwright test tests/e2e/experiments/experiments.spec.ts` — confirm GREEN after seed.

**Validation**:

- `PATH="..." node scripts/seed-experiments-page.mjs` — completes with success log; URL logged.
- Open the logged URL in a browser — page renders all nine sections; no missing-partial errors; pillar order matches spec.
- Top nav now shows **Experiments** link (auto-added because the page is published and not hidden).

---

### Step 4 — Design system CSS (hero, pillar tones, cards, callouts, pull quote, timeline)

> **Prompt**: Implement Step 4 of `_plans/innovation-showcase.md`. Create `src/UmbracoProject/wwwroot/assets/css/experiments.css` with the full set of bespoke styles for the Experiments page: hero band (`--surface-dark` with `--surface-overlay`, generous `--space-2xl` padding, Cormorant 600 headline), pillar surface alternation (`.exp-pillar--light` = `--surface-primary`, `--dark` = `--surface-dark` + `--text-on-dark`, `--accent` = `--accent-primary` + `--text-on-dark`), card grid (3 cols at lg, 2 at md, 1 at sm, gap = `--space-lg`, border-radius 0, no shadow at rest, subtle elevation on hover), command badge (`<code>` styled in IBM Plex Mono with a signal-red wedge accent), stat callout (Cormorant figure at large display size, signal red on dark surfaces, warm bronze on light), pull quote (negative left margin on lg; left-border accent on sm; tone-aware light/dark), timeline (vertical list with date label, headline, oneLiner; date column ~6em on lg, stacks on sm), embedded sketch frame (constructivist near-black surround, 16:9 aspect ratio, poster image absolutely positioned over the iframe slot), closing band (full-bleed dark, single primary CTA in signal red with sharp corners). Link the stylesheet from `experimentsLandingPage.cshtml` via `@section Styles`. Verify at 1440, 768, and 390 viewports in the browser. Write `tests/e2e/experiments/experiments.designSystem.spec.ts` asserting: the accent-toned pillar's computed background is the project's signal-red token, no element on the page has a computed `border-radius` greater than 0px, no link uses the inherited purple (`rgb(136, 89, 182)`).

**What to build**:

- `src/UmbracoProject/wwwroot/assets/css/experiments.css` — all bespoke styles for `.experiments` and descendants.
- Update `src/UmbracoProject/Views/experimentsLandingPage.cshtml` to include `@section Styles { <link href="/assets/css/experiments.css" ... /> }`.

**Test first**:

- Write `tests/e2e/experiments/experiments.designSystem.spec.ts`:
  - Navigate to the seeded page URL.
  - Find the pillar element with `tone=accent` (selector: `.exp-pillar--accent`); assert its computed `background-color` matches `rgb(194, 61, 46)` (the signal-red token `--accent-primary`).
  - Sample 5–10 elements (hero, pillar, card, button, link); for each, assert `getComputedStyle(el).borderRadius === '0px'`.
  - Sample anchor elements within `.experiments`; assert none have `color: rgb(136, 89, 182)` (inherited purple).
- Run RED first (before the CSS file is linked), then GREEN after.

**Validation**:

- Browser at 1440px, 768px, 390px — visual check: hero is dark, pillars alternate light/stone, one pillar is red, all corners are sharp, pull quote floats left on desktop, timeline is readable.
- `PATH="..." npx playwright test tests/e2e/experiments/experiments.designSystem.spec.ts` — GREEN.

---

### Step 5 — Responsive E2E + visual stacking

> **Prompt**: Implement Step 5 of `_plans/innovation-showcase.md`. Write `tests/e2e/experiments/experiments.responsive.spec.ts` that runs the page at 1440, 768, and 390 viewport widths and asserts: (1440) card grid renders at 3 columns; (768) card grid renders at 2 columns; (390) all multi-column rows have collapsed to 1 column, the pull quote has no negative left margin and instead has a visible left-border accent, no horizontal scrollbar appears (`document.body.scrollWidth <= window.innerWidth`). Make any CSS fixes needed to the file from Step 4 to pass these assertions — common gotchas are inadequate `flex-wrap` on the command-badge row and forgotten `max-width: 100%` on the embedded sketch frame. Run the spec, confirm GREEN.

**What to build**:

- `tests/e2e/experiments/experiments.responsive.spec.ts`.
- Fixes to `experiments.css` as needed.

**Test first**:

- Write the responsive spec first; expect it to RED on the 390 viewport (likely a horizontal-scroll regression somewhere).
- Apply CSS fixes; confirm GREEN.

**Validation**:

- `PATH="..." npx playwright test tests/e2e/experiments/experiments.responsive.spec.ts` — GREEN at all three viewports.
- Manual: rotate through 1440/768/390 in Chrome DevTools device toolbar — visual cohesion intact.

---

### Step 6 — Algorithmic art sketch + hero background image

> **Prompt**: Implement Step 6 of `_plans/innovation-showcase.md`. Generate two assets via the project's existing skills. (a) Use the `/algorithmic-art` skill with a brief that fits the design system — Dark Constructivism palette, dense particle / flow-field composition, "decorative not narrative" — and export the resulting self-contained HTML to `src/UmbracoProject/wwwroot/experiments/sketches/v1.html`. Capture the static PNG export (built-in download button) to `src/UmbracoProject/wwwroot/experiments/sketches/v1-poster.png`. Upload the poster PNG to the Umbraco media library at `Media → Experiments` (create the folder if missing) and note its UUID. (b) Use the `/canvas-design` skill with the brief at `skills/output/canvas-design/radical-android-2026-04-09-philosophy.md` (or generate a fresh constructivist brief) to produce a 2400×1350 hero background; upload it to the same `Experiments` media folder. (c) Re-run `scripts/seed-experiments-page.mjs` after updating two media-UUID constants at the top of the script: `HERO_BG_UUID` and `SKETCH_POSTER_UUID`. Verify both assets render at their intended slots in the browser.

**What to build**:

- `src/UmbracoProject/wwwroot/experiments/sketches/v1.html` — self-contained p5.js sketch (no external network calls); pauses when the document is hidden.
- `src/UmbracoProject/wwwroot/experiments/sketches/v1-poster.png` — static PNG export of the same sketch (intermediate frame).
- One uploaded media item under `Media → Experiments` for the hero background image.
- One uploaded media item under `Media → Experiments` for the sketch poster image.
- Updated `scripts/seed-experiments-page.mjs` with the two new media UUIDs hardcoded as constants.

**Test first**: Not applicable — assets and seed update. Coverage is implicit (the sketch + poster are exercised in Step 7's reduced-motion test).

**Validation**:

- Browser: hero band now shows the dark constructivist background (with the `--surface-overlay` over it for legibility).
- Browser: algorithmic-art pillar shows the poster image initially; once Step 7 ships, it swaps to the live sketch when scrolled into view.
- Check `wwwroot/experiments/sketches/v1.html` is reachable directly at `https://localhost:44367/experiments/sketches/v1.html`.

---

### Step 7 — Sketch initialization JS (IntersectionObserver + reduced motion)

> **Prompt**: Implement Step 7 of `_plans/innovation-showcase.md`. Create `src/UmbracoProject/wwwroot/assets/js/experiments.js` that finds every `<figure class="exp-sketch">` on the page, reads its `data-sketch-url`, and: (a) under `prefers-reduced-motion: reduce`, does nothing (the poster remains visible — no iframe is ever created); (b) otherwise, uses `IntersectionObserver` to detect when the sketch enters the viewport, creates an iframe with `src=data-sketch-url` and inserts it above the poster (the poster fades out via CSS); (c) when the sketch leaves the viewport, removes the iframe to free resources and shows the poster again. Iframe errors (404 / network) trigger a fallback: remove the iframe and keep the poster. Link the JS file from `experimentsLandingPage.cshtml` via `@section Scripts` (use a `<script defer ...>`). Write `tests/e2e/experiments/experiments.reducedMotion.spec.ts` asserting: with `reducedMotion: 'reduce'` configured on the Playwright context, no `<iframe>` is ever mounted inside `.exp-sketch`; with motion allowed, scrolling the sketch into view eventually mounts an `<iframe>` whose `src` matches `/experiments/sketches/v1.html`; setting the sketch URL to a non-existent path in the seed (run a separate transient test page) causes no `<iframe>` to remain mounted.

**What to build**:

- `src/UmbracoProject/wwwroot/assets/js/experiments.js`.
- Update `src/UmbracoProject/Views/experimentsLandingPage.cshtml` to include `@section Scripts` with the JS reference.

**Test first**:

- Write `tests/e2e/experiments/experiments.reducedMotion.spec.ts` first.
- Two contexts:
  - Reduced motion: `await page.emulateMedia({ reducedMotion: 'reduce' })` before navigation; scroll to sketch; assert no `<iframe>` in `.exp-sketch`.
  - Standard motion: scroll to sketch; wait for `<iframe>` to mount; assert its `src` ends in `/experiments/sketches/v1.html`.
- Run RED first (JS not implemented), implement, confirm GREEN.

**Validation**:

- `PATH="..." npx playwright test tests/e2e/experiments/experiments.reducedMotion.spec.ts` — GREEN.
- Manual: open Chrome DevTools → Rendering → Emulate "prefers-reduced-motion: reduce"; reload the page; scroll to the algorithmic-art pillar; the sketch shows only the poster, no animation. Disable the emulation and reload — the sketch animates after entering the viewport.

---

### Step 8 — Block Grid backoffice E2E

> **Prompt**: Implement Step 8 of `_plans/innovation-showcase.md`. Write `tests/e2e/experiments/experiments.blockgrid.spec.ts` exercising the **backoffice** rather than the rendered page. In `beforeAll`: authenticate against the Management API; clean any stale transient pages whose name starts with `Exp BG Test`; create a fresh Experiments Landing Page under Home; capture its UUID. Tests: (1) GET the doc type via Management API; assert the `body` property's data type editor UI alias is `Umb.PropertyEditorUi.BlockGrid` and not `Umb.PropertyEditorUi.BlockList`; (2) GET the `[BlockGrid] Experiments Body` data type configuration; assert `gridColumns` is 12 and that `showcaseHero` + `pillarSection` are root-allowed blocks; (3) inspect the `pillarSection` block configuration in the data type and assert three named areas (`header`, `body`, `media`) each with an `allowedContentTypes` list that matches the spec (`body` includes `featureCard`, `commandBadge`, `statCallout`, `pullQuoteBlock`, `timelineRow`; `media` is restricted to `imageRow` and `embeddedSketch`). Delete the transient page in `afterAll`. Apply the E2E resilience rules from CLAUDE.md (dynamic UUIDs, no hardcoded URLs, token refresh between phases, regex assertions where appropriate).

**What to build**:

- `tests/e2e/experiments/experiments.blockgrid.spec.ts`.

**Test first**:

- Write the spec first; if any assertions fail (e.g. an area's allowed-children list is missing a block), fix the Step 1 data type configuration via a small follow-up Management API patch and re-run.

**Validation**:

- `PATH="..." npx playwright test tests/e2e/experiments/experiments.blockgrid.spec.ts` — GREEN.
- Manual: open the seeded Experiments page in the backoffice; expand a `pillarSection`; visually confirm three areas with the expected drop-allowed blocks.

---

### Step 9 — `/code-review` + `/check-uda` + commit

> **Prompt**: Implement Step 9 of `_plans/innovation-showcase.md`. Run `/code-review` on all uncommitted changes (Razor, CSS, JS, Node scripts, test specs, `.uda` files). Triage findings: fix every HIGH and CRITICAL from any of the three reviewers (accessibility, code quality, performance); document any MEDIUM/LOW deferrals in a one-line comment on the relevant file. Then run `/check-uda` — confirm the report shows no schema conflicts at LOW severity or higher; if it surfaces normalization drift in `umbraco-ai-*.uda` or built-in entity entries unrelated to this feature, ignore (they're noise from prior work). Once both gates are green, stage all changes and create a single commit summarising the feature in one sentence (the "why", not the "what"). Do **not** push yet — pause for human review of the diff.

**What to build**:

- Targeted fixes for any HIGH / CRITICAL findings the three reviewers surface (Razor markup, CSS specificity, JS resource cleanup, alt-text additions, focus-ring coverage, image preload, etc.).
- `.uda` artifacts will appear in `umbraco/Deploy/Revision/` from Steps 1 and 3 — confirm they're intentional before staging (run `git diff --stat src/UmbracoProject/umbraco/Deploy/Revision/` for sanity).

**Test first**: Not applicable — gate step.

**Validation**:

- `/code-review` reports no new HIGH or CRITICAL findings.
- `/check-uda` reports no conflicts at LOW severity or higher (other than pre-existing noise).
- `git status` shows a clean staged tree; the single commit message accurately reflects "what this unlocks."

---

### Step 10 — Verify feature behavioral spec

> **Prompt**: Run `/feature update _features/innovation-showcase.md` to verify the living behavioral spec reflects the actual implementation. Walk every scenario in the feature doc: confirm the rule it proves still applies, update any scenarios where the implementation diverged from the draft (e.g. exact hero headline wording, exact CTA label, the actual signal-red token value used), fill in the test coverage table with real test file paths and line numbers, and remove the **Draft** banner at the top. Add a final revision-note line. Commit the verified feature doc as a separate commit.

**Validation**:

- Every scenario in `_features/innovation-showcase.md` matches observable behavior on `/experiments`.
- Test coverage table has no unexpected "Not covered" gaps for scenarios that were planned to be covered.
- **Draft** banner is removed.

---

## File Summary

| Action | File |
|--------|------|
| Create (delete after running) | `scripts/setup-experiments-schema.mjs` |
| Create | `scripts/seed-experiments-page.mjs` |
| Create | `src/UmbracoProject/Views/experimentsLandingPage.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/blockgrid/Components/showcaseHero.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/blockgrid/Components/pillarSection.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/blockgrid/Components/featureCard.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/blockgrid/Components/commandBadge.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/blockgrid/Components/statCallout.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/blockgrid/Components/pullQuoteBlock.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/blockgrid/Components/embeddedSketch.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/blockgrid/Components/timelineRow.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/blockgrid/Components/richTextRow.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/blockgrid/Components/imageRow.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/blockgrid/Components/iconLinkRow.cshtml` |
| Create | `src/UmbracoProject/Views/Partials/blockgrid/Components/alertBanner.cshtml` |
| Create | `src/UmbracoProject/wwwroot/assets/css/experiments.css` |
| Create | `src/UmbracoProject/wwwroot/assets/js/experiments.js` |
| Create | `src/UmbracoProject/wwwroot/experiments/sketches/v1.html` |
| Create | `src/UmbracoProject/wwwroot/experiments/sketches/v1-poster.png` |
| Create (uploaded media) | hero background + sketch poster under `Media → Experiments` |
| Create | `tests/e2e/experiments/experiments.spec.ts` |
| Create | `tests/e2e/experiments/experiments.responsive.spec.ts` |
| Create | `tests/e2e/experiments/experiments.blockgrid.spec.ts` |
| Create | `tests/e2e/experiments/experiments.reducedMotion.spec.ts` |
| Create | `tests/e2e/experiments/experiments.designSystem.spec.ts` |
| Update | `src/UmbracoProject/umbraco/Deploy/Revision/` (new `.uda` artifacts auto-generated from schema work) |
| Update | `_features/innovation-showcase.md` (Draft banner removed, test coverage filled in) |
