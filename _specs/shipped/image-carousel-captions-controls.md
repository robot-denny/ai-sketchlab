# Spec for Image Carousel Captions and Refined Controls

> This spec captures initial requirements and design rationale for this iteration. For **current system behavior**, see `_features/image-carousel-captions-controls.md`.
>
> Historical records of the initial Bootstrap carousel build remain in `_specs/shipped/image-carousel-block.md` and `_plans/shipped/image-carousel-block.md`.

branch: claude/feature/image-carousel-captions-controls
figma_component (if used): n/a

## Summary

Iterate on the existing **Image Carousel Row** block with four user-facing enhancements:

1. **Optional captions per slide**, toggled on/off for the whole carousel by the CMS editor.
2. **Controls moved below** the image area so they no longer compete with the imagery for attention.
3. **Icon-only play/pause toggle**, removing the visible "Play carousel" / "Pause carousel" text in favour of an icon with an accessible label.
4. **Refined control UI** that feels more intentional and polished, using a responsive layout strategy for the prev/next arrows: overlaid on the image with a solid background on narrow viewports, and positioned beside the image on wider viewports to avoid overlap.

This is a content-authoring improvement (editors can give each image meaningful context) and a visual/usability improvement (the interface reads as deliberate rather than stock-Bootstrap), while preserving all existing accessibility behaviour from the previous iteration (focus/hover pause, reduced-motion support, keyboard operability, descriptive indicators).

## Functional Requirements

### Content model

- A new element type, **Image Carousel Slide** (`imageCarouselSlide`), contains:
  - `image` — single-media picker (required)
  - `caption` — plain text, single-line textstring (optional)
- The existing **Image Carousel Row** (`imageCarouselRow`) element type:
  - **Replaces** its `images` (multi-media picker) property with a new `slides` property, typed as a **block list** restricted to `imageCarouselSlide`.
  - **Adds** `showCaptions` (boolean, default `false`), ordered alongside `scrollSpeedMs`.
  - Retains existing properties: `author`, `scrollSpeedMs`.
- The `imageCarouselRowSettings` element type is unchanged.
- Because the only published instance of this block is on one demo page, the migration strategy is **replace in place**: drop `images`, add `slides`. The editor will re-add the slide content manually after deployment.

### CMS editor experience

- In the backoffice, editors see the **Image Carousel Row** block with:
  - A "Slides" block list where each item is an Image Carousel Slide (pick an image, optionally enter a caption).
  - A "Show captions" toggle (off by default).
  - The existing "Scroll speed" numeric input.
- The editor can reorder slides within the block list.

### Front-end rendering

- When `showCaptions` is **off**, no caption text appears regardless of whether slides have captions entered.
- When `showCaptions` is **on**:
  - Each slide's caption (if any) is rendered below its image.
  - Slides without a caption still render — no broken layout, no empty caption container taking vertical space where possible.
- **Alt text** continues to come from the media library item (not from the new caption field). Captions and alt text are independent: captions are visible editorial prose; alt text is for assistive technology.
- **Control layout**:
  - Pagination indicators and the play/pause toggle appear **below** the image-and-caption area, as a unified control bar.
  - Prev/next arrow controls are **responsive**:
    - **< lg (viewport width < 992px)**: overlaid on the image with a solid (non-transparent) background for contrast against arbitrary imagery.
    - **≥ lg (≥ 992px)**: positioned outside the image on the left and right, not overlapping the image.
  - On a single-image carousel (only one slide), no controls are rendered (existing behaviour preserved).
- **Play/pause toggle**:
  - Icon only; no visible "Play carousel" / "Pause carousel" text.
  - Accessible name is provided via `aria-label` (switches between "Play carousel" and "Pause carousel" to reflect current state).
  - Minimum target size of 44×44 CSS px (WCAG 2.5.8).

### Accessibility (preserved + enhanced)

- Keyboard: all controls reachable via Tab, activatable via Enter/Space.
- Focus visible on all controls.
- Play/pause button carries an `aria-label` that updates with state.
- Pagination indicators retain descriptive labels ("Go to slide X of Y") and `aria-current` on the active one.
- Auto-play pauses on hover **and** on keyboard focus; resumes on leave/blur unless manually paused.
- `prefers-reduced-motion: reduce` disables auto-scroll.
- Prev/next arrows (when overlaid) maintain adequate contrast via a solid background against any image behind them.
- Captions, when displayed, are plain readable text below the image — not overlaid, so they do not introduce contrast issues over arbitrary imagery.

### Visual design (refinement)

- The control UI is refined using the `frontend-design` skill. The refinement may explore beyond the current design system but must remain **compatible** with it:
  - Zero-radius (no pill/rounded controls).
  - Usable alongside the existing signal red / warm bronze palette.
  - Constructivist feel — deliberate, structured, typographic.
- Any new visual tokens introduced (spacing, weights, hover states) should be additive — they should not override existing design tokens for other components.

## Figma Design Reference (only if referenced)

