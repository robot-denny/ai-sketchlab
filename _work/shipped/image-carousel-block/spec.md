# Spec for image-carousel-block

branch: claude/feature/image-carousel-block
figma_component (if used): N/A

## Summary

A Block List component that renders a full-width image carousel. CMS editors can select multiple images from the Umbraco media library and configure a scroll speed. Images transition via cross-fade. Pagination dots serve as both navigation controls and active-state indicators. The carousel pauses on mouse hover and keyboard focus, and is fully accessible.

## Functional Requirements

- CMS editor can add multiple images from the Umbraco media library using a media picker property
- Images render full width within the block's layout column
- CMS editor can set the auto-scroll speed (e.g. slow / medium / fast, or a numeric interval in seconds)
- Images transition between slides using a cross-fade animation (no slide/pan motion)
- Pagination dots are rendered below the carousel, one dot per image
- The active dot visually indicates which image is currently displayed
- Clicking or activating a pagination dot navigates directly to that image
- Auto-scroll pauses when the user hovers over the carousel with a mouse
- Auto-scroll pauses when any focusable element inside the carousel receives keyboard focus
- Auto-scroll resumes when hover or focus leaves the carousel
- A play/pause toggle button is provided for users who cannot hover or use a mouse (accessibility)
- The carousel respects `prefers-reduced-motion`: when enabled, auto-scroll is disabled and transitions are instant

## Figma Design Reference (only if referenced)

N/A

## Possible Edge Cases

- Only one image selected: pagination dots and auto-scroll should not appear; the single image renders statically
- No images selected: the block renders nothing (empty state, no broken markup)
- Images with different aspect ratios: the carousel container maintains a consistent height; images are cropped/fitted without layout shift
- Very long image lists (10+): pagination dots should remain usable and not overflow the container
- User navigates away mid-transition: no JS errors or lingering timers
- Scroll speed set to 0 or blank: fall back to a sensible default
- Touch/swipe gestures on mobile: the carousel should be swipeable as an enhancement (not required for MVP)

## Acceptance Criteria

- [ ] Block appears in the Block List editor picker under an appropriate group
- [ ] Media picker allows selecting one or more images from the Umbraco media library
- [ ] Scroll speed control is visible and functional in the CMS block editor
- [ ] Images render full width of the block on the front end
- [ ] Cross-fade transition plays between images during auto-scroll
- [ ] Pagination dots are visible and reflect the correct active slide
- [ ] Clicking a pagination dot navigates to the corresponding image
- [ ] Carousel pauses on `mouseenter` and resumes on `mouseleave`
- [ ] Carousel pauses when a child element receives `focus` and resumes on `blur`
- [ ] Play/pause toggle button is visible and keyboard accessible, with a visible text label ("Pause carousel" / "Play carousel") and matching icon that both update on click
- [ ] With `prefers-reduced-motion: reduce`, auto-scroll is disabled and transitions are instant
- [ ] Single-image scenario shows no pagination dots and no auto-scroll
- [ ] Zero-image scenario renders no output
- [ ] All interactive elements have visible focus indicators
- [ ] Pagination dots have descriptive `aria-label` attributes (e.g. "Go to slide 2 of 5")
- [ ] The carousel region has an appropriate ARIA role and label

## Open Questions

- Should the scroll speed control be a dropdown (e.g. Slow / Medium / Fast) or a numeric input (seconds)? --numeric input milliseconds
- Should the carousel loop infinitely or stop at the last image? - loop
- Is a caption or alt-text override needed, or should it inherit the alt text from the media item? alt-text override 
- Should touch/swipe support be included in the initial release? --yes
- Is there a maximum number of images that should be enforced in the picker? not in this iteration

## Testing Guidelines

Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:

- Block can be created with valid images and a scroll speed value via the Management API
- Block renders correctly on the front end (carousel container and images present)
- Pagination dots are present and match the number of images
- Clicking a pagination dot updates the active slide (browser assertion)
- Carousel pauses on hover and resumes on mouse leave (browser assertion)
- Single-image scenario: no dots, no auto-scroll
- Zero-image scenario: no carousel markup rendered
- `prefers-reduced-motion` scenario: no auto-scroll behaviour active
