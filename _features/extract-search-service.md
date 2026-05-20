# Feature: Extract Search Service

A behind-the-scenes refactor that moves the logic of the site's search page out of the Razor view and into a reusable, testable `SearchService`. From a visitor's point of view, nothing changes — `/search` continues to route short queries to keyword matching and longer queries to AI semantic search, falls back from AI to keyword when AI returns nothing, caches identical queries for five minutes, filters out internal document types, and renders the user's query safely. The internal payoff is that this logic is now unit-testable, reusable from other surfaces (future Delivery API endpoint, typeahead, admin tools), and the Razor view becomes a thin renderer.

**Source spec**: `_specs/extract-search-service.md`
**Last verified**: 2026-05-20

---

## Increments

The per-feature mini-roadmap: shipped increments + planned increments + parking-lot ideas. Newest planned items first. When an item ships, flip the checkbox and point it at the shipped spec.

- [x] 2026-05-19 — v1: extract logic to `SearchService`, view becomes thin renderer (spec: `_specs/extract-search-service.md`, plan: `_plans/extract-search-service.md`)
- [ ] v2: expose the service via a Delivery API endpoint for headless consumers (no spec yet)
- [ ] v3: add a typeahead/autocomplete UI that reuses `SearchService` for a smaller `take` and a debounced request (no spec yet)
- [ ] v4: map results to a DTO designed for over-the-wire serialization, decoupling from `IPublishedContent` (no spec yet — bundled with v2 if/when Delivery API exposure ships)

---

## Behaviors

Scenarios are grouped by Rule — the business rule or acceptance criterion that the scenarios prove. Use concrete values (Specification by Example) and business language (Ubiquitous Language). See `.claude/skills/BDD.md` for guidance.

### Rule: Search results on `/search` are unchanged for visitors after the refactor

```scenario
Scenario: Visitor runs a short keyword query
  Given the site has published articles whose titles include "article"
  When a visitor visits /search?q=article
  Then they see at least one .post-preview result in the result list
  And the rendered article cards link to the matching pages
```

```scenario
Scenario: Visitor runs a long-form natural language query
  Given the site has an introductory page whose title contains "Welcome", "Getting Started", "Introduction", or "Introducing"
  When a visitor visits /search?q=how do I get started with this site
  Then they see at least one result whose title contains one of those onboarding keywords
```

### Rule: The mode label reflects the query length

```scenario
Scenario: One-token query is keyword mode
  When a visitor visits /search?q=contact
  Then the page shows "Mode · Keyword" in the .s-meta status block
```

```scenario
Scenario: Two-token query is keyword mode (boundary)
  Given the routing threshold is "tokenCount <= 2"
  When SearchService.SearchAsync is called with "John Doe"
  Then the keyword searcher is invoked
  And the AI searcher is not invoked
  And the returned SearchResult.Mode equals SearchMode.Keyword
```

```scenario
Scenario: Three-token query is AI semantic mode
  When a visitor visits /search?q=stories about resilience
  Then the page shows "Mode · AI semantic" in the .s-meta status block
```

### Rule: Repeat queries within 5 minutes return cached results

> **Known limitation (v1 acceptable, revisit before v2/v3)**: `IMemoryCache.GetOrCreateAsync` does not serialize concurrent factory runs. N simultaneous cold-miss requests for the same query trigger N separate searcher calls (and, for the AI path, N embedding round-trips). Fine at demo-site traffic. Before v2 (Delivery API endpoint) or v3 (typeahead), add per-key locking or switch to `IHybridCache` (.NET 9+).

```scenario
Scenario: Second identical query inside the cache window does not invoke the searcher
  Given a visitor has just searched for "contact" and got results
  When the same query is run again within 5 minutes
  Then the search backend is invoked exactly once across both calls
  And the visitor sees the same result set as the first run
```

```scenario
Scenario: Keyword and AI cache keys are namespaced separately
  Given the same query string can route to either keyword or AI mode depending on length
  When "contact" (keyword) and "contact stories of resilience" (AI) are searched in succession
  Then both searchers are invoked once each
  And neither cache entry collides with the other
```

### Rule: AI semantic falls back to keyword when AI returns nothing

```scenario
Scenario: Long query with no AI raw hits falls back to keyword
  Given the AI searcher returns zero raw Document hits for a 3+ token query
  And the keyword index has matching articles
  When a visitor visits /search with that query
  Then the keyword searcher is invoked as a fallback
  And the keyword results are shown
  And the mode label still reads "AI semantic" (mode reflects routing, not which searcher produced the results)
```

