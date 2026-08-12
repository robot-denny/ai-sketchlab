# Spec for Section Navigation Hide Toggle

> This spec captures initial requirements and design rationale. For **current system behavior**, see the doc named on the **Work type** line below (a new `_features/<feature-name>.md` for a new capability; an existing `_features/*.md` for a change; a `docs/` runbook or CLAUDE.md section for a fix).

branch: claude/feature/section-nav-hide-toggle
**Work type**: change-to section-navigation — see CLAUDE.md → Workflow layers → "Work types"; this enhances an already-documented capability, so it earns a new **Increment** on `_features/section-navigation.md` rather than a new feature doc.
figma_component (if used): (none)

## Summary

Give CMS editors a per-page toggle that hides a page from the **section navigation** sidebar, independently of the existing "Hide From Search" / "Hide From Top Navigation" / "Hide From XML Sitemap" toggles.

Today the section navigation partial (`sectionNavigation.cshtml`) filters the sibling and child lists by `IsVisible()` — i.e. Umbraco's built-in `umbracoNaviHide` ("Hide From Search"). That means the only way to remove a page from the section-nav sidebar is to also hide it from search results, which is too blunt: an editor may want a page fully indexed and searchable but not cluttering the contextual sidebar (or vice-versa).

This adds a new boolean property, `hideFromSectionNavigation` ("Hide From Section Navigation"), to the existing **Visibility Controls** composition (alias `visibilityControls`), alongside the three toggles already in its "Visibility" property group. `sectionNavigation.cshtml` gains a filter that excludes any page with this box ticked. The default is **unticked — the page appears** — so existing content is unaffected and no re-authoring is required.

Because the toggle lives on the shared `visibilityControls` composition, it appears automatically on every page type that composes it (Content, Documentation, Article, and the others) — matching where the other three visibility toggles already show up.

## Functional Requirements

- Add a boolean property `hideFromSectionNavigation`, display name **"Hide From Section Navigation"**, to the `visibilityControls` composition's "Visibility" property group, using the same true/false data type as the sibling toggles.
- Position it in the Visibility group alongside the other three toggles (sensible sort order relative to the existing `hideFromTopNavigation` / `umbracoNaviHide` / `hideFromXMLSitemap` — see Open Questions).
- Give it an editor-facing description consistent with the others (e.g. "Tick this box if you want to hide this page from the section navigation sidebar").
- Default value is unticked (`false`): a page with the property unset or unticked **still appears** in section navigation exactly as it does today.
- `sectionNavigation.cshtml` must exclude pages where `hideFromSectionNavigation` is `true` from **both** the sibling list and the child list.
- The existing `IsVisible()` (`umbracoNaviHide`) filter stays — the new toggle is an **additional, independent** exclusion, not a replacement. A page is shown only if it is `IsVisible()` **and** not `hideFromSectionNavigation`.
- The existing "suppress the whole sidebar when there are no meaningful items" behavior must continue to work, now counting the new filter (e.g. if the new toggle removes the last sibling/child, the sidebar suppresses just as it would for a hidden page).
- The change deploys via the normal schema pipeline: the updated `visibilityControls` `.uda` artifact plus regenerated ModelsBuilder models (`SourceCodeManual` — see CLAUDE.md → ModelsBuilder) are committed together.

## Possible Edge Cases

- **Current page has the toggle ticked.** A visitor lands directly on a page that is hidden from section nav. The page should still render normally; whether it appears as the highlighted "current" item in its own sidebar is an open question (see Open Questions).
- **Toggle removes the last remaining item.** If ticking the toggle leaves no other visible siblings and no visible children, the sidebar should suppress entirely (reuse the existing early-return logic).
- **Interaction with `umbracoNaviHide`.** A page already hidden from search (`umbracoNaviHide = true`) is already excluded; ticking `hideFromSectionNavigation` as well is harmless and idempotent.
- **Documentation / Guide pages.** Documentation composes `visibilityControls`, so it inherits the new toggle automatically. The separate `guideVisibilityControls` composition does **not** currently carry it — confirm whether any section-nav-rendering page relies on `guideVisibilityControls` (see Open Questions).
- **Property missing on older content.** Content published before this property existed has no stored value; the view must treat "no value" as "not hidden" (appears).
- **Backoffice ordering.** The new field should sit logically among the other three so editors read it as one family of visibility switches, not an orphan.

## Acceptance Criteria

- AC1: The `visibilityControls` composition has a new boolean property `hideFromSectionNavigation` labeled "Hide From Section Navigation" in the "Visibility" group.
- AC2: The new toggle appears in the backoffice on page types that compose `visibilityControls` (verified on at least Content and Documentation), alongside the existing three visibility toggles.
- AC3: With the toggle unticked (default), a page appears in the section navigation sidebar exactly as it does today.
- AC4: With the toggle ticked on a sibling page, that page is excluded from the section navigation sidebar of other pages in the section.
- AC5: With the toggle ticked on a child page, that page is excluded from the indented child list under its parent in the section navigation.
- AC6: The new filter is independent of "Hide From Search" — a page that is searchable (`umbracoNaviHide` unticked) but has `hideFromSectionNavigation` ticked is absent from section nav yet unaffected in search.
- AC7: If ticking the toggle leaves no other visible siblings and no visible children, the section navigation sidebar is suppressed entirely.
- AC8: ModelsBuilder models are regenerated and committed alongside the updated `.uda` so the model-coupled view compiles and the property is available in code.

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples. These will be verified and refined after implementation. See `_features/section-navigation.md` for the verified version.

