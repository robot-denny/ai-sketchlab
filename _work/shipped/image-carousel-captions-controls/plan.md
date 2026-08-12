# Plan: Image Carousel Captions and Refined Controls

> Source spec: [../_specs/shipped/image-carousel-captions-controls.md](../_specs/shipped/image-carousel-captions-controls.md)
> Living feature: [../_features/image-carousel-captions-controls.md](../_features/image-carousel-captions-controls.md)

## Context

The Image Carousel Row block was built in the previous iteration ([_plans/shipped/image-carousel-block.md](../../Sites/umbraco-17-demo-site/_plans/shipped/image-carousel-block.md)) using a Bootstrap 5 carousel with a multi-media picker (`images`) and a custom JS layer for accessibility. It works, but two things hold it back:

1. **Editorial expressivity** — slides are anonymous images. Editors can't add per-slide context (e.g. captions like "Sunrise over the harbour"), which limits the block's usefulness for storytelling pages.
2. **Visual / interaction polish** — controls (prev/next arrows, indicators, play/pause) are stock-Bootstrap, overlay the imagery, and the play/pause toggle carries visible "Play carousel" / "Pause carousel" text that competes with the image. The interface reads as boilerplate rather than considered.

This iteration restructures the block around a new **Image Carousel Slide** element type (image + optional caption), adds a **Show captions** toggle on the row, and produces a refined control bar that sits **below** the image, with arrows that adapt at the **lg (992px)** breakpoint. All previously-validated accessibility behaviour (focus pause, manual-pause override, `prefers-reduced-motion`, descriptive indicators, keyboard operability) is preserved and extended.