Not used for this iteration. Design exploration will be produced by the `frontend-design` skill and reviewed before implementation.

## Possible Edge Cases

- **Zero slides**: block renders nothing (existing behaviour preserved).
- **One slide**: renders as a plain `<img>` with no controls, no caption (unless `showCaptions` is on, in which case the caption is still shown beneath it).
- **`showCaptions` on but some slides have no caption**: those slides render with no caption text; layout does not break and does not leave a noticeable empty slot.
- **`showCaptions` on but no slides have captions**: carousel behaves visually as if captions were off (no caption area).
- **Very long caption**: wraps to multiple lines beneath the image; does not break the control layout below.
- **Narrow viewport + overlaid arrow**: solid background keeps arrow readable against bright/light imagery.
- **Reduced motion**: auto-play stays off; user can still advance manually; play/pause button remains present and accessible.
- **Keyboard focus inside carousel**: auto-play pauses; tabbing out resumes (unless manually paused via the toggle).

## Acceptance Criteria

1. A CMS editor can add multiple **Image Carousel Slides** to an Image Carousel Row block; each slide has an image and an optional caption.
2. A CMS editor can toggle `showCaptions` on the Image Carousel Row block, and that single toggle governs caption visibility for all slides in that block.
3. When `showCaptions` is off, no caption text is rendered on the front-end for any slide, even if captions are entered.
4. When `showCaptions` is on, each slide's caption (if present) renders as visible text positioned below its image.
5. Pagination indicators and the play/pause toggle render below the image-and-caption area, not overlaid on the image.
6. On viewports narrower than 992px (lg), prev/next arrows are overlaid on the image with a solid background to ensure contrast. On viewports 992px and wider, prev/next arrows are positioned outside the image (left and right) and do not overlap the image.
7. The play/pause toggle displays only an icon (no visible text) and carries an `aria-label` that reflects its current state ("Play carousel" / "Pause carousel").
8. Every interactive control in the carousel meets a minimum target size of 44×44 CSS pixels.
9. All accessibility behaviours from the previous iteration are preserved: keyboard reachability, focus-visible, focus/hover pause-and-resume with manual-pause override, descriptive indicator labels with `aria-current`, and `prefers-reduced-motion` honouring.
10. Captions and alt text are independent: alt text continues to come from the media library item; captions come from the new slide-level field.
11. The visual refinement produced by the `frontend-design` skill is compatible with the existing design system (zero-radius, signal red / warm bronze, constructivist character).

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples. These will be verified and refined after implementation. See `_features/image-carousel-captions-controls.md` for the verified version.

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

## Open Questions

- **Caption typography**: which existing type scale token (body, caption, small) should captions use? Propose the smallest body-adjacent token unless the design exploration suggests otherwise.--caption, unless the design exploration suggests otherwise
- **Caption alignment**: left-aligned under the image, or centred? Default proposal: left-aligned, matching body text conventions.--left aligned
- **Arrow background on narrow viewports**: solid neutral (e.g., warm bronze at full opacity) vs. solid signal red — which reads as "action" without competing with the image? Resolve during the design exploration.
- **Pagination indicator style**: dots, numbered pills, or bars? Current implementation uses numbered buttons — keep, or reconsider as part of the refinement? --Reconsider as part of refinement.
- **Wide-viewport arrow reservation**: when arrows move outside the image at ≥ lg, do they reduce the image's effective width, or do we reserve column space in the grid so the image width stays constant regardless of viewport? Propose: reserve space in the grid at ≥ lg so the image doesn't visibly reflow at the breakpoint. --reserve space in grid at ≥ lg
- **Focus order**: with controls now below the image, what is the intended tab order — slide content (if any focusable) → prev → indicators → next → play/pause, or prev/next → indicators → play/pause? --slide content (if any focusable) → prev → indicators → next → play/pause

## Testing Guidelines

Create or update test files under `./tests/e2e/` for the new behaviours, without going too heavy:

- **Schema test**: verify the `imageCarouselSlide` element type exists with `image` and `caption` properties; verify `imageCarouselRow` has `slides` (block list), `showCaptions` (boolean), and `scrollSpeedMs`, and no longer has `images`.
- **Editor test (optional, if feasible in API-driven test)**: create a page with an Image Carousel Row containing slides, with and without captions, and with `showCaptions` on and off, then verify front-end rendering below.
- **Front-end tests** at viewport widths 600px and 1200px:
  - Captions hidden when `showCaptions` off; visible and correctly placed when on.
  - Single-image carousel renders no controls.
  - Controls render below the image+caption area.
  - Arrows overlay on narrow; sit outside on wide.
  - Play/pause toggle: icon-only, `aria-label` reflects state, target ≥ 44×44.
  - Focus pause/resume + manual-pause override.
  - `prefers-reduced-motion` disables auto-play (emulate via Playwright).
- Use regex for any CSS-content assertions (whitespace-tolerant) per the repo's E2E resilience rules.
- Use dynamic entity lookups (no hardcoded UUIDs or slugs) per the repo's E2E resilience rules.
