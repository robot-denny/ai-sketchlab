# Spec for extract-search-service

> This spec captures initial requirements and design rationale. For **current system behavior**, see `_features/extract-search-service.md`.

branch: claude/feature/extract-search-service

## Summary

Move the business logic of the site's search page out of `Views/search.cshtml` and into a reusable `SearchService` class registered through DI. The user-facing behavior of `/search` is unchanged — same query routing (keyword vs AI semantic), same fallback chain, same 5-minute cache, same system-document-type filtering, same XSS-safe echoing, same empty state, same mode label.

The win is internal: the search pipeline becomes unit-testable, becomes available to future surfaces (a Delivery API endpoint for headless consumers, a typeahead/autocomplete UI, an admin "rebuild + smoke-test" tool) without anyone needing to re-implement the routing logic, and lifts the demo site's Pillar 2 (Architectural separation) score per the 2026-05 audit's P0.2 recommendation.

Out of scope (deliberate, deferrable to future increments):
- A Delivery API endpoint that exposes the service to a headless frontend.
- Adding the xUnit test project itself (audit P0.3 — separate spec). The service is *built to be unit-testable*; tests are written but only run once the test project exists.
- Mapping results to a DTO designed for over-the-wire serialization. v1 returns `IPublishedContent` to preserve view rendering with no template churn.

## Functional Requirements

- The `/search` page continues to accept a `q` query parameter and renders the same results, mode label, count, and empty state as before the refactor.
- `Views/search.cshtml` becomes a thin renderer: it asks `SearchService` for results and passes them to the existing partials (`_PageHead.cshtml`, `_ArticleCard.cshtml`, `_EmptyState.cshtml`). No token-counting, cache-key composition, fallback chaining, or searcher routing lives in the view.
- `SearchService` selects the search mode based on the same heuristic as today: 1–2 token queries route to keyword search; longer queries route to AI semantic search.
- `SearchService` falls back from AI semantic to keyword when AI returns zero results, identical to current behavior.
- `SearchService` caches results by normalized (trimmed, lower-cased) query + mode for 5 minutes, identical to current behavior.
- `SearchService` filters out the same system document types as today: `Category`, `CategoryList`, `Error`, `Search`, `XMLSitemap`.
- `SearchService` honors the same per-page result limit of `max(20, Umbraco:AI:Search:DefaultTopK)`.
- `SearchService` is unit-testable: its dependencies on Umbraco infrastructure (`IPublishedContentQuery`, `ISearcherResolver`, `IMemoryCache`, `IOptions<AIVectorSearchOptions>`) are all interface-typed and injected, so they can be replaced with mocks in a test that does not boot Umbraco.
- The service is registered through an `IComposer`, matching the project's existing DI registration discipline (see `SearchComposer.cs`, `PaletteServiceComposer.cs`).
- The site builds, boots, and serves `/search` identically after the refactor — verified via a manual browser check and the existing or new Playwright E2E pass.

## Possible Edge Cases

- Empty or whitespace-only query: the service returns no results without invoking either searcher; the view renders the search form alone (no results block, no empty-state message).
- Query that is exactly 2 tokens (boundary): routes to keyword (matches current `tokenCount <= 2` behavior).
- AI semantic returns raw hits but they are all dropped by system-document-type filtering: result list is empty, cache key remains the AI-mode key, no second-pass keyword fallback runs (matches current behavior — fallback triggers on *raw* zero from AI, not on filtered zero).
- Cache hit on a repeat query within 5 minutes: returns the cached result; neither searcher is invoked.
- `ISearcherResolver.GetSearcher(...)` returns null for the AI index: the AI search path returns empty, fallback runs to keyword.
- Query containing potential XSS payload (`<script>...</script>`, attribute-based vectors like `onerror=`): the service returns results without altering the query; the view encodes the query before reflecting it back (this is a view concern — preserve the current `WebUtility.HtmlEncode(query.StripHtml())` pipeline in the view).
- Raw searcher returns more than 20 hits after system-doc-type filtering: service returns the first 20.

## Acceptance Criteria

