# Plan: Section Navigation Feature

**Spec**: `_specs/shipped/section-navigation.md`
**Branch**: `claude/feature/section-navigation`

## Context

The site needs a contextual "section navigation" sidebar for content and documentation pages. Editors enable it per-page via a boolean property. When enabled, the page gets a two-column layout with a sidebar showing sibling pages and the current page's children. On mobile it collapses into a "In this Section" disclosure. When disabled, layout is unchanged.

---

## Key Decisions

- **"Hide from navigation" flag**: Use `umbracoNaviHide` (checked via `.IsVisible()`) — Umbraco's built-in nav hide that works universally across nav partials. The top nav uses the custom `hideFromTopNavigation`; for section nav, `umbracoNaviHide` is the right standard flag.
- **Property location**: Create a new `sectionNavigationControls` composition (reusable if other doc types need it later), add it to `content` and `documentation`.
- **Root-level pages**: Show siblings + children filtered by `umbracoNaviHide`. Siblings at root level are top-level site sections — useful context.
- **Suppress condition**: If the only visible "item" is the current page itself (no visible siblings, no visible children) → render nothing.
- **Mobile toggle**: Use Bootstrap 5's `collapse` plugin (already loaded), with a chevron icon using Font Awesome (already loaded).
- **Column proportions**: `col-lg-3` (sidebar) + `col-lg-9` (content) at ≥992px breakpoint.

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading is a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Add `showSectionNavigation` property to document types

> **Prompt**: Implement Step 1 of `_plans/shipped/section-navigation.md`. Write a Node.js script at `scripts/add-section-nav-property.js` that uses the Umbraco Management API to create a new `sectionNavigationControls` composition document type with a `showSectionNavigation` boolean property, then adds that composition to the `content` and `documentation` document types. Run the script to verify it succeeds.

**What to build**: `scripts/add-section-nav-property.js`

The script (single process to avoid token expiry):
1. Authenticates via `grant_type=client_credentials` using credentials from `.env`
2. Creates composition document type `sectionNavigationControls`:
   - Property alias: `showSectionNavigation`, name: "Show Section Navigation"
   - Data type: reuse existing True/False boolean (`umb://data-type/92897bc6a5f34ffeae27f2e7e33dda49`)
   - Default value: `false`
3. GETs `content` and `documentation` document types, adds the new composition to each, PUTs them back

**Validation**: Script exits with no errors. In the backoffice, open a Content or Documentation page — a "Show Section Navigation" toggle should appear in the settings.

---

### Step 2 — Create `sectionNavigation.cshtml` partial

> **Prompt**: Implement Step 2 of `_plans/shipped/section-navigation.md`. Create the Razor partial `src/UmbracoProject/Views/Partials/sectionNavigation.cshtml` for section navigation. Then run `dotnet build` from `src/UmbracoProject` to confirm no Razor errors.

**File**: `src/UmbracoProject/Views/Partials/sectionNavigation.cshtml`

Model: `IPublishedContent` (the current page).

Logic:
- `siblings` = `Model.Parent?.Children.Where(x => x.IsVisible())` (or empty if no parent)
- `children` = `Model.Children.Where(x => x.IsVisible())`
- If no siblings and no children → `return` (render nothing)
- If siblings exist but none other than current page, and no children → `return`
- Render a `<nav class="section-nav">` containing a `<ul>`:
  - Each sibling as a `<li>` with an `<a>` — add `class="active"` when `sibling.Id == Model.Id`
  - Under the active sibling item, inject child pages as a nested `<ul class="section-nav-children">` with indented `<li><a>` items
- Wrap the `<ul>` in:
  - A `<div class="section-nav-desktop">` (visible on desktop ≥992px)
  - A `<div class="section-nav-mobile">` containing a Bootstrap collapse toggle + the same `<ul>` (visible on mobile <992px)
- Mobile toggle: `<button class="section-nav-toggle" data-bs-toggle="collapse" data-bs-target="#sectionNavList" aria-expanded="false">In this Section <i class="fas fa-chevron-down"></i></button>`

**Validation**: `dotnet build` passes with no errors.

---

### Step 3 — Update `content.cshtml` and `documentation.cshtml`

> **Prompt**: Implement Step 3 of `_plans/shipped/section-navigation.md`. Update `src/UmbracoProject/Views/content.cshtml` and `src/UmbracoProject/Views/documentation.cshtml` to conditionally render a two-column layout when `showSectionNavigation` is true. Then run `dotnet build` to confirm no errors.

**Files to modify**:
- `src/UmbracoProject/Views/content.cshtml`
- `src/UmbracoProject/Views/documentation.cshtml`

Current layout (both files):
```html
<div class="row">
    <div class="col-lg-8 col-md-10 mx-auto">
        <!-- content -->
    </div>
</div>
```