### Rule: System document types never appear in results

```scenario
Scenario: System doc-type hits are filtered out at the service layer
  Given the searcher returns a mix of Article, Category, and Error document types
  When SearchService.SearchAsync is called
  Then SearchResult.Items contains only the Article entry (filtered by ContentType.Alias)
```

```scenario
Scenario: System doc-type URLs never appear in the rendered result list
  Given the page renders the results of a broad query
  When a visitor inspects the result links
  Then no result link resolves to /category, /categories, /search, /error, or /sitemap.xml
```

```scenario
Scenario: AI returns hits that are all system doc types — fallback is NOT triggered
  Given the AI searcher returns 1 raw hit but that hit is a Category document
  When SearchService.SearchAsync is called with a 3+ token query
  Then the AI searcher is invoked
  And the keyword fallback is NOT invoked (raw-zero gates fallback, not post-filter-zero)
  And the result list is empty
```

### Rule: The Razor view holds no search business logic

```scenario
Scenario: Code review of search.cshtml after the refactor
  Given the refactor is complete
  When a reviewer reads Views/search.cshtml
  Then they see no @inject of ISearcherResolver
  And they see no @inject of IMemoryCache
  And they see no @inject of IOptions<AIVectorSearchOptions>
  And they see no token-counting, cache-key composition, or fallback logic
  And the view's @{ ... } block calls one method: searchService.SearchAsync(searchQuery, Context.RequestAborted)
```

### Rule: SearchService is unit-testable in isolation

```scenario
Scenario: Unit test instantiates SearchService with mocked dependencies
  Given a test provides NSubstitute mocks for IPublishedContentQuery and ISearcherResolver
  And a real MemoryCache instance
  And an Options.Create(new AIVectorSearchOptions { DefaultTopK = 50 })
  And a NullLogger<SearchService>
  When the test calls SearchService.SearchAsync with a query
  Then the test can assert on the returned result count, mode, total count, and routing decisions
  And no Umbraco hosting environment is required
```

### Rule: The service is registered through an IComposer and the site boots

```scenario
Scenario: Site boots cleanly after the refactor
  Given the SearchServiceComposer registers ISearchService → SearchService in the DI container
  When the site is built and started locally
  Then /search?q=contact loads and shows keyword-mode results
  And /search?q=stories about resilience loads and shows AI-mode results
```

---

## Edge Cases

### Rule: Empty / whitespace / null queries render only the search form

```scenario
Scenario: Empty query renders the form alone
  When a visitor visits /search with no q parameter
  Then the page shows the search form and head copy
  And no .post-preview results and no empty-state message are shown
```

```scenario
Scenario: Whitespace-only query is treated as empty
  Given SearchService is wired with no searcher expectations
  When SearchService.SearchAsync is called with "   "
  Then no search is performed (neither searcher is invoked)
  And the returned SearchResult.Items is empty
```

```scenario
Scenario: Null query is treated as empty
  Given SearchService is wired with no searcher expectations
  When SearchService.SearchAsync is called with null
  Then no search is performed (neither searcher is invoked)
  And the returned SearchResult.Items is empty
```

### Rule: Display is capped at 20 results; TotalCount is post-filter, pre-cap

```scenario
Scenario: Searcher returns 30 post-system-doc-type-filter hits — view shows 20, TotalCount reports 30
  Given the keyword searcher returns 30 published-article documents (all pass the system-doc-type filter)
  When SearchService.SearchAsync is called
  Then SearchResult.Items contains 20 entries (display cap)
  And SearchResult.TotalCount equals 30 (post-filter, pre-cap)
```

### Rule: Queries with HTML payloads are rendered safely

```scenario
Scenario: Query containing <script> payload is HTML-encoded in the results line
  When a visitor visits /search?q=<script>alert(1)</script>
  Then no alert() dialog opens
  And no live <script> element is injected inside form#search
```

