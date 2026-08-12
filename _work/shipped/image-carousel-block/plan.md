# Plan: Image Carousel Block

## Context

The project already has an `Image Carousel Row` block (`imageCarouselRow` / `imageCarouselRowSettings`) that uses **Swiffy Slider** for slide-pan transitions. This plan upgrades it to meet the new spec:

- **Cross-fade** transition (Swiffy Slider doesn't support fade; replace with Bootstrap 5 carousel)
- **Scroll speed control** in milliseconds (new CMS property)
- **Accessibility**: pause on hover + focus, play/pause toggle, `prefers-reduced-motion`
- **Touch/swipe** support (Bootstrap 5 carousel provides this natively)
- **Infinite loop**

Alt text is read directly from the media library item — no per-image override is needed.

Bootstrap 5.3.2 is already loaded globally via CDN in `master.cshtml` — no new library is needed.

## Key Design Decisions

- **Replace Swiffy Slider with Bootstrap 5 carousel** using the `carousel-fade` class for cross-fade. Bootstrap's carousel also handles swipe, looping, and hover-pause natively.
- **Keep the existing `images` multi-media picker** on `imageCarouselRow` — no Block List or new element type required. Alt text is read from the media item via `.GetAltText()`.
- **`scrollSpeedMs`** added to the content element type (not settings), as an integer property. Default: 5000 ms. 0 = disable auto-scroll.
- **Accessibility JS** added in a new `wwwroot/assets/js/carousel.js` file (not in `scripts.js`, which is a third-party theme file) and referenced at the bottom of `master.cshtml`.
- **Hover + focus pause**: `data-bs-pause="false"` is set on the carousel element so Bootstrap's own `mouseleave→cycle()` handler is disabled. `carousel.js` manages both hover and focus pause entirely, which prevents Bootstrap from overriding a manual pause on mouse-out.
- **`prefers-reduced-motion`**: Bootstrap 5 respects this in its transitions. Additionally, the JS enhancement skips auto-play when the media query matches.
- **Play/pause toggle**: rendered in the Razor partial as a `<button>` adjacent to the indicators; managed by `carousel.js`.

---

## Step 1 — Schema changes via Management API

**Goal**: Add a `scrollSpeedMs` integer property to the existing `imageCarouselRow` element type. No new element types or data types are needed.

All Management API calls must be issued in a **single Node.js script** to avoid the 299-second token expiry. Run the script with:

```
PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" node scripts/setup-image-carousel-schema.mjs
```

### Sub-steps (order matters)

1. **Authenticate** — POST `/security/back-office/token` with `grant_type=client_credentials`.

2. **GET `imageCarouselRow` element type** (known key: `1c43fe2d-4a9a-4336-923f-9d0214950d48`) to capture its full current structure.

3. **Add `scrollSpeedMs` property** to the `Content` property group:
   - Name: `Scroll Speed (ms)`
   - Alias: `scrollSpeedMs`
   - Data type: `Umbraco.Integer` — look up the correct data type ID by searching the data-type tree for an existing integer/numeric type, or create a new one with editor alias `Umbraco.Integer`
   - Description: `Auto-scroll interval in milliseconds. Default is 5000. Set to 0 to disable auto-scroll.`
   - Sort order: after the existing `images` property (sort order 2)
   - Mandatory: false

4. **PUT the updated element type** with the new property included.

5. **Verify** — GET `imageCarouselRow` again and log its properties to confirm `scrollSpeedMs` is present alongside the unchanged `images` and `author` properties.

### Files auto-updated by Umbraco Deploy (do not edit manually)
- `umbraco/Deploy/Revision/document-type__1c43fe2d4a9a4336923f9d0214950d48.uda` — updated with `scrollSpeedMs`

### Testability check
Run the Section 1 tests in the E2E spec (Step 4) to assert the property exists before proceeding.

---

## Step 2 — Razor partial rewrite

**File**: `src/UmbracoProject/Views/Partials/blocklist/Components/imageCarouselRow.cshtml`

**Goal**: Replace Swiffy Slider markup with Bootstrap 5 carousel using cross-fade.

### Key changes

- Read `row.ScrollSpeedMs` for `data-bs-interval`; if 0 or null, set `data-bs-ride="false"` (no auto-scroll), otherwise `data-bs-ride="carousel"`
- Iterate `row.Images` (the existing multi-media picker — type `IEnumerable<IPublishedContent>`)
- Render a Bootstrap carousel with:
  - Class: `carousel slide carousel-fade`
  - `data-bs-interval` set from `scrollSpeedMs` (default 5000)
  - `data-bs-pause="false"` (hover pause handled entirely by JS; disables Bootstrap's native handler)
  - `data-bs-wrap="true"` (infinite loop)
- `.carousel-inner` with one `.carousel-item` per image; first item gets `active` class
- For each image: render `<img>` full-width (`w-100`) with:
  - `src` from `image.Url()`
  - `alt` from `image.GetAltText()`
  - `loading="lazy"` (except the first item: `loading="eager"`)
- Numbered indicator buttons: `aria-label="Go to slide X of Y"`, `aria-current="true"` on the active one
- Prev/next control buttons with `aria-label="Previous slide"` / `"Next slide"`
- A play/pause toggle `<button>` adjacent to the indicators:
  - `class="carousel-play-pause"`, `data-carousel-id="slider-{row.Key}"`
  - Contains a Font Awesome icon (`<i class="fa-regular fa-circle-pause" aria-hidden="true">`) and a visible text span (`<span class="carousel-play-pause-label">Pause carousel</span>`)
  - No `aria-label` — the span text is the button's accessible name (WCAG 2.5.3)
  - Both icon and span text toggled by JS on click
- Guard: if `Images` is null or empty → `return;` (no output)
- Guard: if only 1 image → render a plain `<img>` with no controls, indicators, or JS carousel wrapper
- `id="slider-@(row.Key.ToString())"` on the outer carousel div
- Maintain existing `spacingClasses` and settings hide-guard logic

### Example structure (conceptual only)

```
<div> [spacing wrapper]
  <div id="slider-{key}" class="carousel slide carousel-fade" data-bs-ride="{carousel|false}" data-bs-interval="{speed}" data-bs-pause="hover" data-bs-wrap="true">
    <div class="carousel-inner">
      <div class="carousel-item active"> <img src="..." alt="..." loading="eager"> </div>
      <div class="carousel-item"> <img src="..." alt="..." loading="lazy"> </div>
    </div>
    [indicators + play/pause button]
    [prev/next controls]
  </div>
</div>
```

---

## Step 3 — Accessibility JS (`carousel.js`)

**New file**: `src/UmbracoProject/wwwroot/assets/js/carousel.js`  
**Reference in**: `src/UmbracoProject/Views/master.cshtml` (add `<script src="/assets/js/carousel.js" asp-append-version="true">` after `swiffy-slider.min.js`)

### Behaviours to implement

1. **Focus pause/resume**  
   On `DOMContentLoaded`, for each `.carousel` element:
   - Add `focusin` listener → call `bootstrap.Carousel.getInstance(el).pause()`
   - Add `focusout` listener → only resume if the focus target moved outside the carousel container → call `.cycle()`

2. **Play/pause toggle button**  
   For each `.carousel-play-pause` button:
   - On `click`, toggle paused state via `bootstrap.Carousel.getOrCreateInstance(carouselEl)`
   - Update the `.carousel-play-pause-label` span text to `"Play carousel"` or `"Pause carousel"` — this is the button's accessible name (no `aria-label` needed)
   - Swap the icon by replacing the FA-generated `<svg>` with a new `<i>` element, then calling `FontAwesome.dom.i2svg({ node: btn })`. This is required because Font Awesome JS replaces `<i>` elements with inline `<svg>` on load, so class manipulation on `<i>` has no effect at runtime.
   - Icons used: `fa-regular fa-circle-pause` (playing state) and `fa-regular fa-circle-play` (paused state)

3. **`prefers-reduced-motion` handling**  
   On `DOMContentLoaded`, check `window.matchMedia('(prefers-reduced-motion: reduce)').matches`:
   - If `true`: pause all `.carousel` instances and set play/pause buttons to their "paused" visual state
   - Add a `change` listener to react if the OS setting changes mid-session

### Notes
- Bootstrap 5's CSS already sets `transition: none` under `@media (prefers-reduced-motion: reduce)` for carousel slides — no additional CSS override needed.
- `bootstrap.Carousel.getInstance(el)` requires Bootstrap JS to be initialised. This script loads after `bootstrap.bundle.min.js` in the layout, so `DOMContentLoaded` is safe.

---

## Step 4 — E2E tests

**New file**: `tests/e2e/blocks/imageCarousel.spec.ts`

Follow the patterns from `alertBanner.spec.ts`: `freshToken()`, `apiFetch()`, `getDocumentPath()` helpers, `dotenv.config()`, serial test mode.

### Section 1: Element Type Tests (no browser)

- `imageCarouselRow` element type exists, `isElement: true`
- Has `images`, `author`, and `scrollSpeedMs` properties
- `imageCarouselRowSettings` element type still exists

### Section 2: Partial View File Tests (no browser)

- File `Views/Partials/blocklist/Components/imageCarouselRow.cshtml` exists
- File content includes `carousel-fade`
- File content includes `data-bs-interval`
- File content includes `carousel-play-pause`
- File content includes `GetAltText`
- File does **not** reference `swiffy-slider` (assert old library removed)

### Section 3: Browser E2E Tests

**`beforeAll`**:
1. Re-auth token
2. Find a content page that has a `contentRows` Block List property
3. Clean stale test carousel blocks from prior runs
4. Locate existing media items in the media library (re-use, do not upload)
5. Inject an `imageCarouselRow` block into `contentRows` with 3 images and `scrollSpeedMs: 3000`
6. Also inject a second `imageCarouselRow` block with a single image (edge case)
7. Publish the page and retrieve actual URL

**Tests** (serial):
1. Carousel container is visible (`.carousel.carousel-fade`)
2. Three `.carousel-item` elements are rendered
3. Three indicator buttons are rendered
4. First indicator has `aria-current="true"`
5. Clicking the second indicator causes the second `.carousel-item` to become active
6. Play/pause button is present and keyboard-focusable (`tabindex` not `-1`)
7. Single-image block: no indicator buttons, no prev/next buttons
8. First image has a non-empty `alt` attribute

**`afterAll`**: Restore original block list value and publish.

---

## Files to Create or Modify

| File | Change |
|------|--------|
| `scripts/setup-image-carousel-schema.mjs` | New one-time schema setup script (adds `scrollSpeedMs` only) |
| `src/UmbracoProject/Views/Partials/blocklist/Components/imageCarouselRow.cshtml` | Full rewrite: Bootstrap carousel with cross-fade |
| `src/UmbracoProject/wwwroot/assets/js/carousel.js` | New: focus-pause, play/pause toggle, reduced-motion JS |
| `src/UmbracoProject/Views/master.cshtml` | Add `<script>` tag for `carousel.js` |
| `tests/e2e/blocks/imageCarousel.spec.ts` | New E2E test file |
| `umbraco/Deploy/Revision/document-type__1c43fe2d*.uda` | Auto-updated by Umbraco Deploy |

## Reference Files

| File | Purpose |
|------|---------|
| `src/UmbracoProject/umbraco/Deploy/Revision/document-type__1c43fe2d4a9a4336923f9d0214950d48.uda` | Existing `imageCarouselRow` schema |
| `src/UmbracoProject/umbraco/Deploy/Revision/document-type__378fde9651b6450693e3ec3038e636bb.uda` | Existing `imageCarouselRowSettings` schema |
| `tests/e2e/blocks/alertBanner.spec.ts` | Pattern for Management API helpers, setup/teardown, serial tests |
| `src/UmbracoProject/Views/Partials/blocklist/Components/alertBanner.cshtml` | Pattern for block partial structure |
| `src/UmbracoProject/Views/master.cshtml` | Where to add the new `<script>` tag |
| `src/UmbracoProject/wwwroot/assets/js/scripts.js` | Existing JS (do not modify — theme file) |
