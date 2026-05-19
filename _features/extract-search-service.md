# Feature: Extract Search Service

> **Draft** — These scenarios have not yet been verified against an implementation. They will be refined during planning and verified after implementation.

A behind-the-scenes refactor that moves the logic of the site's search page out of the Razor view and into a reusable, testable `SearchService`. From a visitor's point of view, nothing changes — `/search` continues to route short queries to keyword matching and longer queries to AI semantic search, falls back from AI to keyword when AI returns nothing, caches identical queries for five minutes, filters out internal document types, and renders the user's query safely. The internal payoff is that this logic is now unit-testable, reusable from other surfaces (future Delivery API endpoint, typeahead, admin tools), and the Razor view becomes a thin renderer.

**Source spec**: `_specs/extract-search-service.md`
**Last verified**: not yet — draft

---

## Increments

The per-feature mini-roadmap: shipped increments + planned increments + parking-lot ideas. Newest planned items first. When an item ships, flip the checkbox and point it at the shipped spec.

- [ ] {YYYY-MM-DD} — v1: extract logic to `SearchService`, view becomes thin renderer (spec: `_specs/extract-search-service.md`, plan TBD)
- [ ] v2: expose the service via a Delivery API endpoint for headless consumers (no spec yet)
- [ ] v3: add a typeahead/autocomplete UI that reuses `SearchService` for a smaller `take` and a debounced request (no spec yet)
- [ ] v4: map results to a DTO designed for over-the-wire serialization, decoupling from `IPublishedContent` (no spec yet — bundled with v2 if/when Delivery API exposure ships)

---

## Behaviors

Scenarios are grouped by Rule — the business rule or acceptance criterion that the scenarios prove. Use concrete values (Specification by Example) and business language (Ubiquitous Language). See `.claude/skills/BDD.md` for guidance.

### Rule: Search results on `/search` are unchanged for visitors after the refactor

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

### Rule: The mode label reflects the query length

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

### Rule: Repeat queries within 5 minutes return cached results

```scenario
Scenario: Second identical query inside the cache window does not invoke the searcher
  Given a visitor has just searched for "creative process" and got results
  When the same query is run again within 5 minutes
  Then the search backend is not invoked a second time
  And the visitor sees the same result set as the first run
```

### Rule: AI semantic falls back to keyword when AI returns nothing

```scenario
Scenario: Long query with no AI matches falls back to keyword
  Given the AI search index has no chunks matching "obscure dadaist poetry collected"
  And the keyword index has a published article titled "Obscure Dadaist Poetry, Collected"
  When a visitor visits /search?q=obscure dadaist poetry collected
  Then they see the article in the result list
```

### Rule: System document types never appear in results

```scenario
Scenario: AI hit on a Category node is filtered out
  Given the AI index returns a Category node as a top hit for "tech"
  When a visitor visits /search?q=tech reflections
  Then the Category node does not appear in the rendered result list
```

### Rule: The Razor view holds no search business logic

```scenario
Scenario: Code review of search.cshtml after the refactor
  Given the refactor is complete
  When a reviewer reads search.cshtml
  Then they see no calls to ISearcherResolver
  And they see no use of IMemoryCache
  And they see no token-counting, cache-key composition, or fallback logic
  And the view calls one method on SearchService and renders the result
```

### Rule: SearchService is unit-testable in isolation

```scenario
Scenario: Unit test instantiates SearchService with mocked dependencies
  Given a test provides mock implementations of the published-content query, the searcher resolver, the memory cache, and the AI vector search options
  When the test calls SearchService.SearchAsync with a query
  Then the test can assert on the returned result count, mode, and result IDs
  And no Umbraco hosting environment is required
```

### Rule: The service is registered through an IComposer and the site boots

```scenario
Scenario: Site boots cleanly after the refactor
  Given the refactor is complete and the service is registered via a composer
  When the site is built and started locally
  Then /search?q=contact loads and shows keyword-mode results
  And /search?q=stories about resilience loads and shows AI-mode results
```

### Rule: An E2E test covers the visible search behaviors

```scenario
Scenario: Playwright covers the three core paths
  When the Playwright suite runs
  Then a spec for /search exercises a keyword query that returns results
  And the spec exercises a long-form query that returns AI-mode results
  And the spec exercises an empty query that renders only the form
```

---

## Edge Cases

### Rule: Empty / whitespace queries render only the search form

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

### Rule: Queries with HTML payloads are rendered safely

```scenario
Scenario: Query containing HTML payload is rendered safely
  When a visitor visits /search?q=<script>alert(1)</script>
  Then the page renders the encoded query in the result banner
  And no script tag is executed in the browser
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Visitor runs a short keyword query | — | Not covered |
| Visitor runs a long-form natural language query | — | Not covered |
| One-token query is keyword mode | — | Not covered |
| Two-token query is keyword mode (boundary) | — | Not covered |
| Three-token query is AI semantic mode | — | Not covered |
| Second identical query inside the cache window does not invoke the searcher | — | Not covered |
| Long query with no AI matches falls back to keyword | — | Not covered |
| AI hit on a Category node is filtered out | — | Not covered |
| Code review of search.cshtml after the refactor | — | Not covered |
| Unit test instantiates SearchService with mocked dependencies | — | Not covered |
| Site boots cleanly after the refactor | — | Not covered |
| Playwright covers the three core paths | — | Not covered |
| Empty query renders the form alone | — | Not covered |
| Whitespace-only query is treated as empty | — | Not covered |
| Query containing HTML payload is rendered safely | — | Not covered |

---

## Revision Notes

- 2026-05-19: Draft scenarios from initial spec