Change to: read `Model.Value<bool>("showSectionNavigation")`. When true:
```html
<div class="row">
    <div class="col-lg-3">
        @await Html.PartialAsync("~/Views/Partials/sectionNavigation.cshtml", Model)
    </div>
    <div class="col-lg-9">
        <!-- existing content (unchanged) -->
    </div>
</div>
```
When false, keep the original `col-lg-8 col-md-10 mx-auto` layout.

Use `PartialAsync` (not `CachedPartialAsync`) — section nav is page-specific.

**Validation**: `dotnet build` passes. Visit a content page in the browser with the property enabled and confirm the two-column layout appears.

---

### Step 4 — Add CSS for section navigation

> **Prompt**: Implement Step 4 of `_plans/shipped/section-navigation.md`. Append CSS for the section navigation sidebar and mobile toggle to `src/UmbracoProject/wwwroot/assets/css/styles.css`.

Append to end of `src/UmbracoProject/wwwroot/assets/css/styles.css`:

```css
/* ========================
   Section Navigation
   ======================== */

.section-nav {
  font-size: 0.875rem;
}

.section-nav ul {
  list-style: none;
  padding-left: 0;
  margin-bottom: 0;
}

.section-nav .nav-link {
  padding: 0.35rem 0;
  color: #212529;
  display: block;
  border-left: 3px solid transparent;
  padding-left: 0.75rem;
}

.section-nav .nav-link:hover {
  color: #005E70;
  border-left-color: #dee2e6;
}

.section-nav .nav-link.active {
  font-weight: 600;
  color: #005E70;
  border-left-color: #005E70;
}

.section-nav-children {
  padding-left: 1rem;
}

.section-nav-children .nav-link {
  font-size: 0.8125rem;
  color: #6c757d;
}

.section-nav-children .nav-link:hover {
  color: #005E70;
}

.section-nav-toggle {
  width: 100%;
  text-align: left;
  background: none;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #212529;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.section-nav-toggle .fa-chevron-down {
  transition: transform 0.2s;
}

.section-nav-toggle[aria-expanded="true"] .fa-chevron-down {
  transform: rotate(180deg);
}

@media (min-width: 992px) {
  .section-nav-mobile {
    display: none;
  }
  .section-nav-desktop {
    display: block;
  }
}

@media (max-width: 991.98px) {
  .section-nav-desktop {
    display: none;
  }
  .section-nav-mobile {
    display: block;
  }
}
```

**Validation**: Hard-refresh a page with section nav enabled. Sidebar links should have the left-border active indicator. On a narrow viewport, the toggle button should be visible and the list hidden by default.

---

### Step 5 — Write E2E tests

> **Prompt**: Implement Step 5 of `_plans/shipped/section-navigation.md`. Write the Playwright E2E test file at `tests/e2e/sectionNavigation.spec.ts`. The tests should create their own test content via the Management API in `beforeAll`, run all acceptance criteria checks, then clean up in `afterAll`. Run the tests to confirm they pass.

**File**: `tests/e2e/sectionNavigation.spec.ts`

**Test setup** (`beforeAll`):
- Create a parent `content` page under the site root
- Create 3 children under it: "Section Child A" (section nav ON), "Section Child B" (section nav OFF, used as sibling), "Section Child Hidden" (umbracoNaviHide ON)
- Create a grandchild under "Section Child A" for the children-indented test
- Publish all pages
- Store URLs/IDs for use in tests

**Test cases**:
1. `showSectionNavigation = false` → no `.section-nav` element on page
2. `showSectionNavigation = true` → `.section-nav` exists
3. Current page link has `.active` class
4. Sibling page "Section Child B" appears in the list
5. "Section Child Hidden" does not appear in the list
6. Grandchild appears indented (inside `.section-nav-children`)
7. At `{ width: 1200, height: 800 }` viewport: sidebar column visible alongside content
8. At `{ width: 375, height: 812 }` viewport: `.section-nav-desktop` hidden, toggle button visible
9. Click toggle → nav list becomes visible
10. Click toggle again → nav list hidden
11. Toggle `aria-expanded` reflects correct state
12. Page with no visible siblings/children → no `.section-nav` rendered

**Teardown** (`afterAll`): delete all test-created pages via Management API.

**Run**: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/sectionNavigation.spec.ts`

---

## File Summary

| Action | File |
|--------|------|
| Create (delete after running) | `scripts/add-section-nav-property.js` |
| Create | `src/UmbracoProject/Views/Partials/sectionNavigation.cshtml` |
| Modify | `src/UmbracoProject/Views/content.cshtml` |
| Modify | `src/UmbracoProject/Views/documentation.cshtml` |
| Modify (append) | `src/UmbracoProject/wwwroot/assets/css/styles.css` |
| Create | `tests/e2e/sectionNavigation.spec.ts` |
