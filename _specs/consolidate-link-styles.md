# Spec for Consolidate Link Styles

branch: claude/feature/consolidate-link-styles

## Summary

Consolidate the site's link styles into a consistent default pattern. Default links should be bold, underlined, and use a new purple accent color (`#8859b6`), turning black on hover. Header and footer link styles remain unchanged. Blog card title links adopt the new default style. The inline `btn btn-link` style (e.g., "create an account" on the login page) should also match the default link style. A new CSS custom property should be introduced so the color can be reused consistently.

## Functional Requirements

- Add a CSS custom property (following the existing `--bs-` naming convention) for the link color `#8859b6` so it can be referenced site-wide
- Update the global `a` styles to: bold weight, underlined (`text-decoration: underline`), color `#8859b6`
- Update the global `a:hover` style to: color `#000` (black)
- Preserve all existing header navigation link styles exactly as they are (scoped styles should remain untouched)
- Preserve all existing footer navigation link styles exactly as they are (scoped styles should remain untouched)
- Update `.article-grid-card .card-title a` and any other blog card title link styles to match the new default link style (bold, underlined, `#8859b6`, black on hover)
- Update the Bootstrap `.btn-link` style override so that inline link-buttons (like "create an account" on the login page at `/member-registration/`) visually match the new default link style
- Do not change any font sizes — all existing font sizes must remain as-is

## Possible Edge Cases

- Header and footer links may inherit the new global styles unless their scoped rules are specific enough; verify they remain visually unchanged
- Other elements using `btn btn-link` across the site should also pick up the new style — audit for unintended visual changes
- Blog list preview links (`.post-preview > a`) may also need updating to match the new default
- Links inside rich text blocks or CMS-rendered content areas may inherit the global style — confirm this is desirable or scope appropriately

## Acceptance Criteria

- A CSS custom property exists for `#8859b6` and is used in all relevant link style declarations
- Default links across the site are bold, underlined, and colored `#8859b6`
- Default links turn black (`#000`) on hover
- Header navigation links are visually unchanged
- Footer navigation links are visually unchanged
- Blog article card title links use the new default link style
- The "create an account" inline button on the login page visually matches a default link (bold, underlined, `#8859b6`, black on hover)
- No font sizes have been changed anywhere

## Open Questions

- Should the CSS variable follow Bootstrap convention (e.g., `--bs-link-color`) or use a project-specific prefix?
- Should rich text content links (rendered from CMS block content) also adopt this style, or should they be scoped differently?
- Are there other `btn btn-link` instances beyond the login page that should be audited?

## Testing Guidelines

Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- Default link on a content page renders with the correct color, bold weight, and underline
- Default link hover state changes to black
- Header navigation links remain visually unchanged (no underline, retain existing colors)
- Footer navigation links remain visually unchanged (retain existing scoped styles)
- Blog article card title link uses the new link color and is bold with underline
- The "create an account" button on the login page visually matches the default link style
