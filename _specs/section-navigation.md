# Spec for Section Navigation

branch: claude/feature/section-navigation

## Summary

Section navigation is a contextual navigation element that displays the current page, its sibling pages, and its direct child pages. CMS editors can toggle section navigation visibility per page. On wide screens it renders as a vertical list in a sidebar to the left of the content. On narrow screens it collapses into a disclosure element labeled "In this Section", positioned above the content, which users can expand to reveal the links.

## Functional Requirements

- CMS editors can enable or disable section navigation on individual pages via a boolean property in the backoffice
- The property defaults to off (hidden)
- The property is available on content pages where section navigation is relevant (e.g. general content pages, documentation pages)
- When enabled, section navigation displays the current page's sibling pages and direct child pages
- Pages marked as hidden from navigation (using existing visibility controls) are excluded from the section nav list
- The current page is visually distinguished as the active item
- Child pages of the current page are visually indented below the active item
- On wide screens (≥ 992px), the navigation renders as a persistent vertical list in a sidebar to the left of the page content
- On narrow screens (< 992px), the navigation is collapsed by default and positioned above the content
- On narrow screens, a toggle labeled "In this Section" reveals and hides the navigation list
- The toggle indicates its expanded/collapsed state visually (e.g. a chevron icon)
- When section navigation is disabled, the page layout is unchanged from its current single-column centered layout
- The section navigation is not cached at the page level (it is page-specific)

## Possible Edge Cases

- A page with no siblings and no children would show only itself — consider suppressing the nav entirely in this case even if the property is enabled
- A root-level page (direct child of Home) has no meaningful parent section — determine whether to show children only or suppress the nav
- All sibling and child pages are hidden from navigation — treat the same as having no visible items and suppress the nav
- Very long page names may wrap awkwardly in the narrow sidebar

## Acceptance Criteria

- [ ] A "Show Section Navigation" boolean property exists on the relevant document types in the backoffice
- [ ] When the property is false (default), the page renders with no section navigation and layout is unchanged
- [ ] When the property is true, section navigation appears with the current page's siblings and direct children
- [ ] Pages with navigation visibility set to hidden do not appear in the section nav
- [ ] The current page is highlighted as active in the nav list
- [ ] Child pages of the current page are displayed indented under the active item
- [ ] At wide viewport widths, the sidebar and main content render side by side
- [ ] At narrow viewport widths, the full nav list is hidden by default and a "In this Section" toggle is visible above the content
- [ ] Clicking the toggle reveals the nav list; clicking again collapses it
- [ ] The toggle reflects its current expanded/collapsed state
- [ ] When no visible nav items exist, no section nav element is rendered

## Open Questions

- Should the parent page be linked at the top of the section nav as a "back" link? - not necessary 
- Which document types beyond general content and documentation should receive this property? those types are sufficient
- Should the existing "hide from navigation" flag be reused for section nav exclusion, or should a separate flag be introduced? hide from navigation should apply to both
- Should the mobile toggle be expanded by default when the user is already on a page within that section? collapsed by default
- What are the preferred column proportions for the sidebar vs. content area at wide viewports? 1/4 (25%) width

## Testing Guidelines

Create a test file at `tests/e2e/sectionNavigation.spec.ts`.

- Section nav is absent when the property is disabled
- Section nav is present when the property is enabled
- The current page link is marked as active
- Sibling pages appear in the nav list
- A page marked as hidden from navigation does not appear in the list
- Child pages of the current page appear indented in the list
- At a wide viewport, sidebar and content are rendered side by side
- At a narrow viewport, the nav list is not visible and the "In this Section" toggle is present
- Clicking the toggle shows the nav list
- Clicking the toggle again hides the nav list
- The toggle reports the correct expanded/collapsed state
- When no visible items exist, the section nav element is not rendered
