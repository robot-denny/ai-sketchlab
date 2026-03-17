---
name: E2E Test Patterns
description: Quality patterns and anti-patterns observed in Playwright E2E tests in this codebase
type: project
---

## Good Patterns Seen

- Token refresh helper with TTL check (`TOKEN_TTL = 250_000ms`) correctly within 299s limit.
- Dynamic document lookup via tree walk — no hardcoded UUIDs.
- Dynamic URL resolution via `/document/urls?id=` — no hardcoded slugs.
- CSS assertions use regex with `\s*` to tolerate whitespace (rule #5).
- Composition lookup via Compositions folder directly (workaround for `getByName` recurseChildren bug).
- `toBeTruthy()` used for existence assertions (not `not.toBeNull()`).

## Anti-Patterns / Issues Seen

- **Section 1 tests call `findCompositionByName()` independently in each test** — 3 separate full tree walks + full document-type fetches for tests that all query the same composition. These should share a `beforeAll`.
- **Section 3 (CSS file-content tests) assert implementation details** like `border-top: 6px` and `#009171` — these are already covered by the browser E2E tests and are fragile/redundant per rule #6.
- **Section 3 regex `\.site-footer\s+\.footer-inner\s*\{[^}]*column-reverse`** — the `[^}]*` greedy match within `{...}` will fail if the property is not in the same rule block as the opening brace (e.g., minified output). Fragile.
- **`homeDocId` / `homeDocUrl` module-level variables** shared across `test.describe` in serial mode — acceptable here but can cause cross-suite contamination if tests are ever parallelized.
- **No token refresh between `beforeAll` and the 8 browser tests** — for long test runs this could expire mid-suite (not a risk here since browser tests don't use the token, but worth noting for future suites that do).

## Structural Conventions

- `freshToken()` module-level helper with timestamp caching — use this pattern in all new test files.
- `apiFetch()` wrapper for all Management API calls — do not inline `fetch` in tests.
- Section comments (`// Section 1:`, `// Section 2:`) used to organize large spec files.
