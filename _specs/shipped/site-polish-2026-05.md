# Spec for Site Polish 2026-05

> This spec captures initial requirements and design rationale. It is a **cleanup bundle**, not a feature — there is no companion `_features/site-polish-2026-05.md`. The original item 3 ("Hide from Section Navigation" toggle) was feature-shaped and has been extracted — see Resolutions below.

branch: claude/feature/site-polish-2026-05
figma_component (if used): n/a

## Summary

A maintenance bundle covering five small cleanup tasks across views, schema, styles, and docs. Each item is independently completable; they're grouped only so they ride a single review/deploy cycle. A sixth item (the "Hide from Section Navigation" toggle) was extracted into its own spec because it adds new behaviour worth documenting in `_features/section-navigation.md`.

## Functional Requirements

Five bundle items, each callable independently. Numbering preserves the original six-item ordering for traceability; item 3 lives in a separate spec.

### 1. Swap subtitle → meta description on article listings

Article listings (e.g. the article-list / category-list pages) currently render each article's `subtitle` field beneath the title. Switch the rendered field to `metaDescription` so SEO copy doubles as the listing teaser. When an article has no `metaDescription`, fall back to `subtitle` so existing listings don't go blank. Detail pages (the single-article view) are unchanged.

### 2. Remove the "Generic" tab and fold its fields into existing tabs

Selected document types carry a "Generic" tab whose fields belong logically to other tabs (e.g. SEO fields → Metadata tab, content fields → Content tab). Identify each doc type with a Generic tab, decide a target tab per field, and consolidate. The Generic tab should disappear from the editor UI; no field values should be lost.

### 3. (extracted)

This item — "Add 'Hide from Section Navigation' toggle to Content" — is feature-shaped and lives in its own spec. Run `/spec section-nav-hide-toggle` from master when ready. It follows the existing visibility-controls pattern (visibility tab — hide from main nav, hide from search) and earns a new Increment on `_features/section-navigation.md`.

### 4. Contact page styles match the brand

The Contact page (`Views/Components/Contact/...` and any contact-page partials) is rendering with legacy styles or fails to pick up the design system tokens. Audit the current rendering, identify deviations from the brand (colours, typography, spacing, button styles), and align to the typography.css / design-system tokens used elsewhere. The form itself is managed via Umbraco Forms — this work is purely stylistic, no new fields or functionality.

### 5. Notes block styles match the design system

The Notes block (added to blog articles — likely under `Views/Partials/blocklist/Components/` or similar) does not pick up design-system styles. Audit and align: colours, typography, spacing, border treatment. Purely a restyle, no structural changes.

### 6. Update Capabilities documentation and corresponding CMS content

The repo-side `docs/capabilities.md` is the source of truth. Update it to reflect features shipped in 2026-04 and 2026-05 (AI search, editor how-to guides, ella-block-attribution, etc.). Then use `/umbraco-edit` (MCP-driven) to push the updated markdown into the "Capabilities" page's markdown editor in the CMS so the public-facing content mirrors the doc.

## Figma Design Reference

Not applicable — items 4 and 5 reference the existing design system tokens in `wwwroot/assets/css/typography.css` and the living style guide at `/styleguide`, not new Figma comps.

## Possible Edge Cases

- **Article has subtitle but no meta description** (item 1): the card falls back to `subtitle`. If both are empty, the card shows neither — same as today's missing-subtitle behaviour.
- **Generic-tab field is referenced in queries or views** (item 2): moving a property between tabs shouldn't change its alias, but if any code currently filters by property *group* (rare in this codebase), behaviour shifts. Plan step should grep before moving.
- **Contact form layout regression** (item 4): style changes affect form field heights, label positioning, validation message visibility. Manual matrix needed (mobile + desktop, empty form, submitted form, validation errors).
- **Notes block in legacy articles** (item 5): style changes apply to all existing blog posts retroactively. Spot-check a few representative articles after the change.
- **Capabilities CMS content has unsaved authoring** (item 6): the MCP push overwrites the CMS markdown editor's content. Read-then-write — verify the current CMS content matches the previous version of `docs/capabilities.md` before pushing the new one.

## Acceptance Criteria

