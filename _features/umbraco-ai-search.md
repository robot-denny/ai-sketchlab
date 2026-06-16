# Feature: Site Search

Visitors search the site's content from the `/search` page by typing a query and pressing the search button. Short queries run keyword matching; longer natural-language queries run semantic search, so a paraphrased question ("how do I get started with this site") surfaces relevant pages even when none of the query's words appear on the page. Each result shows the page title, optional subtitle, and — for articles — the author and publish date, linking directly to the matching page. A small "Mode" label tells the visitor which searcher answered the query.

**Source spec**: _(none for v1 — plan drafted directly from conversation 2026-04-21; see `_plans/shipped/umbraco-ai-search.md`. Stable-stack migration: `_specs/shipped/migrate-ai-search-stable-1-0.md`)_
**Last verified**: 2026-06-16

---

## Increments

- [x] 2026-04-22 — `/search` page powered by `Umbraco.AI.Search` (semantic) with Examine keyword fallback; system pages filtered; XSS-safe query echo (plan: `_plans/shipped/umbraco-ai-search.md`)
- [x] 2026-05-20 — Search logic extracted from `search.cshtml` into a testable `SearchService` (view becomes a thin renderer; adds query routing, 5-minute result caching, and a 20-item display cap as observable behavior) (spec: `_specs/shipped/extract-search-service.md`)
- [x] 2026-06-16 — AI + search stack migrated to stable 1.0.0; AI config-key allow-list added for `Umbraco.AI 1.14.0`; keyword fallback guarded against the Provider.Examine beta.9 multi-word NRE (spec: `_specs/shipped/migrate-ai-search-stable-1-0.md`)

---

## Behaviors

### Rule: Visitors can run a search from the /search page

```scenario
Scenario: The search page renders the form when no query is supplied
  Given a visitor navigates to /search with no query string
  When the page loads
  Then a search form is visible
  And a text input for the query is visible
  And a search button is visible
  And no result listings appear
```

```scenario
Scenario: Submitting a query returns matching pages
  Given a visitor is on /search
  When the visitor submits the query "article"
  Then at least one result appears on the page
  And each result links to the matching page
```

### Rule: Query length routes the search, and the page shows which mode answered

The router sends queries of **2 tokens or fewer** to keyword search and **3 tokens or more** to AI semantic search; a "Mode" indicator above the results reports which one ran.

```scenario
Scenario: A short, one-or-two-token query is answered by keyword search
  Given a visitor submits a query of two tokens or fewer (e.g. "contact" or an author's "John Doe")
  When the results are rendered
  Then the keyword searcher is used (the AI searcher is not invoked)
  And a "Mode" indicator above the results shows "Keyword"
```

```scenario
Scenario: A longer natural-language query is answered by semantic search
  Given the AI vector index has been rebuilt with published content
  And a visitor submits a 3-or-more-token natural-language phrase (e.g. "stories about resilience")
  When the results are rendered
  Then a "Mode" indicator above the results shows "AI semantic"
```

### Rule: Results exclude internal and system pages

```scenario
Scenario: System doc-type pages are filtered out of results
  Given a visitor submits a broad query that matches many pages
  When the results are rendered
  Then no result links to the Search page itself
  And no result links to the Error page
  And no result links to the XML sitemap
  And no result links to a Category or Category List page
```

### Rule: Article results display the publish date and author attribution

```scenario
Scenario: Article result shows its publish date
  Given a visitor submits a query that matches at least one article
  When the results are rendered
  Then each article result shows a meta line containing the publish date (e.g. "Jun 16, 2026")
```

```scenario
Scenario: Article result shows "Posted by {author}" when an author is set
  Given a matching article has one or more authors set
  When the result is rendered
  Then the card shows a "Posted by {author}" line
```

```scenario
Scenario: Non-article results do not render a post-meta line
  Given a result is a page type that is not an article (e.g. Content page)
  When the result is rendered
  Then no author/date meta line appears beneath it
```

### Rule: The result link shows the page's title, falling back to the page name

```scenario
Scenario: Title property is used when present
  Given a matching page has a "title" field set to "Getting Started"
  When the result is rendered
  Then the result heading shows "Getting Started"
```

```scenario
Scenario: Page name is used when title is blank
  Given a matching page has no "title" field (or it is blank)
  When the result is rendered
  Then the result heading shows the page's backoffice Name
```

```scenario
Scenario: Subtitle is shown when present
  Given a matching page has a non-empty "subtitle" field
  When the result is rendered
  Then the subtitle appears beneath the title
```

### Rule: Paraphrased queries return semantically relevant pages

```scenario
Scenario: A paraphrased onboarding query surfaces the welcome page
  Given the site has an introductory page whose title contains "Welcome", "Getting Started", "Introduction", or "Introducing"
  And that page's body never uses the phrase "how do I get started with this site"
  When a visitor submits the query "how do I get started with this site"
  Then at least one result is returned
  And at least one result's title matches one of: welcome, getting started, introduction, introducing
```

### Rule: AI semantic falls back to keyword search when it returns no raw hits