```scenario
Scenario: Attribute-injection payload (onerror=) is HTML-encoded, not executed
  When a visitor visits /search?q=<img src=x onerror=alert(1)>
  Then no alert() dialog opens
  And no live <img> element is injected from the query string
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Visitor runs a short keyword query | [tests/e2e/search.spec.ts:29](tests/e2e/search.spec.ts#L29) | Covered |
| Visitor runs a long-form natural language query | [tests/e2e/search.spec.ts:179](tests/e2e/search.spec.ts#L179) | Covered |
| One-token query is keyword mode (e2e) | [tests/e2e/search.spec.ts:106](tests/e2e/search.spec.ts#L106) | Covered |
| Two-token query is keyword mode (boundary, unit) | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:102](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L102) | Covered |
| Three-token query is AI semantic mode (e2e) | [tests/e2e/search.spec.ts:123](tests/e2e/search.spec.ts#L123) | Covered |
| Three-token query routes to AI searcher first (unit) | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:126](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L126) | Covered |
| One-token query routes to keyword searcher (unit) | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:77](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L77) | Covered |
| Second identical query inside the cache window does not invoke the searcher | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:259](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L259) | Covered |
| Keyword and AI cache keys are namespaced separately | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:283](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L283) | Covered |
| Long query with no AI raw hits falls back to keyword | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:150](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L150) | Covered |
| AI hits that are all system doc types — fallback NOT triggered | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:190](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L190) | Covered |
| System doc-type hits are filtered out at the service layer | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:220](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L220) | Covered |
| System doc-type URLs never appear in the rendered result list | [tests/e2e/search.spec.ts:37](tests/e2e/search.spec.ts#L37) | Covered |
| Code review of search.cshtml after the refactor | — | Verified manually against [src/UmbracoProject/Views/search.cshtml](src/UmbracoProject/Views/search.cshtml) — no `ISearcherResolver`, `IMemoryCache`, or `IOptions<AIVectorSearchOptions>` injections; single call to `searchService.SearchAsync` at line 16 |
| Unit test instantiates SearchService with mocked dependencies | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:32](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L32) | Covered (constructor & test fixture demonstrate the harness) |
| Site boots cleanly after the refactor | — | Verified manually during Step 4 (`dotnet run` + `/search?q=contact` + `/search?q=stories about resilience`); composer at [src/UmbracoProject/Services/SearchServiceComposer.cs](src/UmbracoProject/Services/SearchServiceComposer.cs) |
| Empty query renders the form alone | [tests/e2e/search.spec.ts:17](tests/e2e/search.spec.ts#L17) | Covered |
| Whitespace-only query is treated as empty | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:59](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L59) | Covered (unit; no e2e duplicate — service-level guard) |
| Null query is treated as empty | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:68](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L68) | Covered |
| Searcher returns 30 post-filter hits — view shows 20, TotalCount reports 30 | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:246](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L246) | Covered |
| Query containing <script> payload is HTML-encoded | [tests/e2e/search.spec.ts:87](tests/e2e/search.spec.ts#L87) | Covered |
| Attribute-injection payload (onerror=) is HTML-encoded | [tests/e2e/search.spec.ts:146](tests/e2e/search.spec.ts#L146) | Covered |

---

## Revision Notes

- 2026-05-19: Draft scenarios from initial spec.
- 2026-05-19: Verified against the shipped implementation. Filled in test coverage table with file:Lnn references to `tests/UmbracoProject.Tests/Services/SearchServiceTests.cs` (12 unit tests) and `tests/e2e/search.spec.ts` (9 e2e tests including the two mode-label tests added in Step 5). Added a unit-level "Display cap of 20 / TotalCount" edge-case rule that was implicit in the spec but worth surfacing as observable behavior. Added the cache-key-namespacing scenario as a second concrete example under the cache rule (the unit test `KeywordAndAi_CacheKeysDistinct` proves it but the draft didn't enumerate it). Removed the "Draft" banner; flipped the v1 increment checkbox.
- 2026-05-20: Code-review pass. Fixed BDD `When`-step gaps in the whitespace and null-query scenarios. Split the system-doc-type scenario into a unit-level (`ContentType.Alias` filter) and an e2e-level (URL paths) scenario, so each backing test proves exactly what its scenario claims. Dropped the "Playwright covers the visible search paths" meta-scenario — the coverage table is the single source of truth for test inventory. Tightened the "Display cap" rule heading and scenario name to read "post-filter, pre-cap" instead of "pre-cap" so a v2 contributor can't misread it as "pre-filter". Added a known-limitation note about `IMemoryCache.GetOrCreateAsync` cache-stampede behavior under the cache rule for v2/v3 readers.
