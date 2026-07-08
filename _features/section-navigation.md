# Feature: Section Navigation

Section navigation is a contextual sidebar that helps visitors orient themselves within a section of the site. CMS editors can enable it per page, and when active it shows the current page's siblings and child pages, highlighting the current page. On smaller screens the sidebar collapses into an expandable "In this Section" toggle so the navigation is accessible without consuming screen space.

**Source spec**: `_specs/shipped/section-navigation.md`
**Last verified**: 2026-04-09

---

## Increments

- [x] 2026-04-09 — Section Navigation Controls composition, contextual sidebar with desktop/mobile responsive collapse, current-page highlight (spec: `_specs/shipped/section-navigation.md`)
- [x] 2026-07-07 — `hideFromSectionNavigation` toggle on the Visibility Controls composition: a page can be removed from the section-nav sidebar independently of "Hide From Search" (default unticked, existing content unaffected) (spec: `_specs/shipped/section-nav-hide-toggle.md`)
- [x] 2026-07-08 — mirrored the `hideFromSectionNavigation` toggle onto the **Guide Visibility Controls** composition so Guides / How-To Guide page types carry it too (parity — the 2026-07-07 increment only added it to the standard Visibility Controls). Note: guide page types do not currently render section navigation themselves, so the toggle is effective only where a guide node appears in a section-nav-rendering page's list — see ROADMAP `guide-visibility-composition-consolidation`

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

### Rule: Pages can be hidden from section navigation independently of search

A page carries a "Hide From Section Navigation" toggle (alias `hideFromSectionNavigation`) on the Visibility Controls composition, alongside the existing "Hide From Search" toggle (`umbracoNaviHide`). The two are independent: a page shows in the section-nav sidebar only if it is visible to search AND its "Hide From Section Navigation" toggle is unticked. Ticking one has no effect on the other. The toggle applies to both sibling and child entries. The current page is never removed from its own list — it always renders as the active item. Default is unticked, so pre-existing content is unaffected.

The toggle exists on **both** visibility compositions — the standard `Visibility Controls` (composed by Content, Documentation, Article, etc.) and `Guide Visibility Controls` (composed by Guides and How-To Guide pages) — so every page type carries it in the backoffice. One caveat on effect: guide page types do not themselves render the section-nav sidebar (only `content.cshtml` / `documentation.cshtml` render it, via the Section Navigation Controls composition), so on a guide page the toggle takes effect only where that guide node appears as a sibling/child within a section-nav-rendering page's list. The two compositions are hand-maintained twins; keeping the toggle set in parity is tracked as ROADMAP `guide-visibility-composition-consolidation`.

```scenario
Scenario: A sibling with "Hide From Section Navigation" ticked is excluded
  Given "SN SecNav Hidden" is a sibling of "Section Child A" with "Hide From Section Navigation" ticked
  And "Section Child B" is a sibling with the toggle unticked
  And "Show Section Navigation" is enabled on "Section Child A"
  When a visitor views "Section Child A"
  Then "SN SecNav Hidden" does not appear in the section navigation list
  And "Section Child B" still appears in the list
```

```scenario
Scenario: A child with "Hide From Section Navigation" ticked is excluded from the indented list
  Given "Section Child A" has a child "SN Grandchild" with the toggle unticked
  And "Section Child A" has a child "SN SecNav Hidden Child" with "Hide From Section Navigation" ticked
  And "Show Section Navigation" is enabled on "Section Child A"
  When a visitor views "Section Child A"
  Then "SN Grandchild" appears in the indented child list
  And "SN SecNav Hidden Child" does not appear in the indented child list
```

```scenario
Scenario: The section-nav toggle and the search-visibility toggle act independently
  Given "SN SecNav Hidden" has "Hide From Section Navigation" ticked but "Hide From Search" unticked
  And "SN Hidden" has "Hide From Search" ticked but "Hide From Section Navigation" unticked
  And "Section Child B" has neither toggle ticked
  When a visitor views "Section Child A"
  Then "SN SecNav Hidden" is excluded from section navigation (by the section-nav toggle alone)
  And "SN Hidden" is excluded from section navigation (by the search-visibility toggle alone)
  And "Section Child B" appears in the section navigation list
```

```scenario
Scenario: Suppression fires when the toggle removes the last meaningful item
  Given "SN SecNav Visible Child" is a page under "SN SecNav Lone Parent" with "Show Section Navigation" enabled
  And its only sibling "SN SecNav Hidden Suppression Sibling" has "Hide From Section Navigation" ticked
  And "SN SecNav Visible Child" has no child pages
  When a visitor views "SN SecNav Visible Child"
  Then no section navigation appears
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
| Visibility Controls has hideFromSectionNavigation boolean | `tests/e2e/sectionNavigation.spec.ts` — "Visibility Controls composition has hideFromSectionNavigation boolean property" | Covered |
| Guide Visibility Controls has hideFromSectionNavigation boolean | `tests/e2e/sectionNavigation.spec.ts` — "Guide Visibility Controls composition has hideFromSectionNavigation boolean property" | Covered |
| Sibling with toggle ticked excluded; unticked sibling present | `tests/e2e/sectionNavigation.spec.ts` — "sibling with hideFromSectionNavigation is absent; unticked sibling present" | Covered |
| Section-nav and search-visibility filters are independent | `tests/e2e/sectionNavigation.spec.ts` — "the section-nav and search/IsVisible filters are independent" | Covered |
| Child with toggle ticked excluded from li.child list | `tests/e2e/sectionNavigation.spec.ts` — "child with hideFromSectionNavigation is absent from li.child list" | Covered |
| Suppression when toggle removes the last sibling | `tests/e2e/sectionNavigation.spec.ts` — "no section nav when hideFromSectionNavigation removes the last sibling" | Covered |
| Partial filters on hideFromSectionNavigation | `tests/e2e/sectionNavigation.spec.ts` — "partial contains required structural elements" | Covered |
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
- 2026-07-07: Added the "Hide From Section Navigation" toggle (`hideFromSectionNavigation` boolean on the Visibility Controls composition). The section-nav partial now filters siblings and children by `IsVisible() && !hideFromSectionNavigation`, so a page can be removed from the section-nav sidebar independently of "Hide From Search". Default unticked (existing content unaffected); the current page is never filtered from its own list; suppression recomputes against the filtered lists. New scenarios and coverage rows added; behavior folds into this existing capability doc (change to `section-navigation`, spec `_specs/shipped/section-nav-hide-toggle.md`).
- 2026-07-08: Mirrored the toggle onto the **Guide Visibility Controls** composition (`guideVisibilityControls`), so Guides and How-To Guide page types now carry `hideFromSectionNavigation` in the backoffice too — closing a parity gap where the 2026-07-07 increment only added it to the standard `Visibility Controls`. Retrofitted (schema + regenerated ModelsBuilder models were already committed; this pass added the composition test + these doc updates). Discovered during retrofit: guide page types render no section navigation of their own (only `content.cshtml` / `documentation.cshtml` do), so the toggle is currently latent for guides — effective only where a guide node appears within a section-nav-rendering page's sibling/child list. Follow-ups filed: ROADMAP `guide-visibility-composition-consolidation` (merge/justify the twin compositions) and `guide-visibility-toggle-datatype-drift` (reconcile `hideFromTopNavigation`'s divergent data type across the two compositions).
