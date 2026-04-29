# Plan: Alert Banner Icons

## Context

The existing alert banner block displays text-only alerts with Bootstrap contextual colors. This enhancement adds a contextual icon to each alert level (emergency, warning, informational) and lets CMS editors override the icon from a curated dropdown. The project already loads **Font Awesome 6.5.1** (not Bootstrap Icons) via `master.cshtml`, so we use FA icon classes.

## Key Design Decisions

- **Font Awesome** (already loaded) instead of Bootstrap Icons — the spec mentioned BI but the project uses FA
- **Store full FA class string** in the dropdown (e.g. `fa-solid fa-heart`) — no string manipulation in Razor, self-documenting
- **Flexbox layout** using Bootstrap's `d-flex align-items-center` on the `.alert` div
- **FA JS converts `<i>` to `<svg>`** in the DOM — browser tests must assert on `svg.fa-*` selectors, not `i.fa-*`
- **Property alias**: `iconOverride` (not `icon` which could be reserved)
- **Backward compatible**: `Value<string>("iconOverride")` returns `null` on old blocks → falls back to default icon

---

## Step 1: Create "Alert Icon Override" Data Type

Via Management API, create a new dropdown data type:
- **Name**: `Alert Icon Override`
- **EditorAlias**: `Umbraco.DropDown.Flexible`
- **EditorUiAlias**: `Umb.PropertyEditorUi.Dropdown`
- **multiple**: `false`
- **~50 curated FA solid icons** including the 3 defaults plus common icons (bell, shield, lock, fire, bolt, check, star, heart, flag, rocket, etc.)

## Step 2: Add `iconOverride` Property to Alert Banner Element Type

Via Management API:
1. GET Alert Banner doc type (key: `17c66d28-107b-4934-bc01-3b5777d42c8a`)
2. Add property: alias `iconOverride`, name "Icon Override", mandatory: `false`, sort order after `alertContent`
3. PUT the updated doc type
4. The `.uda` file auto-updates via Umbraco Deploy

## Step 3: Update the Razor Partial

**File**: `src/UmbracoProject/Views/Partials/blocklist/Components/alertBanner.cshtml`

```razor
@{
    var iconOverride = row?.Value<string>("iconOverride");

    var defaultIcon = alertLevel switch
    {
        "emergency" => "fa-solid fa-circle-exclamation",
        "warning"   => "fa-solid fa-triangle-exclamation",
        _           => "fa-solid fa-circle-info"
    };

    var iconClass = !string.IsNullOrWhiteSpace(iconOverride) ? iconOverride : defaultIcon;
}

<div class="alert @bootstrapClass d-flex align-items-center" role="alert">
    <i class="@iconClass me-2 flex-shrink-0" aria-hidden="true"></i>
    <div>@alertContent</div>
</div>
```

- `flex-shrink-0` prevents icon from collapsing on long content
- `aria-hidden="true"` hides decorative icon from screen readers
- Icon inherits color from Bootstrap's `.alert-*` contextual class
- Icon scales with text (FA uses `1em` sizing)

## Step 4: Update E2E Tests

**File**: `tests/e2e/blocks/alertBanner.spec.ts`

Expand from 2 tests to ~4 sections following the `articleListGridView.spec.ts` pattern:

### Section 1: Element Type Tests (existing + new)
- Update `expectedPropertyAliases` to include `'iconOverride'`
- Add test: `iconOverride` property exists, is not mandatory, uses dropdown editor

### Section 2: Partial View File Tests (existing + new)
- Keep file-existence test
- Add: partial contains `d-flex`, `iconOverride`, and all 3 default FA icon classes

### Section 3: Browser E2E Tests
Setup pattern from `articleListGridView.spec.ts`: `freshToken()`, `apiFetch()`, `getDocumentPath()` helpers.

**beforeAll**:
1. Find a page with `contentRows` block list (Article List or Content page)
2. Clean stale test blocks from prior runs
3. Save original block list for restoration
4. Inject alert banner blocks into `contentRows` for each level (emergency, warning, info) + one with icon override
5. Publish and get actual URL

**Tests** (serial mode):
1. Emergency alert renders `svg.fa-circle-exclamation` inside `.alert-danger`
2. Warning alert renders `svg.fa-triangle-exclamation` inside `.alert-warning`
3. Informational alert renders `svg.fa-circle-info` inside `.alert-info`
4. Alert with `iconOverride` set to `fa-solid fa-heart` renders `svg.fa-heart` instead of default
5. Alert with no override renders the level-appropriate default

**afterAll**: Restore original block list value and publish.

**Critical**: Font Awesome JS replaces `<i>` tags with `<svg>` elements, so all browser assertions use `svg.fa-*` selectors.

### Section 4: Shared Helpers
Reuse `freshToken()`, `apiFetch()`, `getDocumentPath()` pattern from `articleListGridView.spec.ts`. Dropdown values must be arrays: `["fa-solid fa-heart"]` not `"fa-solid fa-heart"`.

## Step 5: Build & Verify

```bash
cd src/UmbracoProject && dotnet build
PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test tests/e2e/blocks/alertBanner.spec.ts
```

## Files to Modify

| File | Change |
|------|--------|
| `src/UmbracoProject/Views/Partials/blocklist/Components/alertBanner.cshtml` | Add icon logic + flexbox layout |
| `tests/e2e/blocks/alertBanner.spec.ts` | Expand with icon property, file content, and browser E2E tests |
| `umbraco/Deploy/Revision/document-type__17c66d28107b4934bc013b5777d42c8a.uda` | Auto-updated by Umbraco after API changes |
| New `.uda` for the Alert Icon Override data type | Auto-created by Umbraco after API creation |

## Reference Files

| File | Purpose |
|------|---------|
| `tests/e2e/articleListGridView.spec.ts` | Pattern for browser E2E with block injection, API helpers, setup/teardown |
| `src/UmbracoProject/Views/master.cshtml` | Confirms Font Awesome 6.5.1 is loaded |
| `umbraco/Deploy/Revision/data-type__3d6a3dc2fe444c368898dbb76f33cd09.uda` | Existing Alert Level dropdown (reference for creating new data type) |
