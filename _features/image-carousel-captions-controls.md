# Feature: Image Carousel Captions and Refined Controls

CMS editors can add optional captions to individual slides in an Image Carousel Row and toggle whether captions are displayed for the whole carousel. Carousel controls (pagination, play/pause, prev/next) sit below the image area in a refined, accessible layout — with prev/next arrows adapting to viewport width so they never obscure the imagery on wide screens.

**Source spec**: `_specs/shipped/image-carousel-captions-controls.md`
**Plan**: `_plans/shipped/image-carousel-captions-controls.md`
**Design notes**: `_plans/notes/image-carousel-controls-design.md`
**Last verified**: 2026-04-13

---

## Behaviors

Scenarios are grouped by Rule — the business rule or acceptance criterion that the scenarios prove. Use concrete values (Specification by Example) and business language (Ubiquitous Language). See `.claude/skills/BDD.md` for guidance.

### Rule: Each carousel slide is an image with an optional caption

```scenario
Scenario: CMS editor adds three slides with captions to an Image Carousel Row
  Given the CMS editor is editing a page that contains an Image Carousel Row block
  When they add three Image Carousel Slide items, entering a caption of "Sunrise over the harbour" on the first, "Market day" on the second, and leaving the third slide's caption blank
  Then the page saves successfully
  And the stored carousel has three slides in the order the editor added them
```

```scenario
Scenario: CMS editor reorders slides
  Given an Image Carousel Row contains slides in order A, B, C
  When the editor drags slide C above slide A in the block list
  Then the stored carousel has slides in order C, A, B
```

### Rule: A single Show captions toggle governs caption visibility for the whole block

```scenario
Scenario: Show captions is off by default on a new carousel
  Given the CMS editor has just added a new Image Carousel Row block to a page
  When they view the block's settings
  Then the Show captions toggle is off
```

```scenario
Scenario: Editor turns captions on for a block with mixed slides
  Given an Image Carousel Row with two slides — one captioned "Autumn" and one without a caption
  And Show captions is currently off
  When the editor turns Show captions on and publishes the page
  Then a visitor viewing the page sees "Autumn" displayed below the first slide's image
  And sees no caption text beneath the second slide's image
```

### Rule: When Show captions is off, no caption text appears on the page

```scenario
Scenario: Captions stay hidden when toggle is off even if captions are authored
  Given an Image Carousel Row with Show captions set to off
  And one of its slides has the caption "Meet the team"
  When a visitor views the page
  Then the text "Meet the team" is not present anywhere within the carousel
```

### Rule: When Show captions is on, each caption renders below its image

```scenario
Scenario: Captions render directly below their corresponding image
  Given an Image Carousel Row with Show captions set to on
  And a slide with an image and the caption "Sunrise over the harbour"
  When a visitor views the page and that slide is active
  Then "Sunrise over the harbour" is visible directly beneath the slide's image
  And the caption is rendered as plain text (no markdown, no HTML formatting)
```

### Rule: Pagination and play/pause controls render below the image and caption area

```scenario
Scenario: Indicators and play/pause sit below the image-plus-caption block
  Given an Image Carousel Row with three slides and Show captions on
  When a visitor views the page on a desktop viewport
  Then the pagination indicators and play/pause toggle are positioned beneath the image and caption area
  And no control is overlaid on top of the image in the centre column
```

### Rule: Prev/next arrows adapt to viewport width

```scenario
Scenario: Arrows overlay the image with a solid background on a narrow viewport
  Given an Image Carousel Row with three slides
  When a visitor views the page at a viewport width of 600px
  Then the prev and next arrows are overlaid on the image
  And each arrow has a solid (non-transparent) background so it is readable against bright imagery
```

```scenario
Scenario: Arrows sit outside the image on a wide viewport
  Given an Image Carousel Row with three slides
  When a visitor views the page at a viewport width of 1200px
  Then the prev arrow is positioned to the left of the image and does not overlap it
  And the next arrow is positioned to the right of the image and does not overlap it
```

### Rule: The play/pause toggle is icon-only with an accessible label

```scenario
Scenario: Toggle shows only an icon and announces its state
  Given an Image Carousel Row with auto-play running
  When a visitor inspects the play/pause toggle with a screen reader
  Then the toggle displays only a pause icon (no visible text)
  And the toggle's accessible name is "Pause carousel"
```