- **AC1**: `/search?q=<term>` returns the same result set, mode label, and result count for the same inputs after the refactor as it did before.
- **AC2**: The mode indicator shows "Keyword" for 1–2 token queries and "AI semantic" for 3+ token queries.
- **AC3**: A repeat of the same query within 5 minutes is served from cache; the underlying searcher is not invoked a second time (verifiable in a unit test by counting mock invocations).
- **AC4**: A 3+ token query that returns zero AI results transparently falls back to keyword search; the visitor still sees keyword matches if any exist.
- **AC5**: System document types (`Category`, `CategoryList`, `Error`, `Search`, `XMLSitemap`) never appear in the rendered result list, regardless of which searcher produced the hit.
- **AC6**: `Views/search.cshtml` contains no calls to `ISearcherResolver`, `IMemoryCache`, no token-counting, no cache-key composition, and no fallback logic. It calls one method on `SearchService` and renders the result.
- **AC7**: `SearchService` can be instantiated in a unit test with mock implementations of `IPublishedContentQuery`, `ISearcherResolver`, `IMemoryCache`, and `IOptions<AIVectorSearchOptions>`; no Umbraco hosting environment is required to run the tests.
- **AC8**: The service is registered via an `IComposer`. The site boots cleanly and the search page works after the refactor (smoke check: load `/search?q=contact`, see keyword-mode results; load `/search?q=stories about resilience`, see AI-mode results).
- **AC9**: A Playwright E2E test exists for `/search` that exercises (at minimum) a keyword query returning results, a long-form query returning AI-mode results, and an empty query rendering the form alone.

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples. These will be verified and refined after implementation. See `_features/extract-search-service.md` for the verified version.

### Rule: Search results on `/search` are unchanged by the refactor (AC1)

```scenario
Scenario: Visitor runs a short keyword query
  Given the site has published articles whose titles include "contact" and "about"
  When a visitor visits /search?q=contact
  Then they see the article whose title contains "contact" in the result list
  And they see the same result count the pre-refactor view would have shown
```

```scenario
Scenario: Visitor runs a long-form natural language query
  Given the site has published articles about creative process
  When a visitor visits /search?q=how artists overcome creative block
  Then they see the same article set the pre-refactor view would have shown
```

### Rule: The mode label reflects the query length (AC2)

```scenario
Scenario: One-token query is keyword mode
  When a visitor visits /search?q=contact
  Then the page shows "Mode · Keyword"
```

```scenario
Scenario: Two-token query is keyword mode (boundary)
  When a visitor visits /search?q=John Doe
  Then the page shows "Mode · Keyword"
```

```scenario
Scenario: Three-token query is AI semantic mode
  When a visitor visits /search?q=stories about resilience
  Then the page shows "Mode · AI semantic"
```

### Rule: Repeat queries within 5 minutes return cached results (AC3)

```scenario
Scenario: Second identical query inside the cache window does not invoke the searcher
  Given a visitor has just searched for "creative process" and got results
  When the same query is run again within 5 minutes
  Then the search backend is not invoked a second time
  And the visitor sees the same result set as the first run
```

### Rule: AI semantic falls back to keyword when AI returns nothing (AC4)

```scenario
Scenario: Long query with no AI matches falls back to keyword
  Given the AI search index has no chunks matching "obscure dadaist poetry collected"
  And the keyword index has a published article titled "Obscure Dadaist Poetry, Collected"
  When a visitor visits /search?q=obscure dadaist poetry collected
  Then they see the article in the result list
```

### Rule: System document types never appear in results (AC5)

```scenario
Scenario: AI hit on a Category node is filtered out
  Given the AI index returns a Category node as a top hit for "tech"
  When a visitor visits /search?q=tech reflections
  Then the Category node does not appear in the rendered result list
```

### Rule: The Razor view holds no search business logic (AC6)

```scenario
Scenario: Code review of search.cshtml after the refactor
  Given the refactor is complete
  When a reviewer reads search.cshtml
  Then they see no calls to ISearcherResolver
  And they see no use of IMemoryCache
  And they see no token-counting, cache-key composition, or fallback logic
  And the view calls one method on SearchService and renders the result
```

### Rule: SearchService is unit-testable in isolation (AC7)

```scenario
Scenario: Unit test instantiates SearchService with mocked dependencies
  Given a test provides mock implementations of the published-content query, the searcher resolver, the memory cache, and the AI vector search options
  When the test calls SearchService.SearchAsync with a query
  Then the test can assert on the returned result count, mode, and result IDs
  And no Umbraco hosting environment is required
```

### Rule: The service is registered through an IComposer and the site boots (AC8)

