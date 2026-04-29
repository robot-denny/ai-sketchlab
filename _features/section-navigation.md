# Feature: Section Navigation

Section navigation is a contextual sidebar that helps visitors orient themselves within a section of the site. CMS editors can enable it per page, and when active it shows the current page's siblings and child pages, highlighting the current page. On smaller screens the sidebar collapses into an expandable "In this Section" toggle so the navigation is accessible without consuming screen space.

**Source spec**: `_specs/shipped/section-navigation.md`
**Last verified**: 2026-04-09

---

## Behaviors

### Rule: CMS editors control section navigation visibility per page

```scenario
Scenario: Section navigation is off by default
  Given a CMS editor creates a new Content page
  And does not enable "Show Section Navigation"
  When a visitor views that page
  Then no section navigation appears
  And the page content uses the standard centered single-column layout
```

```scenario
Scenario: CMS editor enables section navigation
  Given a CMS editor enables "Show Section Navigation" on a Content page that has 2 visible siblings
  When a visitor views that page
  Then a section navigation sidebar appears beside the page content
```

```scenario
Scenario: The toggle property is available on Content and Documentation pages
  Given the "Section Navigation Controls" composition exists in the CMS
  Then it is included on the "Content" page type
  And it is included on the "Documentation" page type
```

### Rule: Section navigation shows sibling pages and child pages of the current page

```scenario
Scenario: Siblings appear in the navigation list
  Given a page "Section Child A" with 1 visible sibling "Section Child B" under the same parent
  And "Show Section Navigation" is enabled on "Section Child A"
  When a visitor views "Section Child A"
  Then "Section Child B" appears in the section navigation list
```

```scenario
Scenario: Child pages appear indented under the current page
  Given "Section Child A" has a child page "SN Grandchild"
  And "Show Section Navigation" is enabled on "Section Child A"
  When a visitor views "Section Child A"
  Then "SN Grandchild" appears in the navigation list indented under the current page
```

### Rule: The current page is visually highlighted as the active item

```scenario
Scenario: Current page link is marked as active
  Given a visitor views "Section Child A" with section navigation enabled
  Then the "Section Child A" link has the active style
  And it displays a teal left border and bold text
```

### Rule: Pages hidden from navigation are excluded

```scenario
Scenario: Hidden page does not appear in section navigation
  Given "SN Hidden" is a sibling of "Section Child A" and is marked as hidden from navigation
  When a visitor views "Section Child A"
  Then "SN Hidden" does not appear in the section navigation list
```

### Rule: Section navigation is suppressed when there are no meaningful items to show

```scenario
Scenario: Only the current page is visible (no siblings, no children)
  Given "SN Lone Child" is the only visible page under its parent
  And it has no child pages
  And "Show Section Navigation" is enabled
  When a visitor views "SN Lone Child"
  Then no section navigation appears
```

### Rule: On wide screens the sidebar renders beside the content

```scenario
Scenario: Desktop layout at 1200px wide
  Given a visitor uses a browser window 1200px wide
  When viewing a page with section navigation enabled
  Then the section navigation sidebar is visible to the left of the content
  And the sidebar occupies roughly 25% of the width
  And the content area occupies the remaining 75%
```

### Rule: On narrow screens the navigation collapses behind a toggle

```scenario
Scenario: Mobile layout hides the sidebar and shows a toggle
  Given a visitor uses a phone-sized browser window 375px wide
  When viewing a page with section navigation enabled
  Then the desktop sidebar is hidden
  And a button labeled "In this Section" is visible above the content
  And the navigation list is hidden by default
```

```scenario
Scenario: Tapping the toggle reveals the navigation list
  Given a visitor on a 375px-wide screen views a page with section navigation
  And the "In this Section" toggle shows aria-expanded "false"
  When the visitor taps the toggle
  Then the navigation list becomes visible
  And the toggle shows aria-expanded "true"
  And the chevron icon rotates to point upward
```

```scenario
Scenario: Tapping the toggle again hides the navigation list
  Given the navigation list is expanded on a 375px-wide screen
  When the visitor taps the toggle again
  Then the navigation list is hidden
  And the toggle shows aria-expanded "false"
  And the chevron icon rotates back to point downward
```

### Rule: Section navigation is not cached (it is page-specific)

```scenario
Scenario: View templates use uncached rendering for the section navigation partial
  Given the Content and Documentation view templates render the section navigation partial
  Then they use PartialAsync (not CachedPartialAsync)
  So the navigation reflects each page's unique position in the content tree
```