### Rule: The Visibility Controls composition carries a "Hide From Section Navigation" toggle

```scenario
Scenario: New boolean toggle exists in the Visibility group
  Given the "Visibility Controls" composition exists in the CMS
  When a CMS editor opens the "Visibility" property group
  Then a boolean property "Hide From Section Navigation" (alias hideFromSectionNavigation) is present
  And it sits alongside "Hide From Top Navigation", "Hide From Search", and "Hide From XML Sitemap"
```

```scenario
Scenario: The toggle appears on page types that compose Visibility Controls
  Given the "Content" and "Documentation" page types compose "Visibility Controls"
  When a CMS editor edits a Content page or a Documentation page
  Then the "Hide From Section Navigation" toggle is shown in the Visibility group
```

### Rule: The default is that pages appear in section navigation

```scenario
Scenario: A page with the toggle unticked still appears
  Given a page "Section Child A" with 1 visible sibling "Section Child B"
  And "Hide From Section Navigation" is unticked on "Section Child B"
  When a visitor views "Section Child A" with section navigation enabled
  Then "Section Child B" appears in the section navigation list
```

```scenario
Scenario: Pre-existing content authored before the toggle existed still appears
  Given "Section Child B" was published before the toggle existed and has no stored value for it
  When a visitor views its sibling "Section Child A" with section navigation enabled
  Then "Section Child B" appears in the section navigation list
```

### Rule: Ticking the toggle hides a sibling page from section navigation

```scenario
Scenario: A hidden sibling is excluded from the list
  Given a page "Section Child A" with a sibling "SN Hidden From Section"
  And "Hide From Section Navigation" is ticked on "SN Hidden From Section"
  When a visitor views "Section Child A"
  Then "SN Hidden From Section" does not appear in the section navigation list
  And other visible siblings still appear
```

### Rule: Ticking the toggle hides a child page from the indented child list

```scenario
Scenario: A hidden child is excluded from the nested list
  Given "Section Child A" has two child pages "SN Grandchild Visible" and "SN Grandchild Hidden"
  And "Hide From Section Navigation" is ticked on "SN Grandchild Hidden"
  When a visitor views "Section Child A" with section navigation enabled
  Then "SN Grandchild Visible" appears indented under the current page
  And "SN Grandchild Hidden" does not appear
```

### Rule: The section-nav toggle is independent of "Hide From Search"

```scenario
Scenario: A searchable page can still be hidden from section navigation
  Given "SN Searchable Only" has "Hide From Search" unticked and "Hide From Section Navigation" ticked
  When a visitor views a sibling page with section navigation enabled
  Then "SN Searchable Only" does not appear in the section navigation list
  And "SN Searchable Only" is still reachable and indexed for search
```

### Rule: The sidebar suppresses when the toggle removes the last meaningful item

```scenario
Scenario: Hiding the only sibling suppresses the sidebar
  Given "SN Lone Visible" and "SN Other" are the only two pages under a parent
  And "SN Lone Visible" has no child pages
  And "Hide From Section Navigation" is ticked on "SN Other"
  When a visitor views "SN Lone Visible" with section navigation enabled
  Then no section navigation sidebar appears
```

## Open Questions

- **Sort order within the Visibility group.** Existing sort orders are `hideFromTopNavigation` = 5, `umbracoNaviHide` = 10, `hideFromXMLSitemap` = 15. Should the new toggle be 20 (last), or grouped next to `hideFromTopNavigation` since both concern navigation? (Proposed: 20 to avoid renumbering existing fields.)
- **Current page hidden from itself.** If the page a visitor is on has `hideFromSectionNavigation` ticked, should it still render as the highlighted "current" item in its own sidebar (so the visitor sees where they are), or be omitted from the list too? (Proposed: keep showing the current page as the active item; the toggle governs how a page appears in *other* pages' navigation.)
- **`guideVisibilityControls` parity.** Does any page that renders section navigation rely on the separate `guideVisibilityControls` composition rather than `visibilityControls`? If so, the toggle must be added there too. (Documentation composes `visibilityControls` directly, so it is covered; needs confirmation that no guide-only type is left out.)
- **Naming of the data type.** Reuse the existing shared true/false data type (`umb://data-type/92897bc6a5f34ffeae27f2e7e33dda49`) used by the other three toggles — confirm no separate data type is warranted.

## Testing Guidelines

Extend `tests/e2e/sectionNavigation.spec.ts` (the existing section-navigation Playwright suite) rather than creating a new file. Add meaningful tests for the following, without going too heavy:

- The `visibilityControls` composition exposes a `hideFromSectionNavigation` boolean property (schema/API assertion, following the existing `showSectionNavigation` composition test pattern).
- A sibling page with the toggle ticked does **not** appear in the rendered section navigation list; an unticked sibling does (browser assertion).
- A child page with the toggle ticked does **not** appear in the indented child list (browser assertion).
- Independence from search: a page with `hideFromSectionNavigation` ticked but `umbracoNaviHide` unticked is absent from section nav.
- Suppression: ticking the toggle so that no meaningful items remain hides the whole sidebar.
- Follow the E2E Resilience Rules in CLAUDE.md — no hardcoded UUIDs/slugs, clean stale test data in `beforeAll`, re-acquire tokens per phase, prefer browser assertions over `.cshtml` file-content checks.