```scenario
Scenario: Site boots cleanly after the refactor
  Given the refactor is complete and the service is registered via a composer
  When the site is built and started locally
  Then /search?q=contact loads and shows keyword-mode results
  And /search?q=stories about resilience loads and shows AI-mode results
```

### Rule: An E2E test covers the visible search behaviors (AC9)

```scenario
Scenario: Playwright covers the three core paths
  When the Playwright suite runs
  Then a spec for /search exercises a keyword query that returns results
  And the spec exercises a long-form query that returns AI-mode results
  And the spec exercises an empty query that renders only the form
```

### Edge Cases

```scenario
Scenario: Empty query renders the form alone
  When a visitor visits /search with no q parameter
  Then the page shows the search form and head copy
  And no results list and no empty-state message is shown
```

```scenario
Scenario: Whitespace-only query is treated as empty
  When a visitor visits /search?q=%20%20%20
  Then no search is performed
  And the page shows the search form alone
```

```scenario
Scenario: Query containing HTML payload is rendered safely
  When a visitor visits /search?q=<script>alert(1)</script>
  Then the page renders the encoded query in the result banner
  And no script tag is executed in the browser
```

## Open Questions

- **Return type of `SearchService.SearchAsync`**: should it return a list of `IPublishedContent` (matches today's view consumption directly) or a richer result type (e.g. `SearchResult` carrying the items + mode + total count + cache-hit flag)? Recommend a small `SearchResult` record wrapping `IReadOnlyList<IPublishedContent> Items`, `SearchMode Mode`, and `int TotalAvailable` — the view already needs the mode to render the label, and a richer return removes the need for the view to compute anything. DTO-shaped item mapping (for Delivery API) is a separate v2 increment.
- **Service file location**: `src/UmbracoProject/Services/SearchService.cs` (new `Services/` folder, starts the convention the Kittitas comparison in the audit recommends) or alongside the existing helpers at the project root. Recommend `Services/` to seed the pattern — but flag for `/plan` to decide.
- **Logging**: the current view logs nothing. Adding `ILogger<SearchService>` with one structured-log entry on cache miss / fallback path is a cheap observability win the audit's Pillar 6 would credit. Decide during `/plan`; default is "yes, add a single debug log on cache miss with the mode label".
- **Threshold for keyword/semantic split**: currently hardcoded as `tokenCount <= 2`. Should this become a config knob in `Umbraco:AI:Search`? Recommend leaving hardcoded for v1; a config knob with no clear use case is YAGNI. If the split needs tuning in production, add the knob then.
- **Existing E2E coverage for `/search`**: does any Playwright spec already exercise the search page? If not, add one during this refactor (covered by AC9). If yes, extend it. To verify during `/plan`.

## Testing Guidelines

Create the following tests in the appropriate folders:

**Unit tests** (in a new or existing xUnit project — coordinate with audit P0.3):

- `SearchService` with mocked `IPublishedContentQuery`, `ISearcherResolver`, `IMemoryCache`, `IOptions<AIVectorSearchOptions>`:
  - Empty / null / whitespace query → returns empty result, neither searcher invoked
  - 1-token query → keyword searcher invoked, AI searcher not invoked
  - 2-token query → keyword searcher invoked (boundary)
  - 3-token query → AI searcher invoked first
  - AI searcher returns 0 raw hits → keyword searcher invoked as fallback
  - AI searcher returns hits, all of them are system-doc types → result list empty, keyword fallback NOT invoked (raw-zero gating)
  - System document types (`Category`, `CategoryList`, `Error`, `Search`, `XMLSitemap`) are filtered out of the result list
  - Result limit honored at `max(20, DefaultTopK)`
  - Identical query within cache TTL → searcher invoked once, second call returns cache
  - Cache key differs between keyword and AI mode for the same query string

**E2E tests** (Playwright, in `tests/e2e/`):

- A new (or extended) `search.spec.ts`:
  - Keyword query returns matching article(s) and shows "Mode · Keyword"
  - Long-form query returns AI-mode results and shows "Mode · AI semantic"
  - Empty `q` renders the form alone (no results list, no empty-state message)
  - Query with `<script>` payload renders the encoded form of the query and does not execute the script

If the xUnit test project does not exist when this work is implemented, `/plan` decides whether to add it as a first step of this plan or to write the unit tests as files that will be activated when audit P0.3 ships.