- Item 1: Article listing pages render `metaDescription` (not `subtitle`) for each article card. When `metaDescription` is empty, the card falls back to `subtitle`. Single-article detail pages are unchanged.
- Item 2: No doc type that previously had a "Generic" tab has one after the change. All previously-Generic fields are visible under a different tab on those doc types. No field values are lost. `/check-uda` is clean.
- Item 4: The Contact page renders using design-system tokens — colours match the typography.css palette, typography matches the rest of the site, spacing and button styles are consistent with the design system. No functional changes.
- Item 5: The Notes block in blog articles renders using design-system tokens. Visual review against the design system passes.
- Item 6: `docs/capabilities.md` reflects all features shipped in 2026-04 through 2026-05. After the MCP push, the CMS "Capabilities" page's markdown editor content matches `docs/capabilities.md`.

## Scenarios (Draft)

Light-touch scenarios — most items are cosmetic and don't need formal BDD. Item 3's scenarios moved to the extracted toggle spec.

### Rule: Article listings show meta description, falling back to subtitle when empty

```scenario
Scenario: A visitor browses the article listing page
  Given an article "AI Ethics in 2026" with subtitle "Reflections on a fast year" and metaDescription "How content leaders should think about AI in 2026"
  When a visitor loads the article listing page
  Then the article card shows "How content leaders should think about AI in 2026"
  And the card does not show "Reflections on a fast year"
```

```scenario
Scenario: An article with no meta description falls back to subtitle
  Given an article "Year in Review" with subtitle "What we shipped" and no metaDescription
  When a visitor loads the article listing page
  Then the article card shows "What we shipped"
```

### Rule: Doc types with consolidated fields no longer expose a Generic tab

```scenario
Scenario: A CMS editor edits a previously-Generic-tabbed doc type
  Given a doc type that previously had a "Generic" tab
  When a CMS editor opens an item of that type for editing
  Then the editor sees only the non-Generic tabs (e.g. Content, Metadata)
  And every property that used to be on the Generic tab is still editable under one of the other tabs
```

### Rule: Contact page and Notes block use design-system tokens

```scenario
Scenario: Visual audit of Contact page matches design system
  Given a visitor loads the Contact page
  When the page is reviewed against the /styleguide reference
  Then colours, typography, and spacing match the design system tokens
```

```scenario
Scenario: Visual audit of Notes block in an article matches design system
  Given a blog article containing a Notes block
  When the rendered Notes block is reviewed against the /styleguide reference
  Then colours, typography, spacing, and border treatment match the design system tokens
```

### Rule: Capabilities doc and CMS page are mutually current

```scenario
Scenario: Recently-shipped features appear in capabilities doc and CMS page
  Given features shipped in 2026-04 and 2026-05 (AI search, editor how-to guides, ella-block-attribution, etc.)
  When a reader views docs/capabilities.md
  Then each shipped feature is listed
  And the CMS "Capabilities" page's markdown editor content matches docs/capabilities.md
```

## Resolutions

User-answered questions from the initial draft:

- **(Item 3 — scope)** RESOLVED → extract into its own spec. Run `/spec section-nav-hide-toggle` from master when ready. Earns a new Increment on `_features/section-navigation.md`.
- **(Item 3 — composition)** RESOLVED → follow the existing visibility-controls pattern (visibility tab: hide from main nav, hide from search). Captured in the extracted spec.
- **(Item 1 — fallback)** RESOLVED → fall back to `subtitle` when `metaDescription` is empty. Baked into Acceptance Criteria.
- **(Item 4 — scope)** RESOLVED → purely stylistic. No new functionality. Umbraco Forms continues to manage the form itself.
- **(Item 5 — scope)** RESOLVED → restyle only, no structural changes.
- **(Item 6 — coordination)** RESOLVED → repo-first authoring. Edit `docs/capabilities.md`, then push via `/umbraco-edit` / MCP into the Capabilities page's markdown editor in the CMS.

## Open Questions (deferred to planning)

- **(Item 2 — scope)** Which doc types have a "Generic" tab and which target tab does each field move to? Inspect via MCP / backoffice during the `/plan` step. Capture the doc-type-by-doc-type plan in **Key Decisions** of the plan file.

## Testing Guidelines

Most items are cosmetic and don't warrant new automated tests:

- **Item 1**: extend or add a quick E2E that asserts `metaDescription` text appears on the article-listing page for a known article, and that an article with no `metaDescription` falls back to `subtitle`.
- **Item 2**: the `/check-uda` pre-commit hook is the primary test surface. Optionally, an E2E that opens a previously-Generic-tabbed doc type and asserts the Generic tab is absent.
- **Items 4 & 5**: manual visual review against `/styleguide` is sufficient. Optionally, a Playwright test that asserts specific design-system CSS variables are applied (e.g. `getComputedStyle().getPropertyValue('--accent-primary')`).
- **Item 6**: no automated tests; manual review of `docs/capabilities.md` and the CMS page after the MCP push.