Migration is **replace in place** — the demo page using this block will go blank for `images` until the editor manually re-adds slides via the backoffice (per spec's stated strategy).

## Key Design Decisions

- **New element type, `imageCarouselSlide`** — properties `image` (required media picker) and `caption` (textstring, optional). Created via the Umbraco MCP server so `.uda` is generated cleanly.
- **`imageCarouselRow` schema swap** — drop `images`, add `slides` (block list restricted to `imageCarouselSlide`) and `showCaptions` (boolean, default `false`). `author` and `scrollSpeedMs` retained. `imageCarouselRowSettings` unchanged.
- **Bootstrap 5 carousel kept** — the existing custom JS (focus/hover pause, manual-pause flag, reduced-motion handling) already works and is regression-tested. We extend it minimally; we do not rewrite.
- **Control layout** — controls move below the image-and-caption area. At `< lg` the prev/next arrows overlay the image with a solid background; at `≥ lg` they sit outside the image and the grid reserves space so the image width does not visibly reflow at the breakpoint.
- **Play/pause is icon-only** — the visible `<span class="carousel-play-pause-label">…</span>` is dropped. The button keeps an `aria-label` that toggles between "Play carousel" and "Pause carousel". Minimum target size 44×44.
- **Focus order** (per resolved open question): slide content (if focusable) → prev → indicators → next → play/pause.
- **Caption typography**: `--caption` token (additive) — left aligned (per resolved open questions).
- **Pagination indicator style**: re-explored as part of the design step (current implementation is numbered buttons).
- **Visual refinement** is produced first by the `frontend-design` skill, captured in a short notes file, then implemented. Any new tokens are **additive**; we do not override existing tokens used by other components.
- **TDD throughout** — each behaviour change starts with a failing assertion in `tests/e2e/blocks/imageCarousel.spec.ts` (and accompanying file-content checks). The spec file is the existing one — extended in place rather than replaced, so the regression coverage from the previous iteration moves with us.

## Reference Files

| Path | Why it matters |
|------|----------------|
| `src/UmbracoProject/Views/Partials/blocklist/Components/imageCarouselRow.cshtml` | The Razor partial to restructure (loops `Images` today; will loop `Slides`) |
| `src/UmbracoProject/wwwroot/assets/js/carousel.js` | Handles focus/hover pause, manual-pause flag, `prefers-reduced-motion`, play/pause toggle. Drop the visible-label DOM swap; keep aria-label swap. |
| `src/UmbracoProject/wwwroot/css/index.css` | Custom CSS file; new carousel control styles + additive tokens go here (not in `assets/css/styles.css`, which is generated/Bootstrap) |
| `src/UmbracoProject/umbraco/Deploy/Revision/document-type__1c43fe2d4a9a4336923f9d0214950d48.uda` | `imageCarouselRow` schema — will be modified by Umbraco when we change properties via MCP |
| `_plans/shipped/image-carousel-block.md` | Style reference for this plan (numbered steps, paste-ready prompts, TDD framing) |
| `tests/e2e/blocks/imageCarousel.spec.ts` | Existing test — extended in place. Sections (1) element-type, (2) file content, (3) browser E2E |
| `tests/e2e/contentSectionRows.spec.ts` | **Reference** for block-list-within-block-list payload structure (mirror this for `slides`) |
| `_specs/design-system.md` | Source of truth for typography, colour, motion, zero-radius rule |
| `_features/image-carousel-captions-controls.md` | Living feature spec; test-coverage table to fill in at the end |

## File Summary

| Action | File | Notes |
|--------|------|-------|
| Create (via MCP, regenerated `.uda`) | `umbraco/Deploy/Revision/document-type__<new-guid>.uda` | New `imageCarouselSlide` element type |
| Modify (via MCP) | `umbraco/Deploy/Revision/document-type__1c43fe2d4a9a4336923f9d0214950d48.uda` | Drop `images`, add `slides` (block list) + `showCaptions` (boolean) |
| Create (via MCP) | New Block List data type restricted to `imageCarouselSlide` | Used by the `slides` property |
| Modify | `src/UmbracoProject/Views/Partials/blocklist/Components/imageCarouselRow.cshtml` | Loop `Slides`, render captions when `ShowCaptions`, restructure controls |
| Modify | `src/UmbracoProject/wwwroot/assets/js/carousel.js` | Drop visible-label span swap; keep aria-label state machine |
| Modify | `src/UmbracoProject/wwwroot/css/index.css` | Additive tokens (`--caption`, control bar, arrow positioning) + control CSS at lg breakpoint |
| Modify | `tests/e2e/blocks/imageCarousel.spec.ts` | Extended schema + file + browser sections; new viewport tests; reduced-motion emulation |
| Create | `_plans/notes/image-carousel-controls-design.md` | Short rationale doc capturing design-skill output (token names, layout decisions) |
| Modify | `_features/image-carousel-captions-controls.md` | Fill in Test Coverage table; mark Last Verified date |

---

## Steps

Each step opens with what to build and why, lists test-first work where applicable, and ends with a paste-ready prompt that another Claude session can run with no further context.

### Step 1 — Schema RED: extend element-type tests for the new structure

Update **Section 1 (Element Type Tests)** in `tests/e2e/blocks/imageCarousel.spec.ts` so it asserts the new contract:

- `imageCarouselSlide` element type exists, `isElement: true`, has properties `image` (Media Picker, single) and `caption` (Textstring).
- `imageCarouselRow` properties: `slides` (Block List, restricted to `imageCarouselSlide`), `showCaptions` (Boolean, default false), `scrollSpeedMs`, `author`. **No `images` property.**
- `imageCarouselRowSettings` unchanged.

Use `umbracoApi.documentType.getByName(...)` per the existing pattern. Use `getChildren(folderId)` (Compositions folder `3503b89f-2819-4e41-86d7-d17dcc5b4212`) as a fallback if `getByName` short-circuits (per memory). Run the suite — these tests must fail (RED) because the schema hasn't moved yet.

> **Prompt**: Read `_plans/shipped/image-carousel-captions-controls.md` and complete Step 1. In `tests/e2e/blocks/imageCarousel.spec.ts`, replace the assertions in the existing "Image Carousel Row — Element Type" describe block so they match the new contract: `imageCarouselSlide` element type with `image` (Media Picker single) and `caption` (Textstring) properties; `imageCarouselRow` with `slides` (Block List restricted to `imageCarouselSlide`), `showCaptions` (Boolean default false), `scrollSpeedMs` and `author`, and **no** `images` property; `imageCarouselRowSettings` unchanged. Use `umbracoApi.documentType.getByName(...)` and fall back to `umbracoApi.documentType.getChildren('3503b89f-2819-4e41-86d7-d17dcc5b4212')` and the Elements/Pages folder ids if `getByName` short-circuits. Run `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/blocks/imageCarousel.spec.ts -g "Element Type"` and confirm the new assertions fail. Do not change any production code in this step.

### Step 2 — Schema GREEN: apply the schema changes via the Umbraco MCP

Use the Umbraco MCP (`mcp__umbraco-mcp__*`) to:

1. Create a new Block List data type (single editor instance) restricted to the new slide element type.
2. Create the `imageCarouselSlide` element type in the Elements folder (`5dde5b35-b5f9-4d61-aaf1-158368a1b0fb`) with `image` (Media Picker single) and `caption` (Textstring).
3. Update `imageCarouselRow` (id `1c43fe2d-4a9a-4336-923f-9d0214950d48`): remove `images`, add `slides` (the block list data type), add `showCaptions` (Toggle, default false). Re-order so `showCaptions` sits beside `scrollSpeedMs`.

After each change, run the schema test until it goes GREEN. Then run `/check-uda` to confirm the regenerated `.uda` files are clean and safe to commit.

> **Prompt**: Read `_plans/shipped/image-carousel-captions-controls.md` and complete Step 2. Using the Umbraco MCP server (verify reachability with `mcp__umbraco-mcp__get-document-type-root` first), (a) create a new Block List data type called "Image Carousel Slides" restricted to a single allowed element type (the slide type you create in step b); (b) create an element type `imageCarouselSlide` in the Elements folder `5dde5b35-b5f9-4d61-aaf1-158368a1b0fb` with property `image` (Media Picker, single, required) and property `caption` (Textstring, optional); (c) update element type `imageCarouselRow` (id `1c43fe2d-4a9a-4336-923f-9d0214950d48`) — remove the `images` property, add `slides` using the data type from (a), and add `showCaptions` (Toggle / Boolean, default false). Keep `author` and `scrollSpeedMs`. Run `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/blocks/imageCarousel.spec.ts -g "Element Type"` and confirm GREEN. Then invoke `/check-uda` to validate the regenerated `.uda` files are safe to commit. Do not modify the Razor partial, JS, or CSS in this step.

### Step 3 — Design exploration via the `frontend-design` skill

Run the `frontend-design` skill to produce a refined control bar (indicators, play/pause toggle, prev/next arrows). Output a short notes file at `_plans/notes/image-carousel-controls-design.md` capturing:

- Indicator style decision (numbered / dots / bars / other) with rationale
- Arrow background colour for narrow viewports (per resolved open question — either signal red or warm bronze)
- Hover / focus-visible treatments (must use `--ease-micro` 150ms and the design-system focus ring)
- Any new additive tokens (e.g. `--caption`, `--carousel-control-bg`) with proposed values
- A textual mockup or HTML sketch of the control bar at `< lg` and `≥ lg`

This is a manual-review checkpoint. **Do not write CSS yet.** Confirm the choices with the user before proceeding to Step 6.

> **Prompt**: Read `_plans/shipped/image-carousel-captions-controls.md` and complete Step 3. Invoke the `frontend-design` skill to refine the Image Carousel Row control bar (pagination indicators, play/pause toggle, prev/next arrows). Constraints: zero-radius, palette-compatible (signal red `--accent-primary` `#C23D2E`, warm bronze `--accent-secondary` `#8B6B4A`), constructivist character, all interactive controls ≥ 44×44 CSS px, focus-visible ring per `_specs/design-system.md`, `--ease-micro` (150ms) for hover. The control bar sits below the image; arrows overlay the image at `< lg` (with a solid background) and sit outside the image at `≥ lg` (grid reserves space). Output a markdown file at `_plans/notes/image-carousel-controls-design.md` with: chosen indicator style + rationale, arrow narrow-viewport background colour, additive tokens to introduce (name + value), and a small HTML sketch for both viewport states. Do not write any CSS/HTML/JS into the production source in this step. Stop at the end and ask the user to confirm the design before continuing.

### Step 4 — Razor + JS RED: tests for slides, captions, control structure

Extend **Section 2 (file content)** and **Section 3 (browser E2E)** in `tests/e2e/blocks/imageCarousel.spec.ts`:

File-content checks (whitespace-tolerant regex per the repo's E2E resilience rules):
- Partial iterates `Model.Content.Slides` (not `Images`).
- Partial conditionally renders captions guarded by `ShowCaptions`.
- Partial does **not** contain a visible `<span class="carousel-play-pause-label">` — only an `aria-label`.
- Carousel control bar markup is positioned **after** the `.carousel-inner` element (i.e. controls live in a sibling container below the slides).

Browser E2E (extends the existing `beforeAll`):
- Build the page with **two** new test carousels: one multi-slide with mixed captions (one captioned, one blank), `showCaptions=true`; one multi-slide with captions present but `showCaptions=false`. Mirror the block-list-within-block-list payload structure from `tests/e2e/contentSectionRows.spec.ts` to assemble `slides` correctly (`contentData` with `imageCarouselSlide` `contentTypeKey`, `layout.Umbraco.BlockList`, `expose`).
- Assertions: caption text visible / not visible per toggle; play/pause button has no visible text but does have `aria-label="Pause carousel"` initially, and toggles to `"Play carousel"` on click; controls render in a container that is a DOM sibling **after** the image area.

Run the suite — the new assertions must fail (RED).

> **Prompt**: Read `_plans/shipped/image-carousel-captions-controls.md` and complete Step 4. Extend `tests/e2e/blocks/imageCarousel.spec.ts`: in the existing "Partial View" describe block, add file-content assertions (use whitespace-tolerant regexes) that the partial iterates `Model.Content.Slides` (not `.Images`), conditionally renders captions guarded by a `ShowCaptions` check, removes the visible `carousel-play-pause-label` span (only `aria-label` remains), and places the controls container as a DOM sibling after `.carousel-inner`. In the existing "Browser E2E" describe block, extend `beforeAll` to inject two test carousels using the block-list-within-block-list payload pattern from `tests/e2e/contentSectionRows.spec.ts` (use `contentData` entries with `contentTypeKey` set to the `imageCarouselSlide` element type id, `layout` keyed by `"Umbraco.BlockList"`, and `expose` entries) — one with `showCaptions=true` and mixed captions ("Sunrise over the harbour", ""), one with captions authored but `showCaptions=false`. Add assertions: visible caption text appears for the captioned slide when toggle is on, the literal caption text is absent from the DOM when toggle is off, the play/pause button has no visible text, its initial `aria-label` is "Pause carousel" and toggles to "Play carousel" on click, and the controls container is positioned after the carousel-inner element. Use a `freshToken()` helper (mirror the existing pattern in the same file). Run `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/blocks/imageCarousel.spec.ts` and confirm the new assertions fail (RED). Do not modify production code in this step.

### Step 5 — Razor + JS GREEN: render slides + captions, restructure controls

Update `src/UmbracoProject/Views/Partials/blocklist/Components/imageCarouselRow.cshtml`:

- Cast `Model.Content` to `ImageCarouselRow`; iterate `row.Slides` (`IEnumerable<BlockListItem<ImageCarouselSlide, …>>` — adjust to whatever the auto-generated model produces).
- For each slide: render `<img src="@slide.Image.Url(…)" alt="@slide.Image.GetAltText()">`; below the image, render `<figcaption>@slide.Caption</figcaption>` only when `row.ShowCaptions && !string.IsNullOrWhiteSpace(slide.Caption)`.
- Move the `.carousel-indicators` and the play/pause `<button>` out of the carousel-inner area into a sibling container directly below the slides.
- Strip the visible label `<span class="carousel-play-pause-label">…</span>`. Keep the `<i>` icon and the `aria-label`. Initial `aria-label` is "Pause carousel" (carousel auto-plays unless reduced motion).
- Single-slide path: still renders a plain `<img>` with no controls. Captions still respect `ShowCaptions` for that single slide.

Update `src/UmbracoProject/wwwroot/assets/js/carousel.js`: drop the DOM mutation that swaps the visible label text. Keep the icon swap and the `aria-label` swap. The icon swap should still call `window.FontAwesome.dom.i2svg()` after replacing the `<i>` element.

Run the test suite. Section 2 (file content) and the caption / aria-label assertions in Section 3 should now pass.

> **Prompt**: Read `_plans/shipped/image-carousel-captions-controls.md` and complete Step 5. Update `src/UmbracoProject/Views/Partials/blocklist/Components/imageCarouselRow.cshtml`: replace the `images` loop with iteration over `row.Slides` (the block list of `imageCarouselSlide` items — use the auto-generated published-content model), render each slide's image with alt text from `GetAltText()`, and conditionally render `<figcaption>@slide.Caption</figcaption>` directly below the image only when `row.ShowCaptions && !string.IsNullOrWhiteSpace(slide.Content.Caption)`. Move the `.carousel-indicators` and the play/pause button out of `.carousel-inner` into a new sibling container (e.g. `<div class="carousel-controls">…</div>`) immediately after `.carousel-inner`. Remove the visible `<span class="carousel-play-pause-label">…</span>`; keep the `<i>` icon plus the `aria-label` (initial value "Pause carousel"). Preserve the single-slide-as-plain-img branch but make captions still respect `ShowCaptions`. Update `src/UmbracoProject/wwwroot/assets/js/carousel.js` to drop the visible-label DOM swap; keep the icon swap (replace `<i>`, then call `window.FontAwesome.dom.i2svg()`) and the `aria-label` swap. Run `cd src/UmbracoProject && dotnet build` then `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/blocks/imageCarousel.spec.ts -g "Partial View|Browser E2E"` and confirm the file-content checks and the caption/aria-label browser assertions are GREEN. The viewport / target-size assertions added in Step 6 will still fail — that's expected.

### Step 6 — CSS RED: viewport, target-size, and zero-radius assertions

Add a new `test.describe` block in `tests/e2e/blocks/imageCarousel.spec.ts` for **"Refined controls — visual layout"**:

- At `page.setViewportSize({ width: 600, height: 800 })`: prev/next arrows have `position: absolute` (or grid overlay) over the image area; computed `background-color` is non-transparent (alpha > 0.95); each control's bounding box is ≥ 44×44.
- At `page.setViewportSize({ width: 1200, height: 800 })`: prev/next arrows' bounding boxes do **not** intersect the image's bounding box (they sit outside, in reserved grid space).
- All three control types (indicator, arrow, play/pause) have computed `border-radius: 0px`.
- Captions, when shown, are left-aligned (`text-align: left`).

Use `boundingBox()` for geometry checks and `evaluate(el => getComputedStyle(el)…)` for style checks. These all fail until Step 7 ships CSS.

> **Prompt**: Read `_plans/shipped/image-carousel-captions-controls.md` and complete Step 6. Add a new `test.describe('Image Carousel Row — Refined controls visual layout', () => { … })` block to `tests/e2e/blocks/imageCarousel.spec.ts`. Reuse the page URL set up by the existing `beforeAll`. Tests: (a) at `page.setViewportSize({ width: 600, height: 800 })`, the prev and next arrow elements overlap the carousel image area (use `boundingBox()` intersection) and have a non-transparent computed `background-color` (alpha ≥ 0.95 — parse via `getComputedStyle().backgroundColor`); (b) at `page.setViewportSize({ width: 1200, height: 800 })`, the prev arrow's right edge is ≤ the image's left edge and the next arrow's left edge is ≥ the image's right edge; (c) every clickable control (indicator buttons, arrows, play/pause) has a bounding box width and height ≥ 44; (d) every clickable control has computed `border-radius: 0px`; (e) when `showCaptions=true`, a visible caption element has computed `text-align: left`. Run `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/blocks/imageCarousel.spec.ts -g "Refined controls"` and confirm the new assertions fail (RED). Do not modify production CSS in this step.

### Step 7 — CSS GREEN: implement the refined control bar

Implement the styles in `src/UmbracoProject/wwwroot/css/index.css`, using the additive tokens defined in `_plans/notes/image-carousel-controls-design.md` from Step 3:

- Add the new tokens (`--caption`, `--carousel-control-bg`, etc.) inside `:root` — additive only, do not override existing ones.
- A new `.image-carousel` wrapper that uses CSS Grid:
  - `< lg`: single-column; arrows are `position: absolute` over the image with the chosen solid background.
  - `≥ lg`: three-column grid `[arrow] 1fr [image] [arrow]` so the image width does not change at the breakpoint; arrows sit in the side columns.
- `.carousel-controls` (control bar below the image): horizontal flex of indicators + play/pause toggle.
- All clickable controls: `min-width: 44px; min-height: 44px;` and `border-radius: 0;`.
- `:focus-visible` outline per the design system (`2px solid var(--accent-primary)`, offset 2px).
- `<figcaption>` styled with `--caption` token, `text-align: left`, and adequate top spacing.

Re-run the suite — Step 6 tests should now pass. Re-run the whole `imageCarousel.spec.ts` to confirm no regressions.

> **Prompt**: Read `_plans/shipped/image-carousel-captions-controls.md` and complete Step 7. In `src/UmbracoProject/wwwroot/css/index.css`, append (a) the additive design tokens listed in `_plans/notes/image-carousel-controls-design.md` inside `:root` (do not edit existing tokens); (b) a new `.image-carousel` wrapper using CSS Grid — single column at `< 992px` with prev/next arrows positioned absolutely over the image area with a solid (alpha 1) background, and a three-column grid `auto 1fr auto` at `@media (min-width: 992px)` so the image width does not visibly change at the breakpoint; (c) `.carousel-controls` styled as a horizontal flex container below the image holding indicators and play/pause; (d) `min-width: 44px; min-height: 44px; border-radius: 0;` on every clickable control (indicators, arrows, play/pause); (e) `:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }` for all controls; (f) `figcaption` styling with the `--caption` token, `text-align: left`, and a small top margin. Run `cd src/UmbracoProject && dotnet build` then `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/blocks/imageCarousel.spec.ts` and confirm the full suite is GREEN.

### Step 8 — Accessibility & motion: focus pause, manual-pause, reduced-motion

Add a final `test.describe('Image Carousel Row — Accessibility & motion', () => { … })` to the spec:

- Auto-play pauses when keyboard focus enters a control (Tab into prev), resumes on `focusout` after Tab away. Verify by spying on Bootstrap's `cycle()`/`pause()` via `page.evaluate()` (mirror the spy pattern already used in `imageCarousel.spec.ts:591–618`).
- Manual pause persists after `focusout` (regression of the existing scenario, re-asserted against the new DOM).
- `await page.emulateMedia({ reducedMotion: 'reduce' })` before navigation: assert the carousel does not auto-advance (active slide index stays put after `data-bs-interval` ms) and the play/pause button is still present.
- Alt-vs-caption independence: assert the active slide's `<img>` `alt` attribute equals the media-library alt text and the visible `<figcaption>` text equals the slide caption — they are not the same string.

Implement as needed in `carousel.js` if anything regresses. Otherwise this is purely test additions.

> **Prompt**: Read `_plans/shipped/image-carousel-captions-controls.md` and complete Step 8. Add `test.describe('Image Carousel Row — Accessibility & motion', () => { … })` to `tests/e2e/blocks/imageCarousel.spec.ts` covering: (a) auto-play pauses on keyboard focus into the prev arrow and resumes after Tab moves focus away — use the `bootstrap.Carousel.getOrCreateInstance(...)` spy pattern already used in this file (around lines 591–618) to assert `pause()`/`cycle()` invocations; (b) manual pause via the play/pause button persists after focusout; (c) with `await page.emulateMedia({ reducedMotion: 'reduce' })` before `page.goto(...)`, the active slide index does not change after `scrollSpeedMs + 500` ms and the play/pause button is still in the DOM; (d) the active slide's `<img>` `alt` attribute equals the media-library alt text while the visible `<figcaption>` text equals the slide caption (they are independent strings — author the test data with deliberately different values like alt="The engineering team standing in front of the office" and caption="Meet the team"). If `carousel.js` needs adjustment to keep any of these assertions GREEN, modify it minimally. Run `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/blocks/imageCarousel.spec.ts` and confirm the full file is GREEN.

### Step 9 — Manual backoffice verification + content re-author

Start the site (`cd src/UmbracoProject && dotnet run`), log in to the backoffice, and manually re-author the slides on the demo page that previously held the carousel (since `images` was dropped). Add 3 slides — two with captions, one without — and verify:

- The Show captions toggle is visible and defaults to off.
- Toggling it on re-renders the page with captions displayed below the appropriate images.
- Reordering slides in the backoffice reorders them on the rendered page.
- Browser dev-tools confirms 44×44 hit areas, no rounded corners, and the lg breakpoint at exactly 992px swaps arrow positioning.
- Screen reader (VoiceOver Cmd-F5) announces the correct play/pause state when activating the toggle.

Capture screenshots at 600px and 1200px viewport widths into `_plans/notes/image-carousel-controls-design.md` under a "Verified" subsection.

> **Prompt**: Read `_plans/shipped/image-carousel-captions-controls.md` and complete Step 9. Run `cd src/UmbracoProject && dotnet run` to start the site, then walk through the manual checks: (1) log in to the backoffice and re-author the demo carousel page that previously used the `images` property — add 3 Image Carousel Slides, two with captions ("Sunrise over the harbour", "Market day") and one without; verify the "Show captions" toggle exists and defaults to off. (2) Publish, then visit the page and confirm captions appear/disappear as the toggle is flipped and re-published. (3) Reorder slides in the backoffice and verify the front-end order changes. (4) Open dev tools at viewports 600 and 1200, confirm prev/next arrows overlay vs sit-outside, every control reports ≥ 44×44 in the box model, no control shows a non-zero border-radius, and the lg breakpoint swap happens exactly at 992px. (5) With VoiceOver enabled, activate the play/pause toggle and confirm the announced label changes between "Play carousel" and "Pause carousel". Capture two screenshots (600px and 1200px) and append them under a new "## Verified" section in `_plans/notes/image-carousel-controls-design.md` along with a brief sign-off note dated today.

### Step 10 — Update the living feature spec

Update `_features/image-carousel-captions-controls.md`:

- Fill in the **Test Coverage** table — for each scenario, point to `tests/e2e/blocks/imageCarousel.spec.ts` and the matching `test('…')` name; mark Status as "Covered" (or "Manual" for the VoiceOver step).
- Remove the **Draft** banner at the top.
- Set **Last verified** to today's date.
- Add a Revision Notes line for today summarising the iteration.

> **Prompt**: Read `_plans/shipped/image-carousel-captions-controls.md` and complete Step 10. In `_features/image-carousel-captions-controls.md`, fill in every row of the Test Coverage table by mapping each scenario to the corresponding test name in `tests/e2e/blocks/imageCarousel.spec.ts` and setting Status to "Covered" (or "Manual" for the VoiceOver/screen-reader scenario in Step 9). Remove the "**Draft**" banner from the header. Set "Last verified" to today's date. Add a new bullet under Revision Notes dated today summarising the iteration ("Added per-slide captions, Show captions toggle, refined control bar with responsive prev/next, icon-only play/pause, 44×44 targets"). Do not modify any other file.

### Step 11 — Final checks and pre-commit hygiene

- Run `/check-uda` to verify no risky `.uda` regenerations slipped in (especially watch for unintended changes to other element types touched as a side effect of MCP edits).
- Run `cd src/UmbracoProject && dotnet build` — clean.
- Run the full Playwright suite: `PATH="…" npx playwright test`.
- Review `git status` — confirm only intended files (`.uda` for `imageCarouselSlide` and `imageCarouselRow`, the partial, JS, CSS, the spec, the feature, and the design notes) are touched.
- Discard any stray `.uda` updates: `git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/` for any path you didn't intentionally change.
- When ready, draft a commit message via `/commit-message`.

> **Prompt**: Read `_plans/shipped/image-carousel-captions-controls.md` and complete Step 11. Run `/check-uda` to confirm `.uda` changes are limited to the new `imageCarouselSlide` element type, the modified `imageCarouselRow`, and the new Block List data type — discard any unrelated `.uda` regeneration with `git checkout -- <path>`. Run `cd src/UmbracoProject && dotnet build` and confirm a clean build. Run the full E2E suite with `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test` and confirm GREEN. Review `git status`; the only changed files should be: the two modified `.uda` files, the new `.uda` files for the slide element type and the slides block list data type, `src/UmbracoProject/Views/Partials/blocklist/Components/imageCarouselRow.cshtml`, `src/UmbracoProject/wwwroot/assets/js/carousel.js`, `src/UmbracoProject/wwwroot/css/index.css`, `tests/e2e/blocks/imageCarousel.spec.ts`, `_features/image-carousel-captions-controls.md`, and the new `_plans/notes/image-carousel-controls-design.md`. Do not commit unless the user explicitly asks.

---

## Verification (end-to-end)

Confirm the whole iteration is done by checking each acceptance criterion from the spec maps to a passing test or completed manual step:

1. AC1 (editor adds slides) — manual Step 9 + Section 3 setup builds slides via API.
2. AC2 (one toggle governs all captions) — Step 4 browser assertions.
3. AC3 (toggle off hides captions) — Step 4.
4. AC4 (toggle on shows captions below image) — Step 4.
5. AC5 (controls below image area) — Step 4 file-content assertion + Step 6 visual.
6. AC6 (responsive arrows at 992px) — Step 6.
7. AC7 (play/pause icon-only with aria-label) — Step 4.
8. AC8 (44×44 minimum target) — Step 6.
9. AC9 (preserved a11y behaviours) — Step 8.
10. AC10 (alt vs caption independence) — Step 8.
11. AC11 (design-system-compatible refinement) — Step 3 design notes + Step 6 zero-radius / colour assertions.

If all eleven map to a GREEN test or a signed-off manual check in `_plans/notes/image-carousel-controls-design.md`, the iteration is complete.
