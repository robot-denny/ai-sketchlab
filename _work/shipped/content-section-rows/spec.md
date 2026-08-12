# Spec for Content Section Rows

branch: claude/feature/content-section-rows

## Summary

Content editors can add styled section rows below the main content area on content pages. Each section row wraps existing block list content (Content Rows) with optional background color treatment and a choice between full-bleed (edge-to-edge) or container-width background. The content inside the row is always constrained to the site's container max-width regardless of the background setting.

## Functional Requirements

- Content editors can add one or more section rows below the main content area on supported page types
- Each section row has a **background color** option with three choices:
  - None (transparent / default page background)
  - Light (subtle light tone from the site's color palette)
  - Accent (branded accent color from the site's color palette)
- Each section row has a **background width** option:
  - Container — background fills only the content container width
  - Full bleed — background extends edge-to-edge across the full browser viewport
- The content inside a section row (e.g. blocks such as image carousel, rich text) is always constrained to the container max-width, regardless of the background width setting
- Content editors can add any existing block list components into a section row
- Section rows are ordered and can be reordered in the backoffice

## Possible Edge Cases

- A section row with background color "None" and full bleed should be visually identical to no background — no extra spacing or visual artifact
- Adjacent section rows with the same background color should not visually merge unless that is the intended design
- When no section rows are added, the page layout should be unchanged
- Section rows on pages that have the section navigation sidebar enabled should still respect the two-column layout within the content area
- Empty section rows (no blocks added) should not render any visible output

## Acceptance Criteria

- A content editor can add a section row to a supported page in the backoffice
- The section row editor exposes background color (none / light / accent) and background width (container / full bleed) settings
- Selecting "full bleed" causes the background to extend to the full viewport width in the browser
- Selecting "container" causes the background to only fill the container width
- In all cases, the content inside the section row does not exceed the container max-width
- All three background color options render distinctly different visual results
- Section rows render below the main content area, not within it
- Pages with no section rows are visually unaffected

## Open Questions

- Should section rows be available on all page types (content, documentation, article) or a subset? all
- Should the "light" and "accent" color values come from CSS custom properties already defined in the site's stylesheet, or will new values need to be defined? existing
- Should padding above/below the section row content be fixed or configurable by the editor configurable
- Is there a maximum number of section rows per page? no
- Should section rows support a title/heading field, or is content-only sufficient for now? support an optional title/heading field, with the ability to select what HTML Heading level is desired (h2 by default)

## Testing Guidelines

Create a test file at `tests/e2e/contentSectionRows.spec.ts` and cover the following cases without going too heavy:

- Section row element type exists with the correct property aliases (background color, background width, content block list)
- A page with no section rows renders without any section row container element
- A page with a section row renders the row below the main content area
- Full bleed background extends beyond the container (assert the rendered element's width is greater than the container width)
- Container background does not extend beyond the container
- All three background color options apply visually distinct CSS classes or inline styles to the row element
- Empty section row (no blocks) does not render visible output