---

## Edge Cases

### Rule: Structural correctness of the partial view

```scenario
Scenario: The partial view contains all required structural elements
  Given the section navigation partial exists at Views/Partials/sectionNavigation.cshtml
  Then it contains a desktop container and a mobile container
  And it has a collapse toggle with Bootstrap data attributes targeting "sectionNavList"
  And it filters pages using the visibility check
  And it applies the active class to the current page
  And it renders child pages in a nested indented list
  And it includes an early return to suppress rendering when no items are relevant
```

### Rule: CSS supports the full section navigation design

```scenario
Scenario: Base styles, active states, children styles, toggle, and responsive breakpoints all exist
  Given the site stylesheet at wwwroot/assets/css/styles.css
  Then it contains base styles for ".section-nav" and ".section-nav ul"
  And it contains nav-link and active nav-link styles
  And it contains ".section-nav-children" styles for indented child links
  And it contains ".section-nav-toggle" styles and chevron rotation rules
  And it contains media queries at 992px to show/hide ".section-nav-desktop" and ".section-nav-mobile"
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Section navigation is off by default | `tests/e2e/sectionNavigation.spec.ts` — "no section nav when showSectionNavigation is false" | Covered |
| CMS editor enables section navigation | `tests/e2e/sectionNavigation.spec.ts` — "section nav visible when showSectionNavigation is true" | Covered |
| Toggle property available on Content pages | `tests/e2e/sectionNavigation.spec.ts` — "content document type includes sectionNavigationControls composition" | Covered |
| Toggle property available on Documentation pages | `tests/e2e/sectionNavigation.spec.ts` — "documentation document type includes sectionNavigationControls composition" | Covered |
| Composition document type exists | `tests/e2e/sectionNavigation.spec.ts` — "sectionNavigationControls composition document type exists" | Covered |
| Composition has boolean property | `tests/e2e/sectionNavigation.spec.ts` — "composition has showSectionNavigation boolean property" | Covered |
| Siblings appear in the navigation list | `tests/e2e/sectionNavigation.spec.ts` — "sibling page appears in section nav list" | Covered |
| Child pages appear indented | `tests/e2e/sectionNavigation.spec.ts` — "grandchild appears indented in section-nav-children" | Covered |
| Current page link is marked as active | `tests/e2e/sectionNavigation.spec.ts` — "current page link has active class" | Covered |
| Hidden page excluded from navigation | `tests/e2e/sectionNavigation.spec.ts` — "hidden page does not appear in section nav" | Covered |
| Suppressed when only current page visible | `tests/e2e/sectionNavigation.spec.ts` — "no section nav when only visible item is current page" | Covered |
| Desktop layout sidebar visible | `tests/e2e/sectionNavigation.spec.ts` — "desktop: sidebar column visible alongside content" | Covered |
| Mobile layout hides sidebar, shows toggle | `tests/e2e/sectionNavigation.spec.ts` — "mobile: desktop nav hidden, toggle button visible" | Covered |
| Tapping toggle reveals navigation list | `tests/e2e/sectionNavigation.spec.ts` — "mobile: click toggle shows nav list" | Covered |
| Tapping toggle again hides navigation list | `tests/e2e/sectionNavigation.spec.ts` — "mobile: click toggle again hides nav list" | Covered |
| Toggle aria-expanded reflects state | `tests/e2e/sectionNavigation.spec.ts` — "mobile: toggle aria-expanded reflects correct state" | Covered |
| Uncached partial rendering | `tests/e2e/sectionNavigation.spec.ts` — "*.cshtml uses PartialAsync (not CachedPartialAsync) for section nav" | Covered |
| Partial view structural elements | `tests/e2e/sectionNavigation.spec.ts` — "partial contains required structural elements" | Covered |
| View reads showSectionNavigation property | `tests/e2e/sectionNavigation.spec.ts` — "*.cshtml reads showSectionNavigation property" | Covered |
| View renders sectionNavigation partial | `tests/e2e/sectionNavigation.spec.ts` — "*.cshtml renders sectionNavigation partial" | Covered |
| CSS base and responsive styles | `tests/e2e/sectionNavigation.spec.ts` — CSS step 4 tests (5 tests) | Covered |

---

## Revision Notes

- 2026-04-09: Initial feature doc from spec + implementation
