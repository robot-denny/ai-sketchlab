# E2E Testing Reference

Technical reference for authoring Playwright E2E specs against this project's Umbraco 17 backoffice — the API quirks and resilience rules. CLAUDE.md's Testing section and the `/block` skill point here.

## Umbraco 17 Management API Quirks

Hard-won lessons from building tests against the live API:

**Reserved property aliases** — These aliases are rejected silently or cause validation errors:
- `level` — reserved (use `alertLevel`, `severityLevel`, etc.)
- When in doubt, prefix with the block name (e.g., `alertContent` not `content`)

**Correct dropdown editor UI alias:**
```
Umb.PropertyEditorUi.Dropdown
```
`SelectBox` does not exist. The property editor alias (schema) is `Umbraco.DropDown.Flexible`.

**`getByName()` returns `false`, not `null`** when an entity isn't found. Use `.toBeTruthy()` / `.toBeFalsy()`, not `.toBeNull()` / `.not.toBeNull()`.

**Flat `properties` array** — The Management API returns document type properties directly on the object:
```typescript
// WRONG — no groups nesting in the API response
elementType.groups?.flatMap((g) => g.properties)

// CORRECT
elementType.properties ?? []
```

**Token lifetime** — the 299-second expiry (see *Auth Setup* in CLAUDE.md → Testing) bites long-running scripts too: re-authenticate before each logical operation group, don't reuse one token across a whole multi-call `beforeAll`.

## E2E Test Resilience Rules

Follow these rules when writing or planning Playwright E2E tests to avoid fragile, environment-coupled, or non-portable tests.

**1. Never hardcode Umbraco UUIDs.** Document IDs, document type IDs, folder IDs, and template IDs change between environments. Always look them up dynamically via the Management API (walk tree roots, search by name). Store the lookup in `beforeAll` and pass to tests via shared variables.

**2. Never hardcode URL slugs.** Don't assume `/parent-name/child-name/` — Umbraco may append `-2`, `-3` etc. when duplicate names exist (e.g., leftover from a failed test run). After creating and publishing a page, fetch its actual URL from the API response or document `urls` property.

**3. Always clean up stale test data before setup.** In `beforeAll`, search for and delete any leftover pages from previous failed runs *before* creating new ones. This prevents name collisions and slug suffixes. Pattern: search by a unique prefix (e.g., `SN Test`) in the document tree, delete matches in reverse-depth order.

**4. Re-acquire tokens before each logical operation group.** Don't rely on a single token for an entire `beforeAll` that does many sequential API calls. Add a helper that refreshes the token if it's near expiry, or re-authenticate at the start of each phase (setup, test, teardown).

**5. Use regex for CSS/file assertions — tolerate whitespace.** When asserting on CSS or file content, never match exact formatting like `.toContain('.section-nav {')`. Use `.toMatch(/\.section-nav\s*\{/)` to survive minification, auto-formatting, or whitespace changes.

**6. Prefer browser assertions over file-content assertions.** Don't assert on specific CSS class names (e.g., `col-lg-3`) or implementation details inside `.cshtml` files — these are implementation details, not behavior. If the browser E2E tests already verify the rendered behavior (sidebar visible, layout correct), file-content checks for the same thing are redundant and fragile. File-content tests should only verify structural concerns that can't be tested in the browser (e.g., which Razor helper method is used).

**7. Make API lookups resilient to testhelpers bugs.** The `getByName()` method in `@umbraco/playwright-testhelpers` has a known bug where `recurseChildren` short-circuits. When looking up entities, always have a fallback strategy (e.g., `getChildren(folderId)` for a known parent). Document the workaround with a comment explaining *why*, so it can be removed when the upstream fix lands.

**General patterns for test setup/teardown:**
```typescript
// Good: dynamic lookup
const home = (await api.document.getRoot()).find(d => d.name === 'Home');
const contentDT = await api.documentType.getByName('Content');

// Good: clean before create
async function cleanStaleTestData(token, prefix) {
  // Search tree for pages starting with prefix, delete them
}

// Good: get actual URL after publish
const doc = await apiFetch(token, 'GET', `/document/${id}`);
const actualUrl = doc.urls?.[0]?.url;
```