```scenario
Scenario: A long query with zero raw AI hits falls back to keyword
  Given a 3-or-more-token query routes to AI semantic search
  And the AI searcher returns zero raw Document hits
  And the keyword index has matching articles
  When the page renders
  Then the Examine keyword searcher is queried as a fallback
  And the keyword results are shown in place of an empty result list
  And the "Mode" indicator still reads "AI semantic" (the mode reflects how the query was routed, not which searcher produced the results)
```

```scenario
Scenario: Fallback is gated on raw hits, not on the post-filter count
  Given the AI searcher returns one raw hit, but that hit is a system doc type (e.g. a Category)
  When the result list is filtered
  Then the keyword fallback is NOT invoked (raw-zero gates the fallback, not post-filter-zero)
  And the result list is empty
```

### Rule: The query is shown back to the visitor safely (no script execution)

```scenario
Scenario: A query containing a <script> tag is HTML-encoded in the results line
  Given a visitor submits the query "<script>alert(1)</script>"
  When the page renders
  Then no alert dialog appears
  And no <script> element is injected inside the search form
  And the "Results for..." line displays the query as plain text
```

```scenario
Scenario: An attribute-injection payload is HTML-encoded, not executed
  Given a visitor submits a query containing an onerror= attribute payload
  When the page renders
  Then the payload is HTML-encoded in the echoed query
  And no script executes
```

### Rule: The result count and echoed query appear above the result list

```scenario
Scenario: The results line shows the total count and the submitted query
  Given a visitor submits the query "article"
  And three matching pages are returned
  When the page renders
  Then a localized "Results for..." line appears above the result list
  And the line shows the number 3
  And the line shows the query "article"
```

```scenario
Scenario: The display is capped at 20 results but the count reflects the full match set
  Given a query matches 30 published pages after system-doc-type filtering
  When the page renders
  Then at most 20 result cards are shown (display cap)
  And the "Results for..." count reads 30 (the total is post-filter, pre-cap)
```

### Rule: Repeat queries within five minutes are served from cache

```scenario
Scenario: An identical query inside the cache window does not hit the searcher again
  Given a visitor has just searched for "contact" and got results
  When the same query is run again within five minutes
  Then the search backend is invoked exactly once across both requests
  And the visitor sees the same result set as the first run
```

```scenario
Scenario: Keyword and AI cache entries are namespaced separately
  Given the same text can route to either mode depending on length
  When "contact" (keyword) and "contact stories of resilience" (AI) are searched in succession
  Then each searcher is invoked once and neither cache entry collides with the other
```

---

## Edge Cases

### Rule: No results is a valid outcome — and never a server error

```scenario
Scenario: A query that matches nothing shows the empty state, not a 500
  Given a visitor submits a query that matches no published content semantically or by keyword
  When the page renders
  Then the request returns an HTTP status below 500
  And a "No matches for ..." empty state is shown with "Browse the archive" and "Clear search" actions
  And the search form remains visible so the visitor can refine the query
```

### Rule: The keyword fallback tolerates an upstream provider defect

```scenario
Scenario: A Provider.Examine multi-word-query NullReferenceException is contained
  Given AI semantic search returns no hits for a long query
  And the keyword fallback triggers the Provider.Examine beta.9 multi-word-query defect
  When the keyword searcher throws
  Then the search service treats it as zero hits
  And the page shows the empty state instead of returning a 500
```

### Rule: Semantic search degrades silently if the AI config-key prefix is not allow-listed

```scenario
Scenario: A missing AllowedConfigurationKeyPrefixes entry breaks embeddings
  Given an AI connection references its key as $OpenAI:ApiKey
  And the "OpenAI" prefix is NOT in Umbraco:AI:AllowedConfigurationKeyPrefixes
  When the embedding service tries to resolve the key
  Then resolution is rejected and semantic search silently returns nothing
  And the site must add the prefix to the allow-list to restore semantic results
```

### Rule: Only published documents are returned

```scenario
Scenario: Unpublished or non-document entries are excluded
  Given the search index also contains non-document object types (e.g. media, members)
  When a query matches entries of mixed object types
  Then only entries whose object type is "Document" are rendered
  And unpublished documents are not rendered
```

### Rule: Index state is environment-local on Umbraco Cloud