```scenario
Scenario: Toggle's aria-label updates when the state changes
  Given an Image Carousel Row with auto-play running
  When the visitor activates the toggle
  Then the toggle displays a play icon
  And the toggle's accessible name becomes "Play carousel"
```

### Rule: Every interactive control meets a 44×44 px minimum target size

```scenario
Scenario: Pagination indicators, arrows, and play/pause each meet the 44×44 target
  Given an Image Carousel Row with three slides
  When the rendered page is measured at any supported viewport
  Then each pagination indicator has a clickable target of at least 44×44 CSS pixels
  And each prev/next arrow has a clickable target of at least 44×44 CSS pixels
  And the play/pause toggle has a clickable target of at least 44×44 CSS pixels
```

### Rule: Existing accessibility behaviours are preserved

```scenario
Scenario: Auto-play pauses when keyboard focus enters the carousel and resumes on blur
  Given an Image Carousel Row with auto-play running
  When the visitor tabs into a carousel control
  Then auto-play pauses
  When the visitor tabs away from all carousel controls
  Then auto-play resumes
```

```scenario
Scenario: Manual pause persists across focus changes
  Given an Image Carousel Row with auto-play running
  When the visitor activates the play/pause toggle to pause
  And then tabs out of the carousel
  Then auto-play remains paused
```

```scenario
Scenario: Reduced-motion preference disables auto-play
  Given a visitor's operating system has "reduce motion" enabled
  When they load a page with an Image Carousel Row
  Then the carousel does not auto-advance
  And the play/pause toggle is still present and operable
```

### Rule: Captions and alt text are independent

```scenario
Scenario: Alt text comes from the media item, caption comes from the slide
  Given a media library image named "team-photo.jpg" with alt text "The engineering team standing in front of the office"
  And a slide that uses that image with the caption "Meet the team"
  And Show captions is on
  When a visitor views the page
  Then the image's alt attribute reads "The engineering team standing in front of the office"
  And the visible caption reads "Meet the team"
```

### Rule: Visual refinement is compatible with the existing design system

```scenario
Scenario: Refined controls use zero-radius, palette-compatible styling
  Given the carousel control bar has been refined by the frontend-design skill
  When a designer reviews the controls against the site's design system
  Then no control uses rounded (non-zero) border-radius
  And any accent colour used falls within the signal red / warm bronze palette or a deliberately introduced additive token
  And the visual character remains constructivist (structured, typographic, deliberate)
```

---

## Edge Cases

### Rule: The carousel handles zero, one, and sparse-caption cases gracefully

```scenario
Scenario: Zero slides renders nothing
  Given an Image Carousel Row with no slides
  When a visitor views the page
  Then the carousel renders nothing (no empty container, no stray controls)
```

```scenario
Scenario: Single-slide carousel has no controls
  Given an Image Carousel Row with exactly one slide
  When a visitor views the page
  Then the slide's image is shown as a plain image
  And no prev/next arrows, pagination indicators, or play/pause toggle are rendered
```

```scenario
Scenario: Show captions on, but no slides have a caption
  Given an Image Carousel Row with three slides, none of which have captions
  And Show captions is on
  When a visitor views the page
  Then no caption area takes visible vertical space beneath the images
```

```scenario
Scenario: Very long caption wraps without breaking the layout
  Given a slide with a 250-character caption
  And Show captions is on
  When a visitor views the page and that slide is active
  Then the caption wraps across multiple lines below the image
  And the controls remain correctly positioned below the image-and-caption area
```

```scenario
Scenario: Arrow remains legible against bright imagery on a narrow viewport
  Given an Image Carousel Row whose active slide is a mostly-white image
  When a visitor views the page at a viewport width of 600px
  Then the overlaid prev and next arrows remain clearly visible against the image
```

---

## Test Coverage

All automated tests live in `tests/e2e/blocks/imageCarousel.spec.ts`. Manual entries indicate behaviours validated in Step 9 of `_plans/shipped/image-carousel-captions-controls.md`.

| Scenario | Test name (or note) | Status |
|----------|---------------------|--------|
| CMS editor adds three slides with captions | Browser E2E `beforeAll` authors a 3-slide block via the Management API; manual re-author of the About page in Step 9 | Covered |
| CMS editor reorders slides | Backoffice drag-reorder UI — verified in Step 9 manual sign-off | Manual |
| Show captions is off by default | `imageCarouselRow.showCaptions is a boolean defaulting to false` | Covered |
| Editor turns captions on for mixed slides | `captions ON: every authored caption renders inside a figcaption` + manual re-author in Step 9 | Covered |
| Captions stay hidden when toggle is off | `captions OFF: none of the authored caption strings appear anywhere on the page` + `captions OFF: the captions-off carousel renders zero figcaption elements` | Covered |
| Captions render directly below their image | `captions ON: active slide caption is visible` + `captions ON: every authored caption renders inside a figcaption` | Covered |
| Indicators and play/pause sit below image+caption | `controls container exists and is positioned below the slide image area` + `partial places the controls container after the carousel-inner element` | Covered |
| Arrows overlay on narrow viewport | `narrow viewport (600px): prev/next arrows overlay the image with a solid background` | Covered |
| Arrows sit outside image on wide viewport | `wide viewport (1200px): prev/next arrows sit outside the image (no overlap)` | Covered |
| Toggle shows only an icon with aria-label | `play/pause button has no visible text content (icon-only)` + `partial play/pause button is icon-only (no visible label span)` | Covered |
| Toggle's aria-label updates with state | `play/pause button toggles aria-label when clicked` | Covered |
| Each control meets 44×44 target | `all clickable controls meet the 44×44 CSS-px minimum target size` | Covered |
| Auto-play pauses on focus | `focus into a carousel control pauses auto-play` | Covered |
| Auto-play resumes on focus blur (when not manually paused) | Behaviour exercised by `manual pause persists when keyboard focus leaves the carousel` (asserts the *negative* — cycle stays off when manually paused) — explicit positive resume case not isolated | Partial |
| Manual pause persists across focus changes | `manual pause persists when keyboard focus leaves the carousel` + `manual pause persists after mouse leaves carousel` | Covered |
| Reduced-motion disables auto-play | `prefers-reduced-motion: carousel does not auto-advance` | Covered |
| Alt text and caption are independent | `captions ON: alt text and caption are independent (alt from media item, caption from slide)` | Covered |
| Refined controls are design-system compatible | `all clickable controls have zero border-radius (constructivist sharp corners)` + `captions (when shown) are left-aligned`; design rationale recorded in `_plans/notes/image-carousel-controls-design.md` | Covered |
| Zero slides renders nothing | Razor partial returns early when `slideItems.Count == 0`; no E2E exercising the empty path | Code-covered |
| Single-slide carousel has no controls | `single-slide block renders a plain img with no carousel controls` + `single-slide block has no indicator buttons` | Covered |
| Show captions on, no captions authored (no extra vertical space) | `captions ON: the second slide (no caption authored) has no figcaption` (proves the no-figcaption branch; layout consequence follows from CSS) | Covered |
| Very long caption wraps gracefully | Not directly tested — `figcaption` uses normal block flow with the supporting-content type scale, so wrapping is the browser default | Not covered |
| Arrow legible against bright imagery | `narrow viewport (600px): prev/next arrows overlay the image with a solid background` asserts `background-color` alpha ≥ 0.95 (bronze, opaque) | Covered |
| Play/pause toggle announces correct state via screen reader | VoiceOver sign-off in Step 9 (`_plans/notes/image-carousel-controls-design.md` § Verified) | Manual |

**Summary:** 19 covered by automated assertions, 2 manually verified, 1 code-covered (empty-slide early return), 1 partial (focus-out resume positive case), 1 not covered (very-long-caption wrap). Total automated assertions across the spec file: 50 / 50 GREEN.

---

## Revision Notes

- 2026-04-13: Added per-slide captions, Show captions toggle, refined control bar with responsive prev/next at the lg breakpoint, icon-only play/pause toggle, 44×44 target sizes, signal-red active indicators on warm-stone inactive bars, and inline-SVG chevrons replacing Bootstrap's PNG arrow sprite. Verified end-to-end against the live About page demo.
- 2026-04-13: Draft scenarios from initial spec