```scenario
Scenario: A freshly deployed environment has an empty index until rebuilt
  Given the site has just been deployed to an Umbraco Cloud environment
  And the AI search index has not yet been rebuilt in that environment
  When a visitor submits any query
  Then the AI searcher returns zero results
  And the Examine keyword fallback determines what the visitor sees
  And an operator must rebuild the index from Settings → Search to restore semantic matches
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Search page renders the form when no query is supplied | [tests/e2e/search.spec.ts:16](tests/e2e/search.spec.ts#L16) | Covered |
| Submitting a query returns matching pages | [tests/e2e/search.spec.ts:47](tests/e2e/search.spec.ts#L47) | Covered |
| Mode label shows "Keyword" for a single-token query | [tests/e2e/search.spec.ts:123](tests/e2e/search.spec.ts#L123) | Covered (skips if keyword index empty) |
| Mode label shows "AI semantic" for a 3+ token query | [tests/e2e/search.spec.ts:140](tests/e2e/search.spec.ts#L140) | Covered (skips without OpenAI key/index) |
| System doc-type pages are filtered out | [tests/e2e/search.spec.ts:55](tests/e2e/search.spec.ts#L55) | Covered |
| Article result shows its publish date | [tests/e2e/search.spec.ts:87](tests/e2e/search.spec.ts#L87) | Covered |
| Article result shows "Posted by {author}" | — | Not covered by an assertion (author-dependent; rendered at [_ArticleCard.cshtml:92-95](src/UmbracoProject/Views/Partials/v2/_ArticleCard.cshtml#L92-L95)) |
| Non-article results skip post-meta | — | Not covered (verified manually; card renders meta only for article fields) |
| Title property used when present | — | Not covered (verified manually) |
| Page name used when title is blank | — | Not covered (verified manually) |
| Subtitle rendered when present | — | Not covered (verified manually) |
| Paraphrased query returns semantic match | [tests/e2e/search.spec.ts:196](tests/e2e/search.spec.ts#L196) | Covered (skips without index) |
| Keyword fallback when AI searcher returns zero | — | Exercised by the forced-fallback test below; no test forces a non-empty keyword fallback specifically |
| XSS: script payload is HTML-encoded | [tests/e2e/search.spec.ts:104](tests/e2e/search.spec.ts#L104) | Covered |
| XSS: attribute-injection (onerror=) payload is HTML-encoded | [tests/e2e/search.spec.ts:163](tests/e2e/search.spec.ts#L163) | Covered |
| Results line shows count + echoed query | — | Not covered (localized "Results for..." line at [search.cshtml:58](src/UmbracoProject/Views/search.cshtml#L58)) |
| No results shows the empty state, not a 500 | [tests/e2e/search.spec.ts:28](tests/e2e/search.spec.ts#L28) | Covered |
| Provider.Examine NRE on fallback is contained | [tests/e2e/search.spec.ts:28](tests/e2e/search.spec.ts#L28) | Covered |
| Semantic degrades silently without an allow-list entry | — | Not covered by E2E (operational — documented in [CLAUDE.md](CLAUDE.md) "AI config-key allow-list") |
| Only published documents are returned | — | Not covered — filter in [Services/SearchService.cs](src/UmbracoProject/Services/SearchService.cs) (`ObjectType == Document` + published null-check) |
| Environment-local index state on Cloud | — | Not covered by E2E (operational — documented in [CLAUDE.md](CLAUDE.md) "Search → Umbraco Cloud deploys") |
| Two-token query routes to keyword (boundary) | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:102](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L102) | Covered (unit) |
| Three-token query routes to AI first | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:126](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L126) | Covered (unit) |
| Raw-zero gates the keyword fallback (not post-filter-zero) | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:190](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L190) | Covered (unit) |
| Repeat query inside the cache window hits the searcher once | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:259](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L259) | Covered (unit) |
| Keyword and AI cache entries are namespaced separately | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:283](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L283) | Covered (unit) |
| Display capped at 20; TotalCount is post-filter, pre-cap | [tests/UmbracoProject.Tests/Services/SearchServiceTests.cs:246](tests/UmbracoProject.Tests/Services/SearchServiceTests.cs#L246) | Covered (unit) |

---

## Revision Notes

- 2026-04-22: Initial feature doc, created retroactively after Step 7 of `_plans/shipped/umbraco-ai-search.md` shipped the AI-backed search.
- 2026-06-16: Folded in the former `migrate-ai-search-stable-1-0` feature doc (one capability, one doc) and refreshed against current behavior. Added the "Mode" label rule (Keyword / AI semantic), the graceful-degradation edge cases (no-500 empty state, Provider.Examine beta.9 NRE containment, AI config-key allow-list), and the attribute-injection XSS scenario. Corrected the stale `.post-preview` selector to the current `.article-grid-card` card and described the real `_EmptyState` partial. Refreshed the Test Coverage table against the current `tests/e2e/search.spec.ts`. The stable-stack migration ACs (zero-warning build, backoffice list-view search, index rebuild count, Pinned-betas doc collapse) live in `_specs/shipped/migrate-ai-search-stable-1-0.md` — they were point-in-time acceptance criteria, not standing behavior.
- 2026-06-16: Folded in the former `extract-search-service` feature doc (a behind-the-scenes refactor — not its own capability). Sharpened the routing rule with the ≤2-token/≥3-token threshold, the fallback rule with "mode reflects routing, not which searcher produced results" and the raw-zero-gates-fallback subtlety, the count rule with the 20-item display cap and post-filter/pre-cap TotalCount, and added the five-minute result-cache rule. The refactor's architecture ACs (view holds no business logic, `SearchService` unit-testable in isolation, composer-registered) were point-in-time refactor criteria and stay in `_specs/shipped/extract-search-service.md` — they are not standing user behavior.
